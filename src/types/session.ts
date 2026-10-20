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
  /** Sum of the transcript's `turn_duration` entries. */
  activeTimeMs: number;
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
  /** Every repo/branch of that task, this session's included. Only set when `taskKey` is. */
  taskRepos?: TaskRepoRef[];
  /** The task's status when `taskKey` is set, else the session's own; null = never set.
   *  Optional: older backend. */
  status?: WorkStatus | null;
  /** `history.jsonl` has events tied to this session or its task (the card's "info"). Optional:
   *  older backend. */
  hasHistory?: boolean;
};

/** One repo/branch of a multi-repo task — mirrors `server/utils/taskRepos.ts`. */
export type TaskRepoRef = {
  repoRoot: string;
  project: string;
  branch: string;
  /** Recorded only when it differs from the repo's default. */
  baseBranch: string | null;
  /** The linked worktree the branch lives in; null = the repo root, or not known. */
  worktreePath: string | null;
  /** True when linked in `tasks.json`; false when only implied by a session's (inferred) key. */
  recorded: boolean;
  sessionIds: string[];
};

export type WorktreeToRootFileDiff = {
  added: string[];
  modified: string[];
  removed: string[];
};

/** `GET /sessions/:id/worktree-to-root-preview` — the "worktree → root" modal's preview. */
export type WorktreeToRootPreview = {
  repoRoot: string;
  /** Null for a detached HEAD. */
  rootBranch: string | null;
  worktreeBranch: string | null;
  /** Uncommitted files in the root checkout — what "reset root" stashes. */
  rootDirtyFiles: string[];
  /** Filesystem diff of the two working trees (not git history); used by "copy" mode. */
  fileDiff: WorktreeToRootFileDiff;
  rootHasActiveSession: boolean;
  worktreeHasActiveSession: boolean;
  /** Another task already holding the root (files copied or branch moved there); bringing this
   *  worktree is refused until it's released. Optional: older backend. */
  rootLock?: {
    mode: "copy" | "checkout";
    branch: string;
    taskKey: string | null;
    worktreePath: string | null;
    since: string;
  } | null;
};

/** `GET /sessions/:id/worktree-to-root/root-status` — root's branch and dirty files, without the
 *  preview's file diff. */
export type RootStatus = {
  repoRoot: string;
  rootBranch: string | null;
  rootDirtyFiles: string[];
  /** Stashes created by "reset root" in this repo, newest first. */
  appStashes: { sha: string; message: string }[];
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
