import { getDefaultBaseBranch } from "../utils/git.js";
import { AppError, BadRequestError } from "../utils/httpError.js";
import { isTaskKey, normalizeTaskKey } from "../utils/taskKeys.js";
import { getTaskStore, linkRepoBranchToTask, upsertTask } from "../utils/taskStore.js";
import type { Session, TaskRepoRef } from "../types/session.js";
import { collectTaskRepos } from "../utils/taskRepos.js";
import { buildPrUrl, listSessions, SessionNotFoundError } from "./sessionService.js";
import { createTaskWorktree, getRepoInfo, resolveBaseBranch } from "./taskService.js";

/**
 * Tasks that span several repos: one ticket key (`PROJ-123`) grouping branches in different repos.
 * Each repo keeps its own branch, base, PR and session; this records that they belong together and
 * adds repos to a task.
 */

export type TaskRepo = TaskRepoRef & { defaultBranch: string | null };

type TaskSessionSummary = Pick<
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
  return new BadRequestError("TASK_INVALID_KEY", `"${raw}" isn't a ticket key (e.g. PROJ-123).`);
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

/** "Open PR" for a task repo that may have no session; only for a repo/branch of the task, so
 *  the route can't be pointed at an arbitrary folder. */
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

type SessionTask = {
  sessionId: string;
  taskKey: string | null;
  taskKeyInferred: boolean;
  task: TaskDetails | null;
};

/** What a CLI skill asks first: "which task is this session part of, and where are the others?" */
export async function getSessionTask(id: string): Promise<SessionTask> {
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
 * A blank `rawKey` clears the saved key (inferred from the branch again). The session id is only
 * shape-checked, since a session can be linked right after launch, before it's listed.
 */
export async function setSessionTask(
  id: string,
  rawKey: string,
  link: string | null,
): Promise<void> {
  const session = (await listSessions()).find((s) => s.id === id);
  if (!session) throw new SessionNotFoundError(id);
  if (!session.repoRoot || !session.gitBranch) {
    throw new BadRequestError(
      "TASK_SESSION_HAS_NO_BRANCH",
      "This session isn't on a git branch, so it can't be linked to a task.",
    );
  }
  // Blank = unlink the branch, back to inferring the key from it.
  const key = rawKey.trim() === "" ? null : parseTaskKeyParam(rawKey);
  if (key) await upsertTask(key, link);
  await linkRepoBranchToTask(session.repoRoot, session.gitBranch, key);
}

export async function setTaskLink(key: string, link: string): Promise<void> {
  await upsertTask(key, link);
}

export type AddRepoStep = "repo" | "base" | "worktree";

/** Carries which step failed and which had already finished — nothing is rolled back. */
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

  override get status(): number {
    return this.cause instanceof AppError ? this.cause.status : 500;
  }

  override body(): Record<string, unknown> {
    return { failedStep: this.step, completedSteps: this.completedSteps };
  }
}

export type AddRepoInput = {
  folderPath: string;
  /** Blank = the branch name the task already uses in its other repos. */
  branchName: string;
  /** Blank = the repo's default branch. */
  baseBranch: string;
  useLocalBranch: boolean;
  /** null = a worktree only when the root already has an active session. */
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

/** Creates the task's branch in another repo and links it to the task. Opens no session: the repo
 *  joins the task's existing one via `/add-dir <path>` or `--add-dir`. */
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
      new BadRequestError(
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
