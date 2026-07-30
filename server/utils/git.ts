import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * `git worktree add`'s stderr leads with a "Preparing worktree (...)" progress line before the
 * actual `fatal:`/`error:` reason on failure — surface just that line to the user instead of the
 * whole blob, falling back to the full text if the format ever doesn't match.
 */
function extractGitErrorLine(stderr: string): string {
  const match = stderr.split("\n").find((line) => /^(fatal|error):/.test(line.trim()));
  return match ?? stderr;
}

/** Runs `git <args>` in `cwd` and returns trimmed stdout; throws with git's own stderr on failure. */
export async function runGit(args: string[], cwd: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd });
    return stdout.trim();
  } catch (err) {
    const stderr = (err as { stderr?: string } | null)?.stderr?.trim();
    const fallback = err instanceof Error ? err.message : String(err);
    const message = stderr && stderr.length > 0 ? extractGitErrorLine(stderr) : fallback;
    throw new Error(message, { cause: err });
  }
}

/**
 * `--git-dir` and `--git-common-dir` are equal for a repo's main checkout, and differ for a
 * linked worktree (`--git-dir` there points at `.git/worktrees/<name>`, `--git-common-dir` at the
 * shared `.git`) — the standard way to tell them apart without relying on `.git` being a file vs.
 * a directory. Returns null when `cwd` isn't inside a git repo at all.
 */
export async function getGitDirs(
  cwd: string,
): Promise<{ gitDir: string; commonGitDir: string } | null> {
  try {
    const [gitDir, commonGitDir] = await Promise.all([
      runGit(["rev-parse", "--path-format=absolute", "--git-dir"], cwd),
      runGit(["rev-parse", "--path-format=absolute", "--git-common-dir"], cwd),
    ]);
    return { gitDir, commonGitDir };
  } catch {
    return null;
  }
}

export async function isLinkedWorktree(cwd: string): Promise<boolean> {
  const dirs = await getGitDirs(cwd);
  return dirs !== null && dirs.gitDir !== dirs.commonGitDir;
}

/**
 * `git worktree list --porcelain` reports one block per worktree, each starting with a
 * `worktree <path>` line and (unless detached) a `branch refs/heads/<name>` line — the only way
 * to learn which branch a worktree has checked out from outside it, needed here because
 * `removeWorktreeAndBranch` has to capture the branch name *before* removing the worktree makes
 * it unqueryable.
 */
async function getWorktreeBranch(worktreePath: string, mainRoot: string): Promise<string | null> {
  const list = await runGit(["worktree", "list", "--porcelain"], mainRoot);
  const target = path.resolve(worktreePath);

  for (const block of list.split("\n\n")) {
    const lines = block.split("\n");
    const worktreeLine = lines.find((line) => line.startsWith("worktree "));
    if (!worktreeLine || path.resolve(worktreeLine.slice("worktree ".length)) !== target) continue;

    const branchLine = lines.find((line) => line.startsWith("branch refs/heads/"));
    return branchLine ? branchLine.slice("branch refs/heads/".length) : null;
  }
  return null;
}

/**
 * Removes the linked worktree at `worktreePath`, and the branch git checked out into it (best
 * effort — a failure to delete the branch doesn't undo the worktree removal, since freeing the
 * disk space was the primary ask). Runs `git worktree remove` from the repo's main root rather
 * than from `worktreePath` itself — git won't let a worktree remove itself while it's the
 * current directory.
 *
 * Unlocks first, unconditionally: the Claude CLI's own `--worktree` flag (see
 * `createSessionWorktree` in sessionService.ts) locks the worktree with a
 * `claude session <name> (pid ... start ...)` reason for the lifetime of the session it creates,
 * and doesn't release it just because that process later exited — a plain `remove` on one of
 * these fails with "cannot remove a locked working tree" even long after Claude closed. Unlocking
 * an already-unlocked worktree just errors "not locked", which is safe to ignore. No `--force` on
 * the remove itself, though: a worktree with uncommitted changes still fails removal with git's
 * own message, same as declining to `rm -rf` uncommitted work anywhere else in this app.
 */
export async function removeWorktreeAndBranch(worktreePath: string): Promise<void> {
  const dirs = await getGitDirs(worktreePath);
  if (!dirs) {
    throw new Error(`"${worktreePath}" is no longer a git worktree.`);
  }
  const mainRoot = path.dirname(dirs.commonGitDir);
  const branch = await getWorktreeBranch(worktreePath, mainRoot).catch(() => null);

  await runGit(["worktree", "unlock", worktreePath], mainRoot).catch(() => undefined);
  await runGit(["worktree", "remove", worktreePath], mainRoot);

  if (branch) {
    await runGit(["branch", "-D", branch], mainRoot).catch(() => undefined);
  }
}
