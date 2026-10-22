/** Hand-set work status — mirrors `WORK_STATUSES` in `server/utils/taskStore.ts`. */
export type WorkStatus = "todo" | "in_progress" | "waiting_user" | "done";

export type Session = {
  id: string;
  title: string;
  nickname: string | null;
  project: string;
  path: string;
  /** Working directory logged by the CLI; null when the transcript has no `cwd`. */
  workingDirectory: string | null;
  /** Last branch logged in the transcript; null when none was logged or outside a git repo. */
  gitBranch: string | null;
  /** workingDirectory is a linked git worktree (false when missing or not in a git repo). */
  isWorktree: boolean;
  updatedAt: string;
  prompts: string[];
  isActive: boolean;
  directoryMissing: boolean;
  /** Set when directoryMissing and the path was `<repoRoot>/.claude/worktrees/<name>` with
   *  `repoRoot` still on disk. */
  missingWorktreeRepoRoot: string | null;
  /** Size of the session's `.jsonl` file. */
  sizeBytes: number;
  /** Base branch recorded by "New task" (`tasks.json` `repoBranches`); only set when it differs
   *  from the repo's default. */
  baseBranch: string | null;
  /** Session ran in this app's own repo (hides Jenkins/PR buttons). Optional: older backend. */
  isAppRepo?: boolean;
  /** Base/task branches saved in `tasks.json`; see `resolveSessionBranches`. Optional: older
   *  backend. */
  savedOriginBranch?: string | null;
  savedDestinationBranch?: string | null;
  /** The repo's default branch (`origin/HEAD`, else main/master). Optional: older backend. */
  defaultBranch?: string | null;
  /** The repo's main checkout (the worktree's, for a linked worktree); null outside a git repo.
   *  Optional: absent from an older backend. */
  repoRoot?: string | null;
  /** Ticket key of the session's task (`PROJ-123`), saved or inferred from the task branch
   *  (`taskKeyInferred`). Optional: older backend. */
  taskKey?: string | null;
  taskKeyInferred?: boolean;
  /** Ticket key a test session (launched from the queue) tests; its status is then only
   *  in_progress/done. Optional: an older backend omits it. */
  testKey?: string | null;
  /** Every repo/branch of that task, this session's included. Only set when `taskKey` is. */
  taskRepos?: TaskRepoRef[];
  /** The task's status when `taskKey` is set, else the session's own; null = never set.
   *  Optional: older backend. */
  status?: WorkStatus | null;
  /** `history.jsonl` has events tied to this session or its task (the card's "info"). Optional:
   *  older backend. */
  hasHistory?: boolean;
  /** Local preview servers serving this session's folder or its task's worktrees. Optional:
   *  older backend. */
  previews?: SessionPreview[];
};

/** Mirrors `server/types/session.ts`. */
export type SessionPreview = {
  kind: "docker" | "process";
  /** Container name, or pid. */
  id: string;
  name: string;
  port: number;
  url: string;
  /** Serves a task worktree (stoppable from the card), not a repo's main checkout. */
  inWorktree: boolean;
  /** false = a task worktree's stopped container, which the card can start again. Optional:
   *  older backend (always running). */
  running?: boolean;
};

/** One repo/branch of a multi-repo task — mirrors `server/utils/taskRepos.ts`. */
export type TaskRepoRef = {
  repoRoot: string;
  project: string;
  branch: string;
  /** Recorded only when it differs from the repo's default. */
  baseBranch: string | null;
  /** The repo's default branch (the base when `baseBranch` is null); null = unknown. Optional:
   *  older backend. */
  defaultBranch?: string | null;
  /** The linked worktree the branch lives in; null = the repo root, or not known. */
  worktreePath: string | null;
  /** True when linked in `tasks.json`; false when only implied by a session's (inferred) key. */
  recorded: boolean;
  sessionIds: string[];
};

/** One local folder an imported session could land in. */
export type SessionImportCandidate = {
  /** A known repo root on this machine. */
  repoRoot: string;
  /** `repoRoot` + the exported session's cwd relative to its own repo top level, when that
   *  subfolder exists here; `repoRoot` itself otherwise. */
  targetCwd: string;
  /** This clone's `origin` matches the exported session's (SSH/HTTPS-insensitive). */
  remoteMatches: boolean;
  currentBranch: string | null;
  branchExistsLocally: boolean;
  commitExistsLocally: boolean;
  hasActiveSession: boolean;
};

/** `POST /sessions/import/inspect` — an exported session's contents and local candidates. */
export type SessionImportPreview = {
  sessionId: string;
  title: string;
  nickname: string | null;
  gitBranch: string | null;
  isWorktree: boolean;
  originalCwd: string | null;
  remoteUrl: string | null;
  commit: string | null;
  exportedAt: string;
  updatedAt: string;
  sizeBytes: number;
  subagentCount: number;
  /** Local session with the same id, if any — importing then needs `onConflict`. */
  existingSession: {
    title: string;
    nickname: string | null;
    updatedAt: string;
    sizeBytes: number;
    workingDirectory: string | null;
    gitBranch: string | null;
    isActive: boolean;
  } | null;
  candidates: SessionImportCandidate[];
};

export type SessionImportResult = {
  sessionId: string;
  workingDirectory: string;
  importedAsCopy: boolean;
  overwritten: boolean;
  checkedOutBranch: string | null;
};
