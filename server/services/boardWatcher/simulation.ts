import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import type { WatcherActionEntry } from "../../../shared/boardWatcher.js";
import { REPO_ROOT } from "../../utils/repoRoot.js";
import { getUserPreferences } from "../preferencesService.js";
import { addDevEntryIfAbsent, getTaskQueue as getQueue } from "../taskQueueService.js";
import {
  approvePullRequest,
  bitbucketCredentialsFromEnv,
  commentOnPullRequest,
  listOpenPullRequests,
} from "./bitbucket.js";
import type { BoardWatcherConfig } from "./config.js";
import { markConflicts } from "./conflicts.js";
import { issueUrl, noticeLiveAction, noticePause, prUrl } from "./instantNotices.js";
import { jiraCredentialsFromEnv, searchIssues, transitionIssue } from "./jira.js";
import { prSubject, type BoardIssue, type PullRequest, type WatcherDeps } from "./types.js";

/**
 * The watcher's providers against the real board and PRs. Every write is appended to the
 * gitignored `boardWatcher-actions.jsonl` (one JSON object per line, which the digest and the
 * app's history are built from); only the ones whose switch in `config.live` is on are also done
 * for real (`live: true` in the entry) and announced in Teams. The rest is simulation: nothing
 * reaches Jira, Bitbucket or the task queue.
 */

export const ACTIONS_FILE = path.join(REPO_ROOT, "boardWatcher-actions.jsonl");

export type ActionEntry = WatcherActionEntry;

export async function readActions(since: Date): Promise<ActionEntry[]> {
  const raw = await readFile(ACTIONS_FILE, "utf8").catch(() => "");
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ActionEntry)
    .filter((entry) => Date.parse(entry.ts) >= since.getTime());
}

export async function recordAction(
  entry: Omit<ActionEntry, "ts">,
  now = new Date(),
): Promise<void> {
  await appendFile(
    ACTIONS_FILE,
    `${JSON.stringify({ ts: now.toISOString(), ...entry })}\n`,
    "utf8",
  );
}

/** Bug-like tickets get a fix branch, the rest the first configured branch type. */
async function devBranchPrefix(issue: BoardIssue | undefined): Promise<string | null> {
  const { branchTypes } = await getUserPreferences();
  const isBug = /bug|defect|incident/i.test(issue?.issueType ?? "");
  return (
    (isBug ? branchTypes.find((t) => /fix|bug/i.test(t)) : undefined) ?? branchTypes[0] ?? null
  );
}

/** The team repos the ticket names (in its title, description or comments) that have a clone. */
function mentionedRepos(
  issue: BoardIssue | undefined,
  localRepos: Record<string, string>,
): string[] {
  if (!issue) return [];
  const text = [issue.summary, issue.description, ...issue.comments.map((c) => c.body)].join("\n");
  return Object.entries(localRepos)
    .filter(([repo]) => new RegExp(`\\b${repo}\\b`).test(text))
    .map(([, repoPath]) => repoPath);
}

/** `onReview` / `onTest` take a PR due for review / a claimed ticket (a real session runs it
 *  later); without them it's only recorded. */
