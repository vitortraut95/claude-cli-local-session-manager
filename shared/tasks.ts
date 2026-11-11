import type { Session, TaskRepoRef } from "./session.js";

/** "Refine tasks" modal: the pasted tickets (links or keys, one or more per line, any text around
 *  them), a sprint name and free-form notes appended to the prompt. All optional: with no tickets
 *  nor sprint the skill offers the team's open and upcoming sprints. */
export type RefinementInput = {
  tasks: string;
  notes: string;
  sprint?: string;
  /** Skip the technical round with the devs and go straight to the PO comments. */
  directToPo?: boolean;
};

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
/** dev = develop the ticket; test = test its branch; review = the AI code review of a pull
 *  request (`key` is its `repo#id`, `link` its page). */
export type QueueKind = "dev" | "test" | "review";

/** A ticket done together with the entry's own, in the same branch and session. */
export type QueueGroupedTask = { key: string; link: string | null };

export type QueueEntry = {
  key: string;
  link: string | null;
  /** Other tickets delivered with this one: the branch, worktree and session are the entry's
   *  (named after `key`); the prompt lists every link. Optional for an older backend (= none). */
  groupedTasks?: QueueGroupedTask[];
  kind: QueueKind;
  repos: string[];
  /** No repo on purpose: the session opens in the first workspace dir, with no branch. */
  noRepo: boolean;
  /** Dev only: spans several repos, found by the session in the ticket. It opens in the first
   *  workspace dir and makes the task branch in each repo itself. Optional for an older backend. */
  multiRepo?: boolean;
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
  | "groupedTasks"
  | "kind"
  | "repos"
  | "noRepo"
  | "multiRepo"
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
