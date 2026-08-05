import { execFile } from "node:child_process";
import { copyFile, lstat, mkdir, readFile, readlink, rm, symlink } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** `execFile`'s default `maxBuffer` (1MB) is comfortably exceeded by `git ls-files` on a real repo
 *  with many thousands of tracked files (see `listWorkingTreeFiles`) — every `runGit` call gets a
 *  much larger ceiling so that command doesn't fail with "stdout maxBuffer length exceeded". */
const GIT_MAX_BUFFER_BYTES = 64 * 1024 * 1024;

/**
 * `git worktree add`'s stderr leads with a "Preparing worktree (...)" progress line before the
 * actual `fatal:`/`error:` reason on failure — surface just that line to the user instead of the
 * whole blob, falling back to the full text if the format ever doesn't match.
 */
function extractGitErrorLine(stderr: string): string {
  const match = stderr.split("\n").find((line) => /^(fatal|error):/.test(line.trim()));
  return match ?? stderr;
}

/**
 * Runs `git <args>` in `cwd` and returns stdout with trailing whitespace/newlines stripped; throws
 * with git's own stderr on failure. Trailing-only (not `.trim()`'s both-ends strip) matters for
 * `git status --porcelain`: its very first status line can legitimately start with a space (e.g.
 * `" M README.md"` for an unstaged modification, the single most common status) — stripping that
 * leading space would corrupt fixed-width parsing of just that one line (see `getStatusFiles`).
 */
export async function runGit(args: string[], cwd: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd, maxBuffer: GIT_MAX_BUFFER_BYTES });
    return stdout.replace(/\s+$/, "");
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
  // `baseBranchRef` is a remote-tracking ref (see resolveBaseBranchRef) — git's own
  // `branch.autoSetupMerge` default would otherwise silently make the new branch track *that*
  // (e.g. origin/master) instead of its own future same-named remote branch, so `git status`
  // keeps comparing against the wrong upstream forever (until someone happens to run
  // `git push -u`). `--no-track` leaves it unset instead, same as a normal `git checkout -b` off
  // a local branch would.
  await runGit(
    ["worktree", "add", "--no-track", "-b", branchName, worktreePath, baseBranchRef],
    repoRoot,
  );
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
  // See createWorktreeWithBranch's --no-track comment — same remote-tracking-base-ref pitfall.
  await runGit(["checkout", "--no-track", "-b", branchName, baseBranchRef], repoRoot);
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
async function unlockAndRemoveWorktree(
  worktreePath: string,
): Promise<{ branch: string | null; mainRoot: string }> {
  const dirs = await getGitDirs(worktreePath);
  if (!dirs) {
    throw new Error(`"${worktreePath}" is no longer a git worktree.`);
  }
  const mainRoot = path.dirname(dirs.commonGitDir);
  const branch = await getWorktreeBranch(worktreePath, mainRoot).catch(() => null);

  await runGit(["worktree", "unlock", worktreePath], mainRoot).catch(() => undefined);
  await runGit(["worktree", "remove", worktreePath], mainRoot);

  return { branch, mainRoot };
}

export async function removeWorktreeAndBranch(worktreePath: string): Promise<void> {
  const { branch, mainRoot } = await unlockAndRemoveWorktree(worktreePath);
  if (branch) {
    await runGit(["branch", "-D", branch], mainRoot).catch(() => undefined);
  }
}

/**
 * Same removal as `removeWorktreeAndBranch`, but keeps the branch alive — for the "worktree →
 * root" checkout flow (sessionService.ts's `removeWorktreeAndCheckoutRoot`), which needs the
 * branch to still exist so it can be checked out in the main repo right after this. Returns the
 * captured branch name (null only for a detached-HEAD worktree, which the Claude CLI's own
 * `--worktree` flag never actually creates).
 */
export async function removeWorktreeKeepBranch(worktreePath: string): Promise<string | null> {
  const { branch } = await unlockAndRemoveWorktree(worktreePath);
  return branch;
}

