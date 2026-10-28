/** In the order a task moves through them. */
export const WORK_STATUSES = ["todo", "in_progress", "waiting_user", "done"] as const;
/** Hand-set work status of a session or task. */
export type WorkStatus = (typeof WORK_STATUSES)[number];
/** The ones a test session can take: waiting keeps its worktrees for a re-test, done removes them. */
export const TEST_WORK_STATUSES: readonly WorkStatus[] = ["in_progress", "waiting_user", "done"];

export type Session = {
  id: string;
  title: string;
  nickname: string | null;
  project: string;
  path: string;
  /** Session's original working directory, as logged by the CLI; null when no `cwd` was logged. */
  workingDirectory: string | null;
  /** Git branch logged by the CLI; null when none was logged or it's not a git repo. */
  gitBranch: string | null;
  /** True when workingDirectory is a linked git worktree; false when missing or not a git repo. */
  isWorktree: boolean;
  updatedAt: string;
  prompts: string[];
  isActive: boolean;
  directoryMissing: boolean;
  /** Set when directoryMissing and workingDirectory was a `<repoRoot>/.claude/worktrees/<name>`
   *  whose repo root still exists. */
  missingWorktreeRepoRoot: string | null;
  /** Size of the session's `.jsonl` file in bytes. */
  sizeBytes: number;
  /** Base branch recorded in `tasks.json` (`repoBranches`) for a "New task" branch; only set when
   *  it differs from the repo's default. */
  baseBranch: string | null;
  /** True when the session ran in this app's own repo (or one of its worktrees). Optional: an
   *  older backend omits it (= false). */
  isAppRepo?: boolean;
  /** Base/task branches saved in `tasks.json` (`sessions`); take precedence in
   *  `resolveSessionBranches`. Optional: an older backend omits them (= null). */
  savedOriginBranch?: string | null;
  savedDestinationBranch?: string | null;
  /** The repo's default branch (`getDefaultBaseBranch`). Optional: an older backend omits it. */
  defaultBranch?: string | null;
  /** The repo's main checkout (also for a linked worktree); null outside a git repo. Optional: an
   *  older backend omits it. */
  repoRoot?: string | null;
  /** Ticket key of the session's task (`PROJ-123`), saved or inferred from the task branch
   *  (`taskKeyInferred`). Optional: an older backend omits it. */
  taskKey?: string | null;
  taskKeyInferred?: boolean;
  /** Ticket key a test session (launched from the queue) tests; its status is then only
   *  in_progress/done. Optional: an older backend omits it. */
  testKey?: string | null;
  /** Every repo/branch of that task, this session's included. Only set when `taskKey` is. */
  taskRepos?: TaskRepoRef[];
  /** Hand-set work status: the task's when the session has a key, else the session's own. */
  status?: WorkStatus | null;
  /** `history.jsonl` has events tied to this session or its task (the card's "info"). */
  hasHistory?: boolean;
  /** Local preview servers (docker containers / listening processes) serving this session's
   *  folder or its task's worktrees — the card's URLs. */
  previews?: SessionPreview[];
};

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

/** One repo/branch of a multi-repo task (`server/utils/taskRepos.ts`). */
export type TaskRepoRef = {
  repoRoot: string;
  project: string;
  branch: string;
  /** Recorded only when it differs from the repo's default. */
  baseBranch: string | null;
  /** The repo's default branch (the base when `baseBranch` is null); null = unknown. */
  defaultBranch?: string | null;
  /** The linked worktree the branch lives in; null = the repo root, or not known. */
  worktreePath: string | null;
  /** True when linked in `tasks.json`; false when only implied by a session's (inferred) key. */
  recorded: boolean;
  sessionIds: string[];
};

/** One local folder an imported session could land in — see `inspectSessionBundle`
 *  (`server/services/sessionTransferService.ts`). */
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

/** Returned by `POST /sessions/import/inspect` — what's inside an exported session file, plus
 *  where it could go on this machine, before anything is written. */
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
  /** The local session that already has this id, if any — importing then needs an explicit
   *  overwrite-or-copy choice (`onConflict`). */
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

export type ImportConflictResolution = "overwrite" | "copy";

export type ResumeOpenResult = {
  resumed: { id: string; taskKey: string | null }[];
  /** Left out because the session limit (`orchestrator.maxSessions`) was reached. */
  skippedForLimit: number;
  failed: { id: string; message: string }[];
};

export type ScanProgress = { total: number; done: number; scanning: boolean };

export type HistoryEvent = { ts: string; type: string } & Record<string, unknown>;

export type HistorySummary = {
  /** From entering the queue to its session opening. */
  queuedMs: number | null;
  /** Scheduler blocks (any task's) while this one was waiting in line, by reason. */
  queueBlocks: { reason: string; durationMs: number }[];
  /** Time spent in each status, from its changes up to now. */
  statusMs: Record<string, number>;
  currentStatus: string | null;
  /** First event to "done", when it got there. */
  totalMs: number | null;
  heavyRuns: number;
  heavyFailed: number;
  heavyOverCap: number;
  heavySlotWaitS: number;
  heavyMemoryWaitS: number;
  heavyDurationS: number;
  heavyBlocked: number;
  errors: { ts: string; type: string; message: string }[];
};
