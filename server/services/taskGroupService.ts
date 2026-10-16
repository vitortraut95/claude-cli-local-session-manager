import path from "node:path";
import { branchExists, getDefaultBaseBranch, listWorktrees } from "../utils/git.js";
import { AppError } from "../utils/httpError.js";
import { isTaskKey, normalizeTaskKey } from "../utils/taskKeys.js";
import {
  getTaskStore,
  linkRepoBranchToTask,
  setSessionTaskKey,
  upsertTask,
} from "../utils/taskStore.js";
import type { Session, TaskRepoRef } from "../types/session.js";
import { collectTaskRepos } from "../utils/taskRepos.js";
import {
  buildPrUrl,
  isSafeSessionId,
  listSessions,
  SessionNotFoundError,
} from "./sessionService.js";
import {
  createTaskWorktree,
  getRepoInfo,
  launchTaskTerminal,
  resolveBaseBranch,
} from "./taskService.js";

/**
 * Tasks that span several repos: one ticket key (`PROJ-123`) grouping branches in different repos
 * and the sessions working on them. Each repo keeps its own branch, base, PR and session — this
 * only records that they belong together (`tasks.json`, see `taskStore.ts`) and adds repos to a
 * task after the fact, which is the usual case: a site task turns out to need a cart change
 * halfway through. Same route for the card's "+ repo" and for a CLI skill calling the local API.
 */

export type TaskRepo = TaskRepoRef & { defaultBranch: string | null };

export type TaskSessionSummary = Pick<
  Session,
  | "id"
  | "title"
  | "nickname"
  | "workingDirectory"
  | "gitBranch"
  | "isActive"
  | "updatedAt"
  | "repoRoot"
  | "taskKeyInferred"
>;

export type TaskDetails = {
  key: string;
  link: string | null;
  repos: TaskRepo[];
  sessions: TaskSessionSummary[];
};

function invalidTaskKeyError(raw: string): AppError {
  return new AppError("TASK_INVALID_KEY", `"${raw}" isn't a ticket key (e.g. PROJ-123).`);
}

/** Route param → canonical key; accepts a ticket URL too, so a skill can pass whatever it has. */
export function parseTaskKeyParam(raw: string): string {
  const key = normalizeTaskKey(raw);
  if (!key || !isTaskKey(key)) throw invalidTaskKeyError(raw);
  return key;
}

/** Never throws for an unknown key — an empty task is a valid answer ("nothing linked yet"). */
export async function getTaskDetails(key: string, sessions?: Session[]): Promise<TaskDetails> {
  const [store, allSessions] = await Promise.all([getTaskStore(), sessions ?? listSessions()]);
  const taskSessions = allSessions.filter((s) => s.taskKey === key);
  const defaultByRoot = new Map(
    taskSessions.filter((s) => s.repoRoot).map((s) => [s.repoRoot, s.defaultBranch ?? null]),
  );
  const repos: TaskRepo[] = (collectTaskRepos(store, allSessions).get(key) ?? []).map((repo) => ({
    ...repo,
    defaultBranch: defaultByRoot.get(repo.repoRoot) ?? null,
  }));
  // Recorded repos with no session yet still need a default branch to show a base.
  await Promise.all(
    repos
      .filter((repo) => repo.defaultBranch === null)
      .map(async (repo) => {
        repo.defaultBranch = await getDefaultBaseBranch(repo.repoRoot).catch(() => null);
      }),
  );

  return {
    key,
    link: store.tasks[key]?.link ?? null,
    repos,
    sessions: taskSessions.map((s) => ({
      id: s.id,
      title: s.title,
      nickname: s.nickname,
      workingDirectory: s.workingDirectory,
      gitBranch: s.gitBranch,
      isActive: s.isActive,
      updatedAt: s.updatedAt,
      repoRoot: s.repoRoot ?? null,
      taskKeyInferred: s.taskKeyInferred ?? false,
    })),
  };
}

/** "Open PR" for a task repo that may have no session of its own — only for a repo/branch that
 *  actually belongs to the task, so the route can't be pointed at an arbitrary folder. */
