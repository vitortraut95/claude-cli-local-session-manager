export type SubagentDetail = {
  agentId: string;
  agentType: string | null;
  description: string | null;
  resultText: string | null;
  startedAt: string | null;
  endedAt: string | null;
};

export type Session = {
  id: string;
  title: string;
  nickname: string | null;
  project: string;
  path: string;
  /** Session's original working directory, as logged by the CLI. Null when older transcripts
   *  didn't log a `cwd` — matches the same fallback used for directoryMissing. */
  workingDirectory: string | null;
  /** Git branch checked out in workingDirectory when the CLI logged the entry. Null when older
   *  transcripts didn't log a `gitBranch`, or the session wasn't started inside a git repo. */
  gitBranch: string | null;
  /** True when workingDirectory is a linked git worktree rather than a repo's main checkout —
   *  powers the "Delete worktree" action. False (not null) when workingDirectory is missing or
   *  isn't inside a git repo at all, same as gitBranch's "no info" case collapsing to a falsy value. */
  isWorktree: boolean;
  updatedAt: string;
  prompts: string[];
  isActive: boolean;
  directoryMissing: boolean;
  /** Only set when directoryMissing and the original workingDirectory looked like this app's own
   *  `<repoRoot>/.claude/worktrees/<name>` convention, and that repo root still exists on disk —
   *  lets the UI offer to continue work there once the worktree itself is gone. */
  missingWorktreeRepoRoot: string | null;
  /** Size of the session's own `.jsonl` file in bytes — powers the "session size" meter. */
  sizeBytes: number;
  /** Number of subagents (via the Agent tool) spawned during this session. */
  subagentCount: number;
  /** Sum of the CLI's own `turn_duration` entries — actual time spent processing, a more honest
   *  signal than `updatedAt` (the file's mtime, which only says when it was last written). */
  activeTimeMs: number;
  /** The branch this session's worktree was branched off, from this app's own
   *  `tasks.json` sidecar (`repoBranches`) — only ever set for a "New task"-created worktree whose
   *  chosen base branch differed from the repo's own default (main/master or whatever `origin/HEAD`
   *  resolves to). Null for every other session, including a worktree branched off the default.
   *  Powers the "Open PR" button's choice between comparing against this base or the repo's default. */
  baseBranch: string | null;
  /** True when the session ran in this app's own repo (main checkout or one of its worktrees) —
   *  hides team-integration buttons like Jenkins that make no sense for the app itself. Optional:
   *  absent from a backend older than the field, treated as false. */
  isAppRepo?: boolean;
  /** Origin/destination branches set by hand on the card (or recorded by "New task" at launch),
   *  from `tasks.json` (`sessions`). Take precedence over both the nickname-parsed branches and the
   *  recorded `gitBranch`/`baseBranch` — see `resolveSessionBranches`. Optional: absent from a
   *  backend older than the field, treated as null. */
  savedOriginBranch?: string | null;
  savedDestinationBranch?: string | null;
  /** The repo's default branch (`origin/HEAD`, else main/master — `getDefaultBaseBranch`), the
   *  last fallback for the base shown on the card. Optional: absent from an older backend. */
  defaultBranch?: string | null;
  /** The repo's main checkout (the worktree's, for a linked worktree); null outside a git repo.
   *  Optional: absent from an older backend. */
  repoRoot?: string | null;
  /** Ticket key of the task this session belongs to (`PROJ-123`) — set by "New task"/"add repo",
   *  by hand, or inferred from the task branch (`taskKeyInferred`) when exactly one key
   *  appears there. Optional: absent from an older backend. */
  taskKey?: string | null;
  taskKeyInferred?: boolean;
  /** Every repo/branch of that task, this session's own included — powers the card's "also in"
   *  line. Only set when `taskKey` is. */
  taskRepos?: TaskRepoRef[];
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

/** Snapshot returned by `GET /sessions/:id/worktree-to-root-preview` — powers the "worktree →
 *  root" modal's preview step before the user commits to either sub-flow. Recomputed fresh on
 *  every fetch (never cached), since the mutating steps that follow always re-derive their own
 *  state independently rather than trusting this payload. */
export type WorktreeToRootPreview = {
  repoRoot: string;
  /** Null only for a detached HEAD — the worktree's own branch is never null in practice, since
   *  the Claude CLI's `--worktree` flag always creates a real one. */
  rootBranch: string | null;
  worktreeBranch: string | null;
  /** Files `git status --porcelain` reports as uncommitted in the root checkout — what the
   *  "reset root" step (shared by both modes) discards. */
  rootDirtyFiles: string[];
  /** Plain filesystem diff between the worktree's and root's working trees (not a git-history
   *  diff) — only meaningful for "copy" mode's preview. */
  fileDiff: WorktreeToRootFileDiff;
  rootHasActiveSession: boolean;
  worktreeHasActiveSession: boolean;
};

/** Lightweight snapshot returned by `GET /sessions/:id/worktree-to-root/root-status` — just
 *  root's branch and dirty-file list, none of `WorktreeToRootPreview`'s (comparatively expensive)
 *  file diff. Powers the standalone "Reset root" quick action's confirm dialog, and the wizard's
 *  own final confirm step's last-second re-check — neither needs the full diff, so both use this
 *  instead of re-fetching the whole preview just to refresh a handful of file names. */
export type RootStatus = {
  repoRoot: string;
  rootBranch: string | null;
  rootDirtyFiles: string[];
  /** Every stash `discardWorkingTreeChanges` (the "reset root" step, shared by both wizard modes
   *  and the standalone quick action) has ever created here, newest first — so a previous reset
   *  stays recoverable without the user needing to remember a SHA from a toast that's long gone. */
  appStashes: { sha: string; message: string }[];
};

/** One local folder an imported session could land in — see `inspectSessionBundle`
 *  (`server/services/sessionTransferService.ts`). */
export type SessionImportCandidate = {
  /** A known repo root on this machine (same list the "New task" modal offers). */
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