/**
 * Every git worktree `listWorktrees(rootDir)` reports as nested inside `rootDir` (not just one
 * particular linked worktree), as paths relative to `rootDir` — shared by every "worktree → root"
 * operation that must never read/modify a nested worktree as if it were a plain part of root's own
 * working tree, since it's really a separate git repository (own `.git` file, own uncommitted
 * state, possibly still in active use by another session). Pure/sync: callers that already fetched
 * `entries` via `listWorktrees` (as most do, for branch lookups) pass it straight through instead of
 * this re-querying git.
 */
export function nestedWorktreeRelativePaths(rootDir: string, entries: WorktreeEntry[]): string[] {
  const resolvedRoot = path.resolve(rootDir);
  return entries
    .map((entry) => path.relative(resolvedRoot, path.resolve(entry.path)))
    .filter((rel) => rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel));
}

/** Turns a list of root-relative paths into the `-- . ':(exclude)path'...` pathspec arguments that
 *  make a `git status`/`git stash` call ignore them entirely, instead of just filtering their
 *  names out of the result afterward — the latter wouldn't stop `git stash` from actually touching
 *  them. Empty when there's nothing to exclude, so callers can always splice this in unconditionally. */
function excludePathspecArgs(excludePaths: string[]): string[] {
  if (excludePaths.length === 0) return [];
  return ["--", ".", ...excludePaths.map((p) => `:(exclude)${p}`)];
}

/**
 * Parses `git status --porcelain` into the plain list of relative paths it reports as dirty
 * (staged, unstaged, or untracked) — same command `hasUncommittedChanges` already uses as a
 * boolean check; this returns the actual paths so a caller (the "worktree → root" preview) can
 * show the user exactly what's about to be discarded. Each line is a 2-character status code, a
 * space, then the path; a rename ("R  old -> new") reports both sides — only the new path is kept,
 * since that's what's actually on disk now.
 *
 * `excludePaths` (typically `nestedWorktreeRelativePaths`'s result) keeps nested worktrees out of
 * this list entirely — otherwise an untracked `.claude/worktrees/<name>` (or an ancestor directory
 * git collapses it into, like `.claude/`) would show up as "uncommitted changes that will be
 * discarded" even though it's not user content at all, it's other worktrees managed by this app.
 */
export async function getStatusFiles(cwd: string, excludePaths: string[] = []): Promise<string[]> {
  // `-z`: NUL-terminated, unquoted paths — without it, git wraps any path containing a byte
  // >= 0x80 (i.e. any non-ASCII character — accented filenames, extremely common in practice) in
  // double quotes with octal escapes (`"foto \303\247\303\243o.png"`), which then doesn't match
  // the real filename on disk and breaks every path-based comparison/copy downstream. A
  // renamed/copied entry's old path is a second NUL-terminated field with no status prefix (per
  // `git status`'s own `-z` doc) — skip it, only the new path is kept, since that's what's
  // actually on disk now.
  const status = await runGit(
    ["status", "--porcelain", "-z", ...excludePathspecArgs(excludePaths)],
    cwd,
  );
  if (!status) return [];
  const fields = status.split("\0").filter(Boolean);
  const files: string[] = [];
  for (let i = 0; i < fields.length; i++) {
    const entry = fields[i]!;
    const statusCode = entry.slice(0, 2);
    files.push(entry.slice(3));
    if (statusCode.includes("R") || statusCode.includes("C")) i++;
  }
  return files;
}

/**
 * `git ls-files -co --exclude-standard` lists both tracked (`-c`) and untracked-but-not-ignored
 * (`-o --exclude-standard`) files — respects `.gitignore` automatically, so build output and
 * dependencies (node_modules, dist, ...) never show up when comparing two working trees.
 *
 * `-z` (NUL-terminated, unquoted) for the same reason `getStatusFiles` uses it — a plain
 * newline-split would otherwise get git's quoted-octal-escaped form of any accented filename
 * instead of the real path, breaking every file operation that follows.
 */
