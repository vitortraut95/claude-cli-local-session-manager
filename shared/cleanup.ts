/** Why a linked worktree has nothing to offer (the card's "remove worktree" shortcut says so). */
export type WorktreeSkipReason =
  "default-branch" | "uncommitted-changes" | "active-session" | "not-done" | "not-pushed";

export type StaleSession = {
  id: string;
  title: string;
  updatedAt: string;
  sizeBytes: number;
};

export type CleanupFinding = {
  id: string;
  kind:
    | "prune-worktrees"
    | "remove-merged-worktree"
    | "remove-abandoned-worktree"
    | "remove-done-task-worktree"
    | "prune-old-sessions";
  /** Structured data the client renders its own translated title/description from. */
  command: string;
  repoRoot: string;
  /** Only set for `prune-worktrees`; empty for the other kinds. */
  staleBranches: string[];
  /** Only set for `remove-merged-worktree`; null for the other kinds. */
  worktreePath: string | null;
  branch: string | null;
  /** Only set for `remove-merged-worktree`; null for the other kinds. */
  defaultBranch: string | null;
  /** Only set for `prune-old-sessions` — the sessions beyond the keep-count this finding would
   *  delete, most recent first; empty for the other kinds. */
  staleSessions: StaleSession[];
  /** Only set for `prune-old-sessions` — how many most-recent sessions are kept; 0 otherwise. */
  keepCount: number;
};
