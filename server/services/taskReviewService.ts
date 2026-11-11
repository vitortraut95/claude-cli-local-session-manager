import { randomUUID } from "node:crypto";
import {
  bitbucketCredentialsFromEnv,
  hasAiReviewComment,
  listOpenPullRequests,
  type BitbucketCredentials,
} from "./boardWatcher/bitbucket.js";
import { prepareReview, REVIEW_RESULT_SHAPE } from "./boardWatcher/claudeReviewer.js";
import { loadBoardWatcherConfig, type BoardWatcherConfig } from "./boardWatcher/config.js";
import { getLessons } from "./boardWatcher/feedback.js";
import { prUrl } from "./boardWatcher/instantNotices.js";
import { localRepoPaths } from "./boardWatcher/sprintRepos.js";
import { prSubject, type PullRequest } from "./boardWatcher/types.js";
import { resolveInstalledSkill } from "./installedSkillService.js";
import type { UserPreferences } from "./preferencesService.js";
import { launchTaskTerminal } from "./taskService.js";
import type { TestLaunchOutcome } from "./taskTestService.js";
import { API_PORT } from "../utils/apiPort.js";
import { markWorktreeTrustAccepted } from "../utils/claudeTrust.js";
import { forceRemoveWorktree } from "../utils/git.js";
import { AppError, ConflictError } from "../utils/httpError.js";
import {
  markTestSession,
  setSessionStatus,
  setTestWorktrees,
  type QueueEntry,
} from "../utils/taskStore.js";

/**
 * Review entries of the task queue: the AI code review of a colleague's PR (`key` = `repo#id`),
 * queued by the board automations or by hand. The session runs `taskReviewSkill` in a disposable
 * worktree of the PR's commit and sends its result back (`POST /sessions/:id/review-result`),
 * which the app posts and approves on the PR within the board's limits (`submitReviewResult`).
 * Its status is only in progress or done; done + closed removes the worktree, like a test's.
 */

/** `repo#id`, the queue key of a review entry. */
export const PR_SUBJECT = /^([A-Za-z0-9._-]+)#(\d+)$/;

/** The board config with Bitbucket, which review entries need to read and post on the PR. */
export async function reviewBoardSetup(): Promise<{
  config: BoardWatcherConfig;
  credentials: BitbucketCredentials;
}> {
  const config = await loadBoardWatcherConfig().catch(() => null);
  if (!config?.bitbucket) {
    throw new ConflictError(
      "REVIEW_NEEDS_BOARD",
      "Code reviews need the board automations set up with Bitbucket (boardWatcher.json).",
    );
  }
  return { config, credentials: bitbucketCredentialsFromEnv(config.bitbucket.workspace) };
}

/** The open PR behind `subject`, with the repo's other open PRs. */
export async function findOpenPullRequest(
  credentials: BitbucketCredentials,
  subject: string,
): Promise<{ pr: PullRequest; openPrs: PullRequest[] }> {
  const [, repo = ""] = PR_SUBJECT.exec(subject) ?? [];
  const openPrs = repo ? await listOpenPullRequests(credentials, [repo]) : [];
  const pr = openPrs.find((p) => prSubject(p) === subject);
  if (!pr) {
    throw new ConflictError("REVIEW_PR_NOT_OPEN", `${subject} isn't an open pull request.`);
  }
  return { pr, openPrs };
}

/** The local clone of `repo` (a folder with its name in the workspace folders, or
 *  `bitbucket.localRepos`), or null. */
export async function reviewRepoPath(
  config: BoardWatcherConfig,
  repo: string,
): Promise<string | null> {
  return (await localRepoPaths(config, [repo]))[repo] ?? null;
}