export async function getTaskRepoPrUrl(
  key: string,
  repoRoot: string,
  branch: string,
  base: string,
): Promise<string | null> {
  const { repos } = await getTaskDetails(key);
  const repo = repos.find((r) => r.repoRoot === repoRoot && r.branch === branch);
  if (!repo) {
    throw new AppError("TASK_REPO_NOT_FOUND", `${branch} in ${repoRoot} isn't part of ${key}.`);
  }
  return buildPrUrl(repo.worktreePath ?? repo.repoRoot, repo.branch, base.trim());
}

export type SessionTask = {
  sessionId: string;
  taskKey: string | null;
  taskKeyInferred: boolean;
  task: TaskDetails | null;
};

/** What a CLI skill asks first: "which task is this session part of, and where are the others?" */
export async function getSessionTask(id: string): Promise<SessionTask> {
  if (!isSafeSessionId(id)) throw new SessionNotFoundError(id);
  const sessions = await listSessions();
  const session = sessions.find((s) => s.id === id);
  if (!session) throw new SessionNotFoundError(id);
  const taskKey = session.taskKey ?? null;
  return {
    sessionId: id,
    taskKey,
    taskKeyInferred: session.taskKeyInferred ?? false,
    task: taskKey ? await getTaskDetails(taskKey, sessions) : null,
  };
}

/**
 * `rawKey` null = back to inferring it from the branch/nickname; "" = explicitly no task; anything
 * else must contain a ticket key. A session can be linked before it exists in the list (e.g. right
 * after a launch), so the id isn't looked up — only checked for shape.
 */
export async function setSessionTask(
  id: string,
  rawKey: string | null,
  link: string | null,
): Promise<void> {
  if (!isSafeSessionId(id)) throw new SessionNotFoundError(id);
  if (rawKey === null || rawKey.trim() === "") {
    await setSessionTaskKey(id, rawKey === null ? null : "");
    return;
  }
  const key = parseTaskKeyParam(rawKey);
  await upsertTask(key, link);
  await setSessionTaskKey(id, key);
}

export async function setTaskLink(key: string, link: string): Promise<void> {
  await upsertTask(key, link);
}

export type AddRepoStep = "repo" | "base" | "worktree" | "link" | "launch";

/** Carries which step failed and which had already finished — nothing is rolled back, so the
 *  caller can tell the user exactly what exists now (same idea as "New task"'s step list). */
export class TaskStepError extends AppError {
  constructor(
    public readonly step: AddRepoStep,
    public readonly completedSteps: AddRepoStep[],
    cause: unknown,
  ) {
    super(
      cause instanceof AppError ? cause.code : "TASK_STEP_FAILED",
      cause instanceof Error ? cause.message : String(cause),
      { cause },
    );
    this.name = "TaskStepError";
  }
}

export type AddRepoInput = {
  folderPath: string;
  /** "create" = new branch (+ worktree); "link-existing" = the branch already exists there. */
  mode: "create" | "link-existing";
  /** Blank = the branch name the task already uses in its other repos. */
  branchName: string;
  /** Blank = the repo's default branch. Only used by "create". */
  baseBranch: string;
  useLocalBranch: boolean;
  /** null = same smart default as "New task": a worktree only when the root already has an
   *  active session. Only used by "create". */
  useWorktree: boolean | null;
  /** Open a terminal with a new session there. Otherwise only the git work + link happen (e.g.
   *  to `/add-dir` the path into an already-open session instead). */
  launch: boolean;
  prompt: string;
  /** Prepend a short note telling the new session which other repos/branches the task spans. */
  includeTaskContext: boolean;
  permissionModeAuto: boolean;
  nickname: string;
  taskLink: string | null;
};

export type AddRepoResult = {
  repoRoot: string;
  branch: string;
  baseBranch: string | null;
  /** Where the branch is checked out (worktree or the repo root); null when "link-existing"
   *  found it checked out nowhere. */
  workingDirectory: string | null;
  sessionId: string | null;
  completedSteps: AddRepoStep[];
  task: TaskDetails;
};

function taskContextNote(task: TaskDetails, link: string | null, exceptRoot: string): string {
  const others = task.repos.filter((repo) => repo.repoRoot !== exceptRoot);
  const header = `This is part of task ${task.key}${link ? ` (${link})` : ""}, which spans several repos.`;
  if (others.length === 0) return header;
  const lines = others.map(
    (repo) => `- ${repo.project}: branch ${repo.branch}, at ${repo.worktreePath ?? repo.repoRoot}`,
  );
  return `${header} The other parts:\n${lines.join("\n")}`;
}

