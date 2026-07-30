export type WorktreePathParts = {
  /** Everything up to and including `worktrees` — the part that's the same for every worktree of
   *  this repo, so it reads as one visual unit above the actual worktree name. */
  prefix: string;
  /** The worktree's own name (last path segment(s) under `worktrees`). */
  name: string;
};

/**
 * A worktree session's path (e.g. `/home/user/myproject/.claude/worktrees/my-task`) loses all
 * context if trimmed down to just its last segment the way a plain project path is — "my-task"
 * alone doesn't read as "a worktree of myproject". The Claude CLI's own `-w/--worktree` flag (see
 * `createSessionWorktree` in server/utils/git.ts) always nests worktrees at
 * `<repo>/.claude/worktrees/<name>` — split on that `worktrees` segment so the repo/`.claude`
 * prefix and the worktree's own name can render as two lines instead of one long run-on string.
 * Falls back to the parent directory as the prefix for a worktree that doesn't match this
 * convention (created by hand, or before this app tracked it).
 */
export function formatWorktreePath(workingDirectory: string): WorktreePathParts {
  const segments = workingDirectory.split("/").filter(Boolean);
  const worktreesIndex = segments.findIndex(
    (segment, i) => segment === "worktrees" && segments[i - 1] === ".claude",
  );

  if (worktreesIndex >= 2) {
    const repoName = segments[worktreesIndex - 2];
    return {
      prefix: `${repoName}/.claude/worktrees`,
      name: segments.slice(worktreesIndex + 1).join("/"),
    };
  }

  return {
    prefix: segments.slice(0, -1).join("/"),
    name: segments.at(-1) ?? workingDirectory,
  };
}