const PROMPT_TEXT = {
  en: {
    nickname: "Review - {link}",
    name: "Review {key}",
    result:
      "When the review is done, send its result to the app, which posts the comments and approves " +
      "the PR within its limits (never comment on or approve the PR yourself). Send it as JSON in " +
      "this shape: {shape}\n\n{command}\n\nThe app answers with what it posted and marks this " +
      "review done. If it answers with an error, show it and stop: the review shows up in the " +
      "queue with that error.",
    compact:
      "Last, suggest running /compact, in case this session is resumed to talk about the review.",
  },
  pt: {
    nickname: "Review - {link}",
    name: "Review {key}",
    result:
      "Quando terminar o review, mande o resultado para o app, que comenta e aprova o PR dentro " +
      "dos limites dele (nunca comente nem aprove o PR você mesmo). Mande como JSON neste " +
      "formato: {shape}\n\n{command}\n\nO app responde com o que publicou e marca este review " +
      "como concluído. Se responder com erro, mostre o erro e pare: o review aparece na fila com " +
      "ele.",
    compact:
      "Por fim, sugira rodar /compact, caso esta sessão seja retomada pra conversar sobre o review.",
  },
};

/** Launches a queue entry of kind "review". */
export async function launchReviewEntry(
  entry: QueueEntry,
  prefs: UserPreferences,
): Promise<TestLaunchOutcome> {
  const skill = await resolveInstalledSkill(
    prefs.taskReviewSkill,
    "TASK_REVIEW_SKILL_NOT_INSTALLED",
    "taskReviewSkill",
  );
  if (!skill) {
    throw new AppError(
      "TASK_REVIEW_SKILL_REQUIRED",
      "Choose the code review skill in Skills before queueing a code review.",
    );
  }
  const { config, credentials } = await reviewBoardSetup();
  const { pr, openPrs } = await findOpenPullRequest(credentials, entry.key);
  if (await hasAiReviewComment(credentials, pr)) {
    throw new ConflictError(
      "REVIEW_ALREADY_DONE",
      `${entry.key} already has its AI review (each PR gets one).`,
    );
  }
  const repoPath = entry.repos[0] ?? (await reviewRepoPath(config, pr.repo));
  if (!repoPath) {
    throw new AppError(
      "REVIEW_REPO_NOT_FOUND",
      `No local clone of ${pr.repo} in the workspace folders.`,
    );
  }
  const { worktree, context } = await prepareReview(pr, {
    repoPath,
    openPrs,
    jiraSite: config.jira?.site,
    lessons: await getLessons("review"),
  });

  const text = PROMPT_TEXT[prefs.language ?? "en"];
  const link = entry.link ?? prUrl(config, pr) ?? entry.key;
  const sessionId = randomUUID();
  const command =
    `curl -sS -X POST http://localhost:${API_PORT}/sessions/${sessionId}/review-result ` +
    `-H 'Content-Type: application/json' --data-binary @- <<'JSON'\n<the JSON>\nJSON`;
  const prompt = [
    `/${skill} ${link}`,
    context,
    text.result.replace("{shape}", REVIEW_RESULT_SHAPE).replace("{command}", command),
    text.compact,
  ].join("\n\n");

  // Marked before the terminal opens, so a session that dies right away is still cleaned up.
  await markTestSession(sessionId, entry.key, [worktree], "review");
  try {
    await markWorktreeTrustAccepted(worktree);
    await launchTaskTerminal({
      worktreePath: worktree,
      prompt,
      // Nobody answers permission prompts in a queued session.
      permissionModeAuto: true,
      repoRoot: "",
      nickname: text.nickname.replace("{link}", link),
      name: text.name.replace("{key}", entry.key),
      sessionId,
    });
  } catch (err) {
    await forceRemoveWorktree(worktree).catch(() => undefined);
    await setTestWorktrees(sessionId, []);
    throw err;
  }
  await setSessionStatus(sessionId, "in_progress", "scheduler");
  return {
    sessionId,
    branch: pr.sourceBranch ?? "",
    worktreePath: worktree,
    addDirs: [],
    extraErrors: [],
    linkedNodeModules: 0,
  };
}
