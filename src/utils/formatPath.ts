import type { Session } from "../types/session";

type WorktreePathParts = {
  /** `<repo>/.claude/worktrees` (or the parent dir for a non-standard path). */
  prefix: string;
  /** The worktree's own name (last path segment(s) under `worktrees`). */
  name: string;
};

/**
 * Splits a `<repo>/.claude/worktrees/<name>` path into prefix and name, to render on two lines.
 * Paths outside that convention fall back to parent dir + last segment.
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
 * Best-effort "folder above the project" hint for the project filter (e.g. "git" for
 * `~/git/my-app`). Assumes a non-worktree `workingDirectory` is the repo root, so a session
 * started in a subdirectory gets an odd hint (display only; filtering uses `session.project`).
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
