import type { Session } from "../types/session";

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

/**
 * Best-effort "one folder above the project" hint for the project filter dropdown (e.g. "git" for
 * a repo at `~/git/hg-led-mainsite`) — purely client-side, derived from fields already in the
 * `Session` payload rather than a fresh server round-trip through `getKnownProjectFolders()`
 * (which re-runs the same expensive `listSessions()`-backed scan the page's own session list just
 * did; see CLAUDE.md/`taskService.ts`'s `projectLabel` for the equivalent server-side version used
 * by the "New Task" modal, where that extra scan is unavoidable since it needs a resolved repo
 * root, not just a cwd guess).
 *
 * For a worktree session, `workingDirectory` is `<repoRoot>/.claude/worktrees/<name>` — the
 * repo's parent sits one segment above `repoRoot` itself, i.e. three segments above `worktrees`
 * (same convention `formatWorktreePath` above already relies on). For every other session, this
 * assumes `workingDirectory` (or `missingWorktreeRepoRoot` for an orphaned worktree) already *is*
 * the repo root — true whenever `claude` was started from the repo's top level, which is the
 * common case, but not guaranteed: a session started from a subdirectory would report that
 * subdirectory's parent instead of the actual repo's, unlike `session.project` itself, which the
 * server resolves via git and is always correct. Wrong here just means a slightly odd hint on an
 * uncommon setup, not a wrong project match — the dropdown's underlying filter value is still
 * `session.project`, untouched.
 */
export function resolveProjectParentSegment(
  session: Pick<Session, "workingDirectory" | "missingWorktreeRepoRoot">,
): string | null {
  if (session.workingDirectory) {
    const segments = session.workingDirectory.split("/").filter(Boolean);
    const worktreesIndex = segments.findIndex(
      (segment, i) => segment === "worktrees" && segments[i - 1] === ".claude",
    );
    if (worktreesIndex >= 3) return segments[worktreesIndex - 3] ?? null;
    if (worktreesIndex === -1 && segments.length >= 2) return segments[segments.length - 2] ?? null;
  }
  if (session.missingWorktreeRepoRoot) {
    const segments = session.missingWorktreeRepoRoot.split("/").filter(Boolean);
    if (segments.length >= 2) return segments[segments.length - 2] ?? null;
  }
  return null;
}