export async function addRepoToTask(key: string, input: AddRepoInput): Promise<AddRepoResult> {
  const completed: AddRepoStep[] = [];
  async function step<T>(name: AddRepoStep, run: () => Promise<T>): Promise<T> {
    try {
      const result = await run();
      completed.push(name);
      return result;
    } catch (err) {
      throw new TaskStepError(name, [...completed], err);
    }
  }

  const before = await getTaskDetails(key);
  const link = input.taskLink?.trim() ? input.taskLink.trim() : before.link;
  const branch = input.branchName.trim()
    ? input.branchName.trim()
    : (before.repos[0]?.branch ?? "");
  if (!branch) {
    throw new TaskStepError(
      "repo",
      [],
      new AppError(
        "TASK_BRANCH_NAME_REQUIRED",
        "A branch name is required (the task has no other repo to copy it from).",
      ),
    );
  }

  const repo = await step("repo", () => getRepoInfo(input.folderPath));
  const { repoRoot } = repo;
  let workingDirectory: string | null;
  let baseBranch: string | null = null;

  if (input.mode === "create") {
    const base = input.baseBranch.trim() || repo.defaultBaseBranch;
    const { baseBranchRef } = await step("base", () =>
      resolveBaseBranch(repoRoot, base, input.useLocalBranch),
    );
    const { worktreePath } = await step("worktree", () =>
      createTaskWorktree(
        repoRoot,
        branch,
        baseBranchRef,
        base,
        input.useWorktree ?? repo.hasActiveSessionInRoot,
        key,
        link,
      ),
    );
    workingDirectory = worktreePath;
    baseBranch = base;
  } else {
    workingDirectory = await step("link", async () => {
      if (!(await branchExists(repoRoot, branch))) {
        throw new AppError(
          "TASK_BRANCH_NOT_FOUND",
          `Branch "${branch}" doesn't exist in ${path.basename(repoRoot)}.`,
        );
      }
      const checkedOutAt =
        (await listWorktrees(repoRoot)).find((entry) => entry.branch === branch)?.path ?? null;
      await upsertTask(key, link);
      await linkRepoBranchToTask(
        repoRoot,
        branch,
        key,
        checkedOutAt && checkedOutAt !== repoRoot ? checkedOutAt : null,
      );
      return checkedOutAt;
    });
  }

  let sessionId: string | null = null;
  if (input.launch) {
    const launchDir = workingDirectory;
    sessionId = await step("launch", async () => {
      if (!launchDir) {
        throw new AppError(
          "TASK_BRANCH_NOT_CHECKED_OUT",
          `Branch "${branch}" isn't checked out anywhere in ${path.basename(repoRoot)} — check it ` +
            `out (or create it with a worktree) before opening a session there.`,
        );
      }
      const sessions = await listSessions();
      if (sessions.some((s) => s.workingDirectory === launchDir && s.isActive)) {
        throw new AppError(
          "TASK_DIRECTORY_BUSY",
          `A session is already active in ${launchDir} — continue there instead.`,
        );
      }
      const context = input.includeTaskContext
        ? taskContextNote(await getTaskDetails(key, sessions), link, repoRoot)
        : "";
      const prompt = [context, input.prompt.trim()].filter(Boolean).join("\n\n");
      const result = await launchTaskTerminal({
        worktreePath: launchDir,
        prompt,
        permissionModeAuto: input.permissionModeAuto,
        repoRoot,
        nickname: input.nickname,
        originBranch: baseBranch ?? "",
        destinationBranch: branch,
        taskKey: key,
      });
      return result.sessionId;
    });
  }

  return {
    repoRoot,
    branch,
    baseBranch,
    workingDirectory,
    sessionId,
    completedSteps: completed,
    task: await getTaskDetails(key),
  };
}

/** Only drops the link — the branch, worktree and sessions stay. A session whose own key was set
 *  by hand keeps it (unlink that on the session itself). */
export async function unlinkRepoFromTask(
  key: string,
  repoRoot: string,
  branch: string,
): Promise<void> {
  const store = await getTaskStore();
  if (store.repoBranches[repoRoot]?.[branch]?.taskKey !== key) return;
  await linkRepoBranchToTask(repoRoot, branch, null);
}