export async function listWorkingTreeFiles(cwd: string): Promise<string[]> {
  const list = await runGit(["ls-files", "-co", "--exclude-standard", "-z"], cwd);
  return list ? list.split("\0").filter(Boolean) : [];
}

const STASH_MESSAGE = "worktree-to-root: root's pre-sync state";

/**
 * Discards every uncommitted change in `cwd` — tracked modifications and untracked files/dirs,
 * never gitignored paths like `node_modules` (nuking those would force an unnecessary reinstall,
 * and they're unrelated to whatever's being synced in from elsewhere). Recoverable, not a hard
 * `reset --hard`+`clean -fd`: stashes everything first via `git stash push --include-untracked`
 * (which already leaves a clean working tree in one step when there's something to stash — no
 * separate reset/clean needed), so the caller can tell the user exactly how to get it back
 * (`git stash apply <sha>`) instead of just destroying it outright. Returns the new stash's commit
 * SHA, or null when `cwd` had nothing dirty to begin with (nothing was stashed, nothing changed).
 *
 * `excludePaths` (see `nestedWorktreeRelativePaths`) is just as load-bearing here as it is for
 * `getStatusFiles` — without it, an untracked `.claude/worktrees/<name>` would actually get swept
 * into the stash, which risks corrupting/orphaning whatever other session is still using that
 * nested worktree, not just misreporting it in the UI.
 *
 * Whenever `pathspecArgs` isn't empty (there's a nested worktree to exclude), `git stash push`
 * can exit 1 and print "The following paths are ignored by one of your .gitignore files" for
 * `.claude` itself — reproduced directly: this fires purely because an explicit `:(exclude)`
 * pathspec is present at all, on *any* repo where `.claude/` (or wherever worktrees live) is
 * itself gitignored, regardless of which ignored path triggers it — and the stash is created
 * successfully despite the non-zero exit (confirmed via `git stash list` right after). Since
 * there's no git flag that avoids the warning without also force-adding otherwise-ignored files
 * (which would defeat the whole point above), this specific message is treated as success rather
 * than rethrown — the `rev-parse` below is the real check: if the stash genuinely didn't happen,
 * that fails too (no new `refs/stash` to resolve any differently than before).
 */
export async function discardWorkingTreeChanges(
  cwd: string,
  excludePaths: string[] = [],
): Promise<string | null> {
  const pathspecArgs = excludePathspecArgs(excludePaths);
  const dirty = await runGit(["status", "--porcelain", ...pathspecArgs], cwd);
  if (!dirty) return null;

  try {
    await runGit(["stash", "push", "--include-untracked", "-m", STASH_MESSAGE, ...pathspecArgs], cwd);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes("ignored by one of your .gitignore files")) throw err;
  }
  return await runGit(["rev-parse", "refs/stash"], cwd);
}

/**
 * Thin wrapper for switching to an already-existing branch. `stopSiblingAndResume`
 * (sessionService.ts) has an inline equivalent for its own use case (it also needs to kill a
 * sibling process first); this is the shared version for callers that don't.
 */
export async function checkoutExistingBranch(cwd: string, branch: string): Promise<void> {
  await runGit(["checkout", branch], cwd);
}

export type FileDiff = { added: string[]; modified: string[]; removed: string[] };

/** How many common files to content-compare per batch — bounds concurrent open file descriptors
 *  instead of one giant `Promise.all` over every shared file, which risks EMFILE/memory spikes on
 *  a repo with thousands of tracked files. */
const DIFF_COMPARE_BATCH_SIZE = 50;

/**
 * True if the file (or symlink) at `pathA`/`pathB` differ. Symlinks are compared by target string,
 * not by dereferenced content — `fs.readFile`/`fs.copyFile` both follow symlinks, so treating one
 * as a regular file here would silently turn a tracked symlink into a plain file holding its
 * target's resolved bytes once copied. A cheap size check skips reading content for regular files
 * that already differ in size.
 */
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

