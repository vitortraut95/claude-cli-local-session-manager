export type ModelUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  costUsd: number | null;
};

export type SessionUsage = {
  models: ModelUsage[];
  totalCostUsd: number | null;
  /** Portion of totalCostUsd attributable to subagents spawned during the session; null when
   *  subagentCount is 0 (nothing to break out) rather than when pricing is merely unknown. */
  subagentCostUsd: number | null;
};

export type SubagentUsage = {
  models: ModelUsage[];
  totalCostUsd: number | null;
};

export type SubagentDetail = {
  agentId: string;
  agentType: string | null;
  description: string | null;
  resultText: string | null;
  startedAt: string | null;
  endedAt: string | null;
  usage: SubagentUsage;
};

export type SessionRepoInsights = {
  /** Null when the session's original directory no longer exists, so this can't be checked. */
  hasClaudeMd: boolean | null;
  /** Task descriptions of Explore-type subagents spawned this session — candidate topics for
   *  CLAUDE.md, since each one is something Claude had to go search the repo for. */
  exploreTopics: string[];
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
  usage: SessionUsage;
  /** Id of the session this one is a "Compact & continue" follow-up of, from this app's own
   *  `session-continuations.json` sidecar — null for an ordinary session. See
   *  `continuedBySessionId` for the reverse link. */
  continuesFromSessionId: string | null;
  /** Id of the "Compact & continue" follow-up session started from this one, if any — the
   *  reverse of `continuesFromSessionId`, computed by scanning the same sidecar file for an
   *  entry whose `continuesFrom` points at this session. */
  continuedBySessionId: string | null;
  /** The branch this session's worktree was branched off, from this app's own
   *  `task-base-branches.json` sidecar — only ever set for a "New task"-created worktree whose
   *  chosen base branch differed from the repo's own default (main/master or whatever `origin/HEAD`
   *  resolves to). Null for every other session, including a worktree branched off the default.
   *  Powers the "Open PR" button's choice between comparing against this base or the repo's default. */
  baseBranch: string | null;
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