export function createBoardDeps(
  config: BoardWatcherConfig,
  now: () => Date,
  onReview?: (pr: PullRequest) => void,
  onTest?: (issue: BoardIssue, retest: boolean) => void,
  /** A To Do ticket of the user's newly found with a weak description, and what it lacks. */
  onWeakDescription?: (issue: BoardIssue, missing: string) => void,
): WatcherDeps {
  if (!config.jira || !config.bitbucket) {
    throw new Error('boardWatcher.json needs "jira" and "bitbucket" for simulation mode.');
  }
  const { jira, bitbucket } = config;
  const live = config.live ?? {};
  const jiraCredentials = jiraCredentialsFromEnv(jira.site);
  const bitbucketCredentials = bitbucketCredentialsFromEnv(bitbucket.workspace);
  const titles = new Map<string, string>();
  const issuesByKey = new Map<string, BoardIssue>();
  const statusIds = [
    ...(config.columns.inProgress ?? []),
    ...config.columns.todo,
    ...config.columns.waitTest,
    ...config.columns.testing,
    ...(config.columns.codeReview ?? []),
  ].join(",");

  const record = (entry: Omit<ActionEntry, "ts" | "title"> & { title?: string }) =>
    recordAction({ title: titles.get(entry.subject) ?? "", ...entry }, now());

  return {
    board: {
      listIssues: async () => {
        const issues = await searchIssues(
          jiraCredentials,
          `(${jira.scopeJql}) AND sprint in openSprints() AND status in (${statusIds})`,
          300,
        );
        for (const issue of issues) {
          titles.set(issue.key, issue.summary);
          issuesByKey.set(issue.key, issue);
        }
        return issues;
      },
      // A claim is a transition followed by an enqueue, which records it; a move to In
      // Progress is recorded here.
      transition: async (key, statusId) => {
        const toProgress = statusId === config.inProgressStatusId;
        const real = toProgress ? live.startProgress : live.testClaim;
        if (real) await transitionIssue(jiraCredentials, key, statusId);
        if (!toProgress) return;
        await record({ action: "start-progress", subject: key, ...(real ? { live: true } : {}) });
        if (real) {
          noticeLiveAction(
            `${key} · movida para In Progress`,
            issuesByKey.get(key)?.summary ?? "",
            issueUrl(config, key),
          );
        }
      },
    },
    codeHost: {
      listPullRequests: async () => {
        const prs = await listOpenPullRequests(bitbucketCredentials, bitbucket.repos);
        for (const pr of prs) titles.set(prSubject(pr), pr.title);
        // Only the PRs the user may review: a conflicted one isn't worth a review session.
        const candidates = prs.filter(
          (pr) =>
            pr.authorId !== config.me &&
            pr.reviewers.some((r) => r.id === config.me && r.state !== "approved"),
        );
        await markConflicts(candidates, bitbucket.localRepos ?? {}).catch((err: unknown) =>
          console.warn("[board-watcher] Couldn't check PR conflicts:", err),
        );
        return prs;
      },
      comment: async (pr, finding) => {
        if (live.comments) await commentOnPullRequest(bitbucketCredentials, pr, finding);
        const detail = `${finding.file ? `${finding.file}${finding.line ? `:${finding.line}` : ""} — ` : ""}${finding.body}`;
        await record({
          action: "comment",
          subject: prSubject(pr),
          title: pr.title,
          detail,
          ...(live.comments ? { live: true } : {}),
        });
        if (live.comments)
          noticeLiveAction(`${prSubject(pr)} · comentou`, detail, prUrl(config, pr));
      },
      approve: async (pr) => {
        if (live.approve) await approvePullRequest(bitbucketCredentials, pr);
        await record({
          action: "approve",
          subject: prSubject(pr),
          title: pr.title,
          ...(live.approve ? { live: true } : {}),
        });
        if (live.approve)
          noticeLiveAction(`${prSubject(pr)} · aprovou`, pr.title, prUrl(config, pr));
      },
    },
    reviewer: {
      review: async (pr) => {
        await record({ action: "review", subject: prSubject(pr) });
        onReview?.(pr);
        return null;
      },
    },
    notifier: {
      notify: async (level, title, text) => {
        await record({ action: "notify", subject: title, detail: `${level}: ${text}` });
        const weak = /^Weak description: (\S+)$/.exec(title)?.[1];
        const weakIssue = weak ? issuesByKey.get(weak) : undefined;
        if (weakIssue) onWeakDescription?.(weakIssue, text);
        if (level === "urgent") noticePause(title, text);
      },
    },
    tasks: {
      startedDevKeys: async () =>
        (await getQueue())
          .filter((e) => e.kind === "dev" && e.launchedAt)
          .sort((a, b) => (a.launchedAt ?? "").localeCompare(b.launchedAt ?? ""))
          .map((e) => e.key),
      enqueue: async (key, kind) => {
        const issue = issuesByKey.get(key);
        if (kind === "dev") {
          let detail: string | undefined;
          if (live.devQueue) {
            const repos = mentionedRepos(issue, bitbucket.localRepos ?? {});
            const added = await addDevEntryIfAbsent({
              key,
              link: issueUrl(config, key),
              repos,
              branchPrefix: await devBranchPrefix(issue),
            });
            detail = !added
              ? "já estava na fila"
              : repos.length
                ? undefined
                : "sem repo identificado: escolha o repo na fila";
          }
          await record({
            action: "enqueue-dev",
            subject: key,
            ...(detail ? { detail } : {}),
            ...(live.devQueue ? { live: true } : {}),
          });
          if (live.devQueue) {
            noticeLiveAction(
              `${key} · entrou na fila de dev`,
              detail ?? issue?.summary ?? "",
              issueUrl(config, key),
              detail?.startsWith("sem repo") ? "urgent" : "info",
            );
          }
          return;
        }
        if (kind === "retest") {
          // Already in Testing: nothing moves on the board, it only goes back to the test queue.
          await record({ action: "retest", subject: key });
          if (issue) onTest?.(issue, true);
          return;
        }
        await record({
          action: "claim-test",
          subject: key,
          ...(live.testClaim ? { live: true } : {}),
        });
        if (live.testClaim) {
          noticeLiveAction(
            `${key} · movida para Testing`,
            issue?.summary ?? "",
            issueUrl(config, key),
          );
        }
        if (issue) onTest?.(issue, false);
      },
    },
  };
}