/**
 * Merge-base between two refs, run from `cwd` (works from either the worktree or root — both
 * share the same object store). Resolves the exact commit a worktree branch forked from, even if
 * root's own branch has since moved forward independently — see `computeFileDiff`'s fork-point
 * scoping. Null if either ref can't be resolved (e.g. a detached HEAD with no branch name) or the
 * two refs share no history (shouldn't happen for two branches of the same repo, but `merge-base`
 * can still fail in edge cases like a shallow clone).
 */
export async function getMergeBase(
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

/**
 * Every path `git diff --name-status <baseRef>` reports as touched between `baseRef` and
 * `worktreeDir`'s current working tree — no second ref means "compare against the working tree",
 * so this covers every commit the worktree branch made since forking from `baseRef` *and* its own
 * currently-uncommitted changes, in one shot. Rename/copy lines (`R100\told\tnew`) report both
 * paths; both are included so the old path still counts as "touched" (and so becomes a removal
 * candidate against root, same as an ordinary delete).
 */
export async function getTouchedPathsSinceMergeBase(
  worktreeDir: string,
  baseRef: string,
): Promise<string[]> {
  // `-z`: same reason as getStatusFiles/listWorkingTreeFiles — without it, any accented filename
  // comes back quoted/octal-escaped and no longer matches the real path on disk. Each record is
  // `<status>\0<path>\0`, or `<status>\0<oldPath>\0<newPath>\0` for a rename/copy.
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
 * Plain filesystem-level diff between two working trees of the same repo (typically a worktree and
 * the main checkout) — NOT a git-history diff in the sense of comparing commits, deliberately:
 * this powers the "worktree → root" modal's "copy" mode, which is meant to dump the worktree's
 * current file *contents* onto root regardless of what root's own branch is, since root's branch
 * is left untouched either way. Both file lists come from `listWorkingTreeFiles` so build
 * output/deps never show up.
 *
 * Scoped two ways before comparing:
 * - Every worktree `listWorktrees(rootDir)` reports as nested inside `rootDir` (not just the one
 *   being synced) is excluded from root's listing outright — `git ls-files` reports each as a
 *   single embedded-repository entry (a directory path ending in "/") rather than recursing into
 *   it, and left in, that entry would land in `removed` and `applyFileDiff` would try to `rm()` a
 *   non-empty directory (someone else's worktree) and throw. Handles more than one sibling
 *   worktree living under the same root, not just the pair being compared.
 * - When both root's and the worktree's current branch are known, the comparison is further
 *   scoped to only the paths `getTouchedPathsSinceMergeBase` reports the worktree branch's own
 *   history (plus its uncommitted changes) as having touched since it forked from root — so if
 *   root's branch has moved on its own since the worktree was created (someone else's commit adds
 *   a file directly on it), that file is left alone instead of being misread as "belongs to the
 *   worktree" and flagged for deletion. Falls back to the unscoped (blind full-tree) comparison
 *   when either branch is unknown (detached HEAD) or shares no resolvable history with the other.
 *
 * Common files within scope are compared in bounded batches (see `DIFF_COMPARE_BATCH_SIZE`); a
 * comparison that throws (e.g. a race where a file disappears mid-scan) is treated as "modified" —
 * the safer default, since it just means that file gets needlessly re-copied rather than silently
 * skipped.
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
  const touchedPaths = mergeBase ? await getTouchedPathsSinceMergeBase(worktreeDir, mergeBase) : null;
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
 * Applies a previously-computed `FileDiff` onto `rootDir`: deletes `removed` files, then copies
 * `added`+`modified` from `worktreeDir`. Deletion must fully finish before any copy starts — if the
 * worktree replaced a tracked file `foo` with a directory `foo/bar.txt`, copying before the old
 * `foo` file is gone fails with ENOTDIR. Every path here comes from `computeFileDiff`'s own
 * `git ls-files` output (never client-supplied), so there's nothing to validate against path
 * traversal.
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
