/** Why a linked worktree has nothing to offer (the card's "remove worktree" shortcut says so). */
export type WorktreeSkipReason =
  "default-branch" | "uncommitted-changes" | "active-session" | "not-done" | "not-pushed";

export type StaleSession = {
  id: string;
  title: string;
  updatedAt: string;
  sizeBytes: number;
};

/** A stopped container of a task's worktree, listed by `remove-stopped-containers`. */
export type StaleContainer = {
  name: string;
  image: string;
  /** The task it belongs to (from its name); the task is done, or no longer in tasks.json. */
  taskKey: string;
  /** When it stopped (when it was created, if it never ran). */
  stoppedAt: string;
};

/** Which skill leftover a `remove-task-files` finding cleans. */
export type TaskFileGroup = "checklists" | "evidence" | "figma-cache";

/** One top-level file or folder a `remove-task-files` finding would delete. */
export type StaleTaskFile = {
  path: string;
  /** The ticket key read from the name; null for cache entries. */
  taskKey: string | null;
  /** `done`: its task is marked done; `stale`: a task this app doesn't track, untouched for
   *  weeks; `expired`: cache older than the skill's TTL, never read again. */
  reason: "done" | "stale" | "expired";
  sizeBytes: number;
  /** Newest modification inside it. */
  updatedAt: string;
};

export type CleanupFinding = {
  id: string;
  kind:
    | "prune-worktrees"
    | "remove-merged-worktree"
    | "remove-abandoned-worktree"
    | "remove-done-task-worktree"
    | "prune-old-sessions"
    | "remove-task-files"
    | "remove-stopped-containers";
  /** Structured data the client renders its own translated title/description from. */
  command: string;
  /** The repo; for `remove-task-files`, the folder scanned; empty for `remove-stopped-containers`. */
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
  /** Only set for `remove-task-files`. */
  fileGroup?: TaskFileGroup;
  staleFiles?: StaleTaskFile[];
  /** Only set for `remove-stopped-containers`; empty or absent for the other kinds. */
  staleContainers?: StaleContainer[];
};
