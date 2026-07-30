/**
 * A worktree session's path (e.g. `/home/user/myproject/.claude/worktrees/my-task`) loses all
 * context if trimmed down to just its last segment the way a plain project path is — "my-task"
 * alone doesn't read as "a worktree of myproject". The Claude CLI's own `-w/--worktree` flag (see
 * `createSessionWorktree` in server/utils/git.ts) always nests worktrees at
 * `<repo>/.claude/worktrees/<name>` — find that `worktrees` segment and rebuild
 * `<repo>/worktrees/<name>` from it, dropping the `.claude` implementation detail. Falls back to
 * the last two segments for a worktree that doesn't match this convention (created by hand, or
 * before this app tracked it).
 */
export function formatWorktreePath(workingDirectory: string): string {
  const segments = workingDirectory.split("/").filter(Boolean);
  const worktreesIndex = segments.findIndex(
    (segment, i) => segment === "worktrees" && segments[i - 1] === ".claude",
  );

  if (worktreesIndex >= 2) {
    const repoName = segments[worktreesIndex - 2];
    const rest = segments.slice(worktreesIndex + 1);
    return [repoName, "worktrees", ...rest].join("/");
  }

  return segments.slice(-2).join("/");
}
