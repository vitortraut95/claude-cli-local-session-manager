import type { Session, TaskRepoRef } from "./session.js";

export type ProjectFolderOption = {
  path: string;
  label: string;
  /** In `recentProjectPaths` (vs. only found in a workspace dir). Only set by
   *  `getRecentProjectFolders`. */
  recent?: boolean;
};

export type RepoInfo = {
  repoRoot: string;
  defaultBaseBranch: string;
  /** A session is active with its working directory exactly at `repoRoot` (not a worktree) — the
   *  one case where checking the branch out in the root would collide. Drives the worktree
   *  checkbox's default. */
  hasActiveSessionInRoot: boolean;
};

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

export type AddRepoStep = "repo" | "base" | "worktree";

export type AddRepoInput = {
  folderPath: string;
  /** Blank = the branch name the task already uses in its other repos. */
  branchName: string;
  /** Blank = the repo's default branch. */
  baseBranch: string;
  useLocalBranch: boolean;
  /** Missing/null = a worktree only when the root already has an active session. */
  useWorktree?: boolean | null;
  taskLink: string | null;
};

export type AddRepoResult = {
  repoRoot: string;
  branch: string;
  baseBranch: string;
  /** Where the branch is checked out (worktree or the repo root) — what to `/add-dir`. */
  workingDirectory: string;
  /** What the new worktree got from the repo's `worktreeSetup`. */
  setup: WorktreeSetupResult;
  completedSteps: AddRepoStep[];
  task: TaskDetails;
};

export type WorktreeSetupResult = {
  /** Worktree-relative `node_modules` paths now linked to the main checkout's. */
  linked: string[];
  /** Worktree-relative `.env*` files copied over. */
  copied: string[];
};

/** "dev" = develop the task (new branch and worktree); "test" = test someone else's branch. */
export type QueueKind = "dev" | "test";

export type QueueEntry = {
  key: string;
  link: string | null;
  kind: QueueKind;
  repos: string[];
  /** No repo on purpose: the session opens in the first workspace dir, with no branch. */
  noRepo: boolean;
  /** The task branch is `<prefix>/<key>`; "" = just `<key>`; null = not chosen yet (not
   *  launched until it is). */
  branchPrefix: string | null;
  /** Test only: the branch to test; null = the one on origin whose name has the key. */
  branch: string | null;
  /** Dev only: what the task branch starts from in the main repo; null = the repo's default.
   *  `useLocalBaseBranch` takes the local branch instead of a freshly fetched origin one. */
  baseBranch: string | null;
  useLocalBaseBranch: boolean;
  addedAt: string;
  launchedAt: string | null;
  sessionId: string | null;
  error: string | null;
};

/** What the queue modal saves; the launch fields are only ever set by the scheduler. */
export type QueueEntryInput = Pick<
  QueueEntry,
  | "key"
  | "link"
  | "kind"
  | "repos"
  | "noRepo"
  | "branchPrefix"
  | "branch"
  | "baseBranch"
  | "useLocalBaseBranch"
  | "error"
>;

export type SchedulerBlock =
  "paused" | "max_sessions" | "recent_launch" | "low_memory" | "memory_pressure" | "usage_limit";

export type SchedulerStatus = {
  enabled: boolean;
  activeSessions: number;
  maxSessions: number;
  freeMemoryPercent: number | null;
  minFreeMemoryPercent: number;
  memoryPressure: number | null;
  /** Highest Claude plan limit in use; null when it couldn't be read (not a block then). */
  usagePercent: number | null;
  maxUsagePercent: number;
  /** Entries ready to launch (repo and branch prefix chosen, not launched, no error). */
  waiting: number;
  /** Why nothing would launch right now; null = there's room. */
  blockedBy: SchedulerBlock | null;
  /** An entry being launched at this moment, if any. */
  launching: string | null;
  /** Every entry being launched (the tick's and any "Start now"). */
  launchingKeys: string[];
};

export type HeavyRunHookStatus = {
  installed: boolean;
  settingsPath: string;
  /** What `heavy-run` is called as — the path the hook tells Claude to use. */
  heavyRunPath: string;
};

export type UsagePauseHookStatus = { installed: boolean };

/** What the usage-pause hook asks before each tool call: wait (and why) or go ahead. */
export type UsageGate = { pause: boolean; reason: string | null };
