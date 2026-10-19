import { copyFile, lstat, mkdir, readFile, readlink, rm, symlink } from "node:fs/promises";
import path from "node:path";
import { runGit } from "./core.js";
import { listWorktrees, nestedWorktreeRelativePaths } from "./worktrees.js";
import { listWorkingTreeFiles } from "./workingTree.js";

type FileDiff = { added: string[]; modified: string[]; removed: string[] };

/** Files content-compared per batch, bounding open file descriptors (EMFILE). */
const DIFF_COMPARE_BATCH_SIZE = 50;

/** True if the files at `pathA`/`pathB` differ. Symlinks are compared by target, since
 *  `readFile`/`copyFile` follow them. */
async function filesDiffer(pathA: string, pathB: string): Promise<boolean> {
  const [statA, statB] = await Promise.all([lstat(pathA), lstat(pathB)]);

  if (statA.isSymbolicLink() || statB.isSymbolicLink()) {
    if (!statA.isSymbolicLink() || !statB.isSymbolicLink()) return true;
    const [targetA, targetB] = await Promise.all([readlink(pathA), readlink(pathB)]);
    return targetA !== targetB;
  }

  if (statA.size !== statB.size) return true;

  const [bufA, bufB] = await Promise.all([readFile(pathA), readFile(pathB)]);
  return !bufA.equals(bufB);
}

/** Merge-base of two refs; null when either is missing or they share no resolvable history. */
async function getMergeBase(
  cwd: string,
  refA: string | null,
  refB: string | null,
): Promise<string | null> {
  if (!refA || !refB) return null;
  try {
    return await runGit(["merge-base", refA, refB], cwd);
  } catch {
    return null;
  }
}

/** Paths changed between `baseRef` and `worktreeDir`'s working tree (commits and uncommitted
 *  changes). Renames/copies contribute both paths. */
async function getTouchedPathsSinceMergeBase(
  worktreeDir: string,
  baseRef: string,
): Promise<string[]> {
  // `-z` as in getStatusFiles. Each record is `<status>\0<path>\0`, or
  // `<status>\0<oldPath>\0<newPath>\0` for a rename/copy.
  const output = await runGit(["diff", "--name-status", "-z", baseRef], worktreeDir);
  if (!output) return [];
  const fields = output.split("\0").filter(Boolean);
  const paths = new Set<string>();
  for (let i = 0; i < fields.length; i++) {
    const status = fields[i]!;
    paths.add(fields[++i]!);
    if (status.startsWith("R") || status.startsWith("C")) paths.add(fields[++i]!);
  }
  return [...paths];
}

/**
 * Filesystem diff between a worktree's and root's working trees (file contents, not git history),
 * for the "worktree → root" copy mode.
 * - Nested worktrees are dropped from root's listing: `git ls-files` reports each as one
 *   `<dir>/` entry, which would otherwise land in `removed`.
 * - When both branches are known, only paths the worktree touched since the merge-base are
 *   compared, so files root gained on its own aren't flagged for removal.
 * A comparison that throws counts as "modified".
 */
export async function computeFileDiff(worktreeDir: string, rootDir: string): Promise<FileDiff> {
  const entries = await listWorktrees(rootDir);
  const resolvedRoot = path.resolve(rootDir);
  const resolvedWorktree = path.resolve(worktreeDir);

  const nestedWorktreeEntries = new Set(
    nestedWorktreeRelativePaths(rootDir, entries).map((rel) => `${rel}/`),
  );

  const [worktreeFiles, rawRootFiles] = await Promise.all([
    listWorkingTreeFiles(worktreeDir),
    listWorkingTreeFiles(rootDir),
  ]);
  const rootFiles = rawRootFiles.filter((file) => !nestedWorktreeEntries.has(file));

  const rootBranch = entries.find((e) => path.resolve(e.path) === resolvedRoot)?.branch ?? null;
  const worktreeBranch =
    entries.find((e) => path.resolve(e.path) === resolvedWorktree)?.branch ?? null;
  const mergeBase = await getMergeBase(rootDir, rootBranch, worktreeBranch);
  const touchedPaths = mergeBase
    ? await getTouchedPathsSinceMergeBase(worktreeDir, mergeBase)
    : null;
  const scope = touchedPaths ? new Set(touchedPaths) : null;
  const inScope = (file: string) => !scope || scope.has(file);

  const worktreeSet = new Set(worktreeFiles);
  const rootSet = new Set(rootFiles);

  const added = worktreeFiles.filter((file) => !rootSet.has(file) && inScope(file));
  const removed = rootFiles.filter((file) => !worktreeSet.has(file) && inScope(file));
  const common = worktreeFiles.filter((file) => rootSet.has(file) && inScope(file));

  const modified: string[] = [];
  for (let i = 0; i < common.length; i += DIFF_COMPARE_BATCH_SIZE) {
    const batch = common.slice(i, i + DIFF_COMPARE_BATCH_SIZE);
    const results = await Promise.all(
      batch.map((file) =>
        filesDiffer(path.join(worktreeDir, file), path.join(rootDir, file)).catch(() => true),
      ),
    );
    batch.forEach((file, index) => {
      if (results[index]) modified.push(file);
    });
  }

  return { added, modified, removed };
}

async function copyFileOrSymlink(sourcePath: string, destPath: string): Promise<void> {
  const sourceStat = await lstat(sourcePath);
  await mkdir(path.dirname(destPath), { recursive: true });
  await rm(destPath, { force: true });
  if (sourceStat.isSymbolicLink()) {
    await symlink(await readlink(sourcePath), destPath);
    return;
  }
  await copyFile(sourcePath, destPath);
}

/**
 * Applies a `FileDiff` onto `rootDir`: deletes `removed`, then copies `added`+`modified`. Deletes
 * must finish first (a file `foo` replaced by `foo/bar.txt` would fail with ENOTDIR). Paths come
 * from `git ls-files`, never from the client.
 */
export async function applyFileDiff(
  worktreeDir: string,
  rootDir: string,
  diff: FileDiff,
): Promise<void> {
  await Promise.all(diff.removed.map((file) => rm(path.join(rootDir, file), { force: true })));
  await Promise.all(
    [...diff.added, ...diff.modified].map((file) =>
      copyFileOrSymlink(path.join(worktreeDir, file), path.join(rootDir, file)),
    ),
  );
}
