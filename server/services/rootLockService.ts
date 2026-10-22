import path from "node:path";
import { getStatusFiles, listWorktrees, nestedWorktreeRelativePaths } from "../utils/git.js";
import { recordEvent } from "../utils/history.js";
import { ConflictError } from "../utils/httpError.js";
import { inferTaskKey } from "../utils/taskKeys.js";
import { getTaskStore, setRootLock, type RootLock } from "../utils/taskStore.js";

/**
 * One task at a time in a repo's main checkout — where the projects run to be tested locally.
 * Every task works in its own worktree; "worktree → root" takes the root for that task, and the
 * lock is released on its own as soon as the root stops reflecting it (cleaned, in copy mode; on
 * another branch, once a branch was moved there), so a reset done outside the app frees it too.
 */

async function rootBranchAndDirtyFiles(
  repoRoot: string,
): Promise<{ branch: string | null; dirtyFiles: string[] }> {
  const entries = await listWorktrees(repoRoot);
  const resolvedRoot = path.resolve(repoRoot);
  const branch = entries.find((e) => path.resolve(e.path) === resolvedRoot)?.branch ?? null;
  const dirtyFiles = await getStatusFiles(repoRoot, nestedWorktreeRelativePaths(repoRoot, entries));
  return { branch, dirtyFiles };
}

/** The root's current lock, or null — a stale one is dropped on the way. */
export async function getRootLock(repoRoot: string): Promise<RootLock | null> {
  const lock = (await getTaskStore()).rootLocks[repoRoot];
  if (!lock) return null;
  const { branch, dirtyFiles } = await rootBranchAndDirtyFiles(repoRoot);
  const stale = lock.mode === "copy" ? dirtyFiles.length === 0 : branch !== lock.branch;
  if (stale) {
    await setRootLock(repoRoot, null);
    recordEvent("root.released", {
      repoRoot,
      key: lock.taskKey,
      branch: lock.branch,
      mode: lock.mode,
      heldMs: lock.since ? Date.now() - Date.parse(lock.since) : null,
    });
    return null;
  }
  return lock;
}

/** The task a branch belongs to: recorded by "New task"/the queue, else read from its name. */
export async function taskKeyForBranch(repoRoot: string, branch: string): Promise<string | null> {
  const recorded = (await getTaskStore()).repoBranches[repoRoot]?.[branch]?.taskKey ?? null;
  return recorded ?? inferTaskKey(branch);
}

function describeLock(lock: RootLock): string {
  const owner = lock.taskKey ?? lock.branch;
  return lock.mode === "copy"
    ? `${owner} (files copied from ${lock.branch})`
    : `${owner} (branch ${lock.branch} checked out)`;
}

/** Throws unless the root is free, or already holds a copy of this same worktree (copying it
 *  again just refreshes the files). */
export async function assertRootFreeFor(repoRoot: string, worktreePath: string): Promise<void> {
  const lock = await getRootLock(repoRoot);
  if (!lock) return;
  if (lock.mode === "copy" && lock.worktreePath === worktreePath) return;
  recordEvent("root.refused", {
    repoRoot,
    worktreePath,
    heldBy: lock.taskKey ?? lock.branch,
    heldMode: lock.mode,
  });
  throw new ConflictError(
    "ROOT_IN_USE",
    `The root of this repo is in use by ${describeLock(lock)}. Reset the root (or finish that ` +
      `task) before bringing another task there.`,
  );
}

export async function lockRootForCopy(
  repoRoot: string,
  worktreePath: string,
  branch: string,
): Promise<void> {
  const taskKey = await taskKeyForBranch(repoRoot, branch);
  const previous = (await getTaskStore()).rootLocks[repoRoot];
  await setRootLock(repoRoot, {
    mode: "copy",
    branch,
    taskKey,
    worktreePath,
    // Copying the same worktree again only refreshes the files: the root was held all along.
    since:
      previous?.mode === "copy" && previous.worktreePath === worktreePath
        ? previous.since
        : new Date().toISOString(),
  });
  recordEvent("root.locked", { repoRoot, key: taskKey, branch, mode: "copy", worktreePath });
}

/** `taskKey` is passed in: the branch's own record is dropped when its worktree is removed. */
export async function lockRootForCheckout(
  repoRoot: string,
  branch: string,
  taskKey: string | null,
): Promise<void> {
  await setRootLock(repoRoot, {
    mode: "checkout",
    branch,
    taskKey,
    worktreePath: null,
    since: new Date().toISOString(),
  });
  recordEvent("root.locked", { repoRoot, key: taskKey, branch, mode: "checkout" });
}
