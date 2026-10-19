import path from "node:path";
import { AppError, errorMessage } from "../httpError.js";
import { getGitDirs, runGit } from "./core.js";

/** Filesystem/worktree-safe slug of a branch or task name. Must match what the CLI's `--worktree`
 *  flag does (`createSessionWorktree` predicts its path); mirrored in `ResumeConflictModal.tsx`. */
export function sanitizeWorktreeDirName(name: string): string {
  return name.replace(/[^A-Za-z0-9_-]/g, "-");
}

/** Creates a linked worktree at `worktreePath` on a new `branchName` off `baseBranchRef`. */
export async function createWorktreeWithBranch(
  repoRoot: string,
  worktreePath: string,
  branchName: string,
  baseBranchRef: string,
): Promise<void> {
  // `--no-track`: `baseBranchRef` may be a remote-tracking ref, which the new branch would
  // otherwise track as its upstream.
  await runGit(
    ["worktree", "add", "--no-track", "-b", branchName, worktreePath, baseBranchRef],
    repoRoot,
  );
}

export type WorktreeEntry = { path: string; branch: string | null };

/** Every worktree of the repo (main checkout included), from `git worktree list --porcelain`;
 *  `branch` is null when detached. */
export async function listWorktrees(repoRoot: string): Promise<WorktreeEntry[]> {
  const list = await runGit(["worktree", "list", "--porcelain"], repoRoot);
  return list
    .split("\n\n")
    .map((block) => {
      const lines = block.split("\n");
      const worktreeLine = lines.find((line) => line.startsWith("worktree "));
      const branchLine = lines.find((line) => line.startsWith("branch refs/heads/"));
      return {
        path: worktreeLine ? worktreeLine.slice("worktree ".length) : "",
        branch: branchLine ? branchLine.slice("branch refs/heads/".length) : null,
      };
    })
    .filter((entry) => entry.path !== "");
}

/** The branch checked out at `worktreePath`, or null. */
export async function getWorktreeBranch(
  worktreePath: string,
  mainRoot: string,
): Promise<string | null> {
  const entries = await listWorktrees(mainRoot);
  const target = path.resolve(worktreePath);
  return entries.find((entry) => path.resolve(entry.path) === target)?.branch ?? null;
}

/** Drops git's records of worktrees whose directory was deleted by hand. */
export async function pruneWorktrees(repoRoot: string): Promise<void> {
  await runGit(["worktree", "prune"], repoRoot);
}

/**
 * Removes the linked worktree at `worktreePath`, run from the main root (a worktree can't remove
 * itself). Unlocks first: the CLI's `--worktree` lock persists after the process exits. No
 * `--force`, so uncommitted changes still block removal.
 */
async function unlockAndRemoveWorktree(
  worktreePath: string,
): Promise<{ branch: string | null; mainRoot: string }> {
  const dirs = await getGitDirs(worktreePath);
  if (!dirs) {
    throw new AppError("NOT_A_GIT_WORKTREE", `"${worktreePath}" is no longer a git worktree.`);
  }
  const mainRoot = path.dirname(dirs.commonGitDir);
  const branch = await getWorktreeBranch(worktreePath, mainRoot).catch(() => null);

  await runGit(["worktree", "unlock", worktreePath], mainRoot).catch(() => undefined);
  try {
    await runGit(["worktree", "remove", worktreePath], mainRoot);
  } catch (err) {
    const message = errorMessage(err);
    if (message.includes("contains modified or untracked files")) {
      throw new AppError(
        "WORKTREE_UNCOMMITTED_CHANGES",
        `The worktree at "${worktreePath}" still has uncommitted changes, so it wasn't removed ` +
          `— commit or discard them in the worktree first (or use "copy" mode instead, which ` +
          `doesn't require the worktree to be clean).`,
        { cause: err },
      );
    }
    throw err;
  }

  return { branch, mainRoot };
}

export async function removeWorktreeAndBranch(worktreePath: string): Promise<void> {
  const { branch, mainRoot } = await unlockAndRemoveWorktree(worktreePath);
  if (branch) {
    await runGit(["branch", "-D", branch], mainRoot).catch(() => undefined);
  }
}

/** Same removal as `removeWorktreeAndBranch` but keeps the branch; returns its name (null for a
 *  detached HEAD). */
export async function removeWorktreeKeepBranch(worktreePath: string): Promise<string | null> {
  const { branch } = await unlockAndRemoveWorktree(worktreePath);
  return branch;
}

/** Worktrees nested inside `rootDir`, relative to it. Root operations must skip them: each is a
 *  separate checkout, possibly in use by another session. */
export function nestedWorktreeRelativePaths(rootDir: string, entries: WorktreeEntry[]): string[] {
  const resolvedRoot = path.resolve(rootDir);
  return entries
    .map((entry) => path.relative(resolvedRoot, path.resolve(entry.path)))
    .filter((rel) => rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel));
}
