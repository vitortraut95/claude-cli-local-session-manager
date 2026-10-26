import { appendFile, copyFile, lstat, readFile, readdir, stat, symlink } from "node:fs/promises";
import path from "node:path";
import { getUserPreferences } from "./preferencesService.js";
import { runGit } from "../utils/git.js";
import type { WorktreeSetupResult } from "../../shared/tasks.js";
export type { WorktreeSetupResult } from "../../shared/tasks.js";

/**
 * Gives a fresh task worktree what git doesn't check out, per the repo's `worktreeSetup`
 * preference: a symlink to each of the main checkout's `node_modules` (root and workspaces) and a
 * copy of its gitignored `.env*` files. Only folders that exist in the worktree are visited, so an
 * untracked tree in the main checkout (builds, caches) is never walked.
 */

/** Deep enough for `packages/<name>` / `apps/<name>` workspaces. */
const MAX_DEPTH = 3;
const ENV_FILE = /^\.env(\..+)?$/;

async function exists(target: string): Promise<boolean> {
  try {
    await lstat(target);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(target: string): Promise<boolean> {
  try {
    return (await stat(target)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * A symlinked `node_modules` isn't matched by the usual `node_modules/` ignore line (git sees a
 * file, not a folder), so it'd show as untracked — and could get committed. `info/exclude` is
 * shared by every worktree of the repo; ignoring `node_modules` there changes nothing for the
 * main checkout, whose real folder is ignored already.
 */
async function excludeNodeModules(worktreePath: string): Promise<void> {
  const excludePath = await runGit(
    ["rev-parse", "--path-format=absolute", "--git-path", "info/exclude"],
    worktreePath,
  );
  const current = await readFile(excludePath, "utf8").catch(() => "");
  if (current.split("\n").some((line) => line.trim() === "node_modules")) return;
  const separator = current === "" || current.endsWith("\n") ? "" : "\n";
  await appendFile(
    excludePath,
    `${separator}# Symlinked into task worktrees by Claude Session Manager\nnode_modules\n`,
  );
}

export async function prepareWorktree(
  repoRoot: string,
  worktreePath: string,
): Promise<WorktreeSetupResult> {
  const result: WorktreeSetupResult = { linked: [], copied: [] };
  const options = (await getUserPreferences()).worktreeSetup[path.basename(repoRoot)];
  if (!options || (!options.linkNodeModules && !options.copyEnvFiles)) return result;

  const visit = async (relative: string, depth: number): Promise<void> => {
    const sourceDir = path.join(repoRoot, relative);
    const targetDir = path.join(worktreePath, relative);
    let entries;
    try {
      entries = await readdir(sourceDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const rel = path.join(relative, entry.name);
      const target = path.join(worktreePath, rel);
      if (entry.name === "node_modules") {
        if (options.linkNodeModules && entry.isDirectory() && !(await exists(target))) {
          await symlink(path.join(repoRoot, rel), target, "dir");
          result.linked.push(rel);
        }
        continue;
      }
      if (entry.isFile() && ENV_FILE.test(entry.name)) {
        if (options.copyEnvFiles && !(await exists(target))) {
          await copyFile(path.join(repoRoot, rel), target);
          result.copied.push(rel);
        }
        continue;
      }
      // Hidden folders (.git, .claude — where the worktrees themselves live) are never walked.
      if (
        entry.isDirectory() &&
        !entry.name.startsWith(".") &&
        depth < MAX_DEPTH &&
        (await isDirectory(path.join(targetDir, entry.name)))
      ) {
        await visit(rel, depth + 1);
      }
    }
  };
  try {
    await visit("", 0);
  } finally {
    // Also after a failure halfway: whatever got linked must not show up as untracked.
    if (result.linked.length > 0) await excludeNodeModules(worktreePath);
  }
  return result;
}

/** Never fails the worktree creation it follows: a setup problem just means less was set up. */
export async function prepareWorktreeBestEffort(
  repoRoot: string,
  worktreePath: string,
): Promise<WorktreeSetupResult> {
  try {
    return await prepareWorktree(repoRoot, worktreePath);
  } catch (err) {
    console.warn(`[worktree setup] ${worktreePath}:`, err);
    return { linked: [], copied: [] };
  }
}
