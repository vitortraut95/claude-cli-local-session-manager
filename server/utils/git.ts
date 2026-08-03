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
 * Resolves `cwd` to its repo's main checkout root regardless of whether `cwd` itself is the main
 * checkout or a linked worktree — `--git-common-dir` is shared by every worktree of a repo, so
 * `path.dirname` of it is always the main root (same trick `removeWorktreeAndBranch` uses). Used
 * by the "new task" flow so picking an already-active worktree as the source folder still creates
 * the new task's worktree as a sibling off the shared main repo, not nested inside another worktree.
 */
export async function getRepoRoot(cwd: string): Promise<string | null> {
  const dirs = await getGitDirs(cwd);
  return dirs ? path.dirname(dirs.commonGitDir) : null;
}

export async function branchExists(cwd: string, branch: string): Promise<boolean> {
  try {
    await runGit(["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], cwd);
    return true;
  } catch {
    return false;
  }
}

/**
 * Best-effort default base branch for the "new task" form: prefers whatever `origin/HEAD` points
 * at (the repo's actual configured default), falls back to a local `main`/`master` branch, and
 * finally the current branch — better than hardcoding "main" for repos that use "master" or
 * something else entirely.
 */
const ORIGIN_HEAD_REF_PATTERN = /^refs\/remotes\/origin\/(.+)$/;

export async function getDefaultBaseBranch(cwd: string): Promise<string> {
  try {
    const ref = await runGit(["symbolic-ref", "refs/remotes/origin/HEAD"], cwd);
    const match = ORIGIN_HEAD_REF_PATTERN.exec(ref);
    if (match?.[1]) return match[1];
  } catch {
    // No origin, or no HEAD set for it (e.g. `git remote set-head origin` never ran) — fall through.
  }

  for (const candidate of ["main", "master"]) {
    if (await branchExists(cwd, candidate)) return candidate;
  }

  try {
    return await runGit(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
  } catch {
    return "main";
  }
}

/**
 * Updates the `origin/<baseBranch>` remote-tracking ref to the latest commit on the remote, so a
 * new task branches off a fresh base rather than whatever the local ref last happened to point
 * at. Deliberately a plain `fetch` (not a `checkout` + `pull`, and not updating the local branch
 * ref directly): a remote-tracking ref isn't tied to any worktree's HEAD, so this is always safe
 * to run even while `baseBranch` is checked out and actively being worked on elsewhere in the
 * repo — the equivalent `git fetch origin <baseBranch>:<baseBranch>` form would refuse to run in
 * that exact case ("refusing to fetch into branch ... checked out"). Best-effort: offline, no
 * `origin`, or a repo with no such branch upstream just fall through to whatever local ref exists.
 */
async function fetchOriginBranch(cwd: string, baseBranch: string): Promise<void> {
  await runGit(
    ["fetch", "origin", `refs/heads/${baseBranch}:refs/remotes/origin/${baseBranch}`],
    cwd,
  );
}

/**
 * Resolves the actual starting commit for a new task's branch: tries to fetch the latest
 * `origin/<baseBranch>` first (see `fetchOriginBranch`) and prefers that when it succeeds, since
 * that's the freshest available commit. Falls back to a local branch of the same name — either
 * because there's no origin/network, or because this is a local-only branch that was never
 * pushed — and only gives up if neither exists.
 */
export async function resolveBaseBranchRef(cwd: string, baseBranch: string): Promise<string> {
  const fetched = await fetchOriginBranch(cwd, baseBranch)
    .then(() => true)
    .catch(() => false);
  if (fetched) return `origin/${baseBranch}`;

  if (await branchExists(cwd, baseBranch)) return baseBranch;

  throw new Error(`Base branch "${baseBranch}" was not found locally or on origin.`);
}

/** Deletes a local branch (`git branch -D`) in `cwd` — used when a session is deleted and the
 *  user also wants its branch gone. No `--force` beyond `-D` itself: git still refuses outright
 *  if `branch` is the directory's currently checked-out branch, surfacing that as a normal error. */
export async function deleteLocalBranch(cwd: string, branch: string): Promise<void> {
  await runGit(["branch", "-D", branch], cwd);
}

/**
 * Creates a new linked worktree at `worktreePath` on a fresh `branchName`, branched off
 * `baseBranchRef` — the "new task" flow's own worktree creation, distinct from
 * `createSessionWorktree` in sessionService.ts (which delegates to the CLI's `--worktree` flag and
 * can't take a custom branch name or base branch). `git worktree add` creates any missing parent
 * directories itself.
 */
export async function createWorktreeWithBranch(
  repoRoot: string,
  worktreePath: string,
  branchName: string,
  baseBranchRef: string,
): Promise<void> {
  await runGit(["worktree", "add", "-b", branchName, worktreePath, baseBranchRef], repoRoot);
}

/**
 * Creates a new branch off `baseBranchRef` and checks it out directly in `repoRoot` — the
 * "skip worktree" path for the "new task" flow, opted into via the modal's checkbox. Unlike
 * `createWorktreeWithBranch`, this switches the branch checked out in the repo's own main
 * checkout, so it can collide with whatever another terminal/session already has open there —
 * the modal warns about this before letting the checkbox be checked.
 */
export async function checkoutNewBranch(
  repoRoot: string,
  branchName: string,
  baseBranchRef: string,
): Promise<void> {
  await runGit(["checkout", "-b", branchName, baseBranchRef], repoRoot);
}

export type WorktreeEntry = { path: string; branch: string | null };

/**
 * `git worktree list --porcelain` reports one block per worktree (main checkout included), each
 * starting with a `worktree <path>` line and (unless detached) a `branch refs/heads/<name>` line.
 * Shared by `getWorktreeBranch` (single lookup) and the cleanup scan (`cleanupService.ts`, needs
 * every entry to find linked worktrees whose branch might be safe to remove).
 */
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

/** Looks up the one branch checked out at `worktreePath` — needed because
 *  `removeWorktreeAndBranch` has to capture the branch name *before* removing the worktree makes
 *  it unqueryable. */
async function getWorktreeBranch(worktreePath: string, mainRoot: string): Promise<string | null> {
  const entries = await listWorktrees(mainRoot);
  const target = path.resolve(worktreePath);
  return entries.find((entry) => path.resolve(entry.path) === target)?.branch ?? null;
}

/**
 * Clears git's own administrative records for worktrees whose directory was deleted by hand
 * (e.g. a plain `rm -rf`) instead of through `removeWorktreeAndBranch` — those leave `git worktree
 * list` still reporting an entry that points nowhere. Doesn't touch any real files; purely
 * internal git bookkeeping.
 */
export async function pruneWorktrees(repoRoot: string): Promise<void> {
  await runGit(["worktree", "prune"], repoRoot);
}

/**
 * True if every commit on `branch` is already an ancestor of `ontoBranch` — the same notion
 * `git branch -d` (lowercase, no force) uses to decide a branch is safe to delete without losing
 * work. Purely local (no fetch), matching the cleanup scan's "local only" scope.
 */
export async function isBranchMerged(
  repoRoot: string,
  branch: string,
  ontoBranch: string,
): Promise<boolean> {
  try {
    await runGit(["merge-base", "--is-ancestor", branch, ontoBranch], repoRoot);
    return true;
  } catch {
    return false;
  }
}

/** True if `worktreePath` has any uncommitted changes (staged, unstaged, or untracked) — the
 *  cleanup scan only offers to remove a worktree when this is false, so "safe, one click" holds. */
export async function hasUncommittedChanges(worktreePath: string): Promise<boolean> {
  const status = await runGit(["status", "--porcelain"], worktreePath);
  return status.length > 0;
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
