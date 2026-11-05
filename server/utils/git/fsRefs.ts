import { lstat, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { getDefaultBaseBranch } from "./branches.js";
import { getGitDirs } from "./core.js";

/**
 * Read-only lookups straight from `.git`, without spawning git: the session list asks them for
 * every folder on each load, where a process per call adds up to seconds. Anything outside the
 * plain layout (reftable, an unexpected `.git` file) falls back to git itself.
 */

async function readTrimmed(file: string): Promise<string | null> {
  try {
    return (await readFile(file, "utf8")).trim();
  } catch {
    return null;
  }
}

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

/** Same result as `getGitDirs` (`--git-dir` / `--git-common-dir`, real paths). */
export async function readGitDirs(
  cwd: string,
): Promise<{ gitDir: string; commonGitDir: string } | null> {
  let dir: string;
  try {
    dir = await realpath(cwd);
  } catch {
    return null;
  }
  for (;;) {
    const dotGit = path.join(dir, ".git");
    const info = await lstat(dotGit).catch(() => null);
    if (info) {
      let gitDir: string;
      if (info.isDirectory()) {
        gitDir = dotGit;
      } else {
        const pointer = /^gitdir: (.+)$/m.exec((await readTrimmed(dotGit)) ?? "")?.[1];
        if (!pointer) return getGitDirs(cwd);
        gitDir = path.resolve(dir, pointer);
      }
      if (!(await exists(path.join(gitDir, "HEAD")))) return getGitDirs(cwd);
      const commondir = await readTrimmed(path.join(gitDir, "commondir"));
      const commonGitDir = commondir ? path.resolve(gitDir, commondir) : gitDir;
      try {
        return { gitDir: await realpath(gitDir), commonGitDir: await realpath(commonGitDir) };
      } catch {
        return getGitDirs(cwd);
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

async function hasBranch(commonGitDir: string, packedRefs: string, branch: string) {
  return (
    (await exists(path.join(commonGitDir, "refs", "heads", branch))) ||
    packedRefs.split("\n").some((line) => line.endsWith(` refs/heads/${branch}`))
  );
}

/** Same result as `getDefaultBaseBranch(repoRoot)`: `origin/HEAD`, else a local `main`/`master`,
 *  else the main checkout's current branch. */
export async function readDefaultBaseBranch(repoRoot: string): Promise<string> {
  const dirs = await readGitDirs(repoRoot);
  if (!dirs || (await exists(path.join(dirs.commonGitDir, "reftable")))) {
    return getDefaultBaseBranch(repoRoot);
  }
  const common = dirs.commonGitDir;
  // A symbolic ref is always a loose file (packed-refs can't hold one).
  const originHead = await readTrimmed(path.join(common, "refs", "remotes", "origin", "HEAD"));
  const fromOrigin = /^ref: refs\/remotes\/origin\/(.+)$/.exec(originHead ?? "")?.[1];
  if (fromOrigin) return fromOrigin;

  const packedRefs = (await readTrimmed(path.join(common, "packed-refs"))) ?? "";
  for (const candidate of ["main", "master"]) {
    if (await hasBranch(common, packedRefs, candidate)) return candidate;
  }

  const head = await readTrimmed(path.join(common, "HEAD"));
  if (head === null) return "main";
  return /^ref: refs\/heads\/(.+)$/.exec(head)?.[1] ?? "HEAD";
}
