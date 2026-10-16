import { getDefaultBaseBranch } from "../utils/git.js";
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
import { createTaskWorktree, getRepoInfo, resolveBaseBranch } from "./taskService.js";

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
 * A blank `rawKey` clears the saved key (it's then inferred from the branch again); anything else
 * must contain a ticket key. A session can be linked before it exists in the list (e.g. right
 * after a launch), so the id isn't looked up — only checked for shape.
 */
export async function setSessionTask(
  id: string,
  rawKey: string,
  link: string | null,
): Promise<void> {
  if (!isSafeSessionId(id)) throw new SessionNotFoundError(id);
  if (rawKey.trim() === "") {
    await setSessionTaskKey(id, null);
    return;
  }
  const key = parseTaskKeyParam(rawKey);
  await upsertTask(key, link);
  await setSessionTaskKey(id, key);
}

export async function setTaskLink(key: string, link: string): Promise<void> {
  await upsertTask(key, link);
}

export type AddRepoStep = "repo" | "base" | "worktree";

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
  /** Blank = the branch name the task already uses in its other repos. */
  branchName: string;
  /** Blank = the repo's default branch. */
  baseBranch: string;
  useLocalBranch: boolean;
  /** null = same smart default as "New task": a worktree only when the root already has an
   *  active session. */
  useWorktree: boolean | null;
  taskLink: string | null;
};

export type AddRepoResult = {
  repoRoot: string;
  branch: string;
  baseBranch: string;
  /** Where the branch is checked out (worktree or the repo root) — what to `/add-dir`. */
  workingDirectory: string;
  completedSteps: AddRepoStep[];
  task: TaskDetails;
};

/**
 * Creates the task's branch in another repo and links it to the task. Deliberately doesn't open a
 * session: the repo is meant to join one already working on the task (`/add-dir <path>`), or the
 * "New task" one via `--add-dir` — one session per task, not one per repo.
 */
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
  const base = input.baseBranch.trim() ? input.baseBranch.trim() : repo.defaultBaseBranch;
  const { baseBranchRef } = await step("base", () =>
    resolveBaseBranch(repo.repoRoot, base, input.useLocalBranch),
  );
  const { worktreePath } = await step("worktree", () =>
    createTaskWorktree(
      repo.repoRoot,
      branch,
      baseBranchRef,
      base,
      input.useWorktree ?? repo.hasActiveSessionInRoot,
      key,
      link,
    ),
  );

  return {
    repoRoot: repo.repoRoot,
    branch,
    baseBranch: base,
    workingDirectory: worktreePath,
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
