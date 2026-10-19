import { execFile } from "node:child_process";
import { copyFile, lstat, mkdir, readFile, readlink, rm, symlink } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { AppError, errorMessage } from "./httpError.js";

const execFileAsync = promisify(execFile);

/** `execFile`'s default 1MB `maxBuffer` is too small for `git ls-files` on a large repo. */
const GIT_MAX_BUFFER_BYTES = 64 * 1024 * 1024;

/** The `fatal:`/`error:` line of git's stderr (it may lead with progress lines), else all of it. */
function extractGitErrorLine(stderr: string): string {
  const match = stderr.split("\n").find((line) => /^(fatal|error):/.test(line.trim()));
  return match ?? stderr;
}

/** Non-interactive: a missing SSH key or unknown host fails fast instead of hanging on a prompt
 *  nobody can see (the backend has no terminal). */
const NON_INTERACTIVE_GIT_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  GIT_TERMINAL_PROMPT: "0",
  GIT_SSH_COMMAND: process.env.GIT_SSH_COMMAND ?? "ssh -o BatchMode=yes -o ConnectTimeout=10",
};

export type GitOptions = {
  timeoutMs?: number;
  /** For commands that may reach a remote (fetch, clone, pull). */
  nonInteractive?: boolean;
};

/**
 * The one way this app runs git: `git <args>` in `cwd`, stdout with trailing whitespace stripped;
 * throws with git's stderr. Trailing-only: a `git status --porcelain` line can start with a space.
 */
export async function runGit(
  args: string[],
  cwd: string,
  { timeoutMs, nonInteractive = false }: GitOptions = {},
): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd,
      maxBuffer: GIT_MAX_BUFFER_BYTES,
      ...(timeoutMs !== undefined ? { timeout: timeoutMs } : {}),
      ...(nonInteractive ? { env: NON_INTERACTIVE_GIT_ENV } : {}),
    });
    return stdout.replace(/\s+$/, "");
  } catch (err) {
    const stderr = (err as { stderr?: string } | null)?.stderr?.trim();
    const message = stderr && stderr.length > 0 ? extractGitErrorLine(stderr) : errorMessage(err);
    // No `code`: git's own stderr text has no fixed set of messages to translate.
    throw new Error(message, { cause: err });
  }
}

/** `runGit`, but null instead of throwing. */
export async function tryGit(
  args: string[],
  cwd: string,
  options?: GitOptions,
): Promise<string | null> {
  try {
    return await runGit(args, cwd, options);
  } catch {
    return null;
  }
}

const CLONE_TIMEOUT_MS = 180_000;

export async function cloneRepository(url: string, target: string): Promise<void> {
  await runGit(["clone", url, target], path.dirname(target), {
    timeoutMs: CLONE_TIMEOUT_MS,
    nonInteractive: true,
  });
}

/**
 * `--git-dir` and `--git-common-dir` are equal for a repo's main checkout and differ for a linked
 * worktree. Null when `cwd` isn't inside a git repo.
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

/** The repo's main checkout root, also from inside a linked worktree (`path.dirname` of the
 *  shared `--git-common-dir`). */
export async function getRepoRoot(cwd: string): Promise<string | null> {
  const dirs = await getGitDirs(cwd);
  return dirs ? path.dirname(dirs.commonGitDir) : null;
}

export type GitHostInfo = { host: "github" | "bitbucket"; slug: string };

/** `origin` URLs (SSH or HTTPS) on github.com/bitbucket.org; captures the `owner/repo` slug. */
const REMOTE_URL_PATTERNS: { host: GitHostInfo["host"]; pattern: RegExp }[] = [
  { host: "github", pattern: /^git@github\.com:([^/]+\/[^/]+?)(?:\.git)?$/ },
  { host: "github", pattern: /^https:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/ },
  { host: "bitbucket", pattern: /^git@bitbucket\.org:([^/]+\/[^/]+?)(?:\.git)?$/ },
  { host: "bitbucket", pattern: /^https:\/\/[^/@]+@bitbucket\.org\/([^/]+\/[^/]+?)(?:\.git)?$/ },
  { host: "bitbucket", pattern: /^https:\/\/bitbucket\.org\/([^/]+\/[^/]+?)(?:\.git)?$/ },
];

/** `cwd`'s `origin` as a host + `owner/repo` slug, for PR/compare URLs; null when there's no
 *  recognized github.com/bitbucket.org origin. */
export async function getGitHostInfo(cwd: string): Promise<GitHostInfo | null> {
  let remoteUrl: string;
  try {
    remoteUrl = await runGit(["remote", "get-url", "origin"], cwd);
  } catch {
    return null;
  }
  for (const { host, pattern } of REMOTE_URL_PATTERNS) {
    const match = pattern.exec(remoteUrl);
    if (match?.[1]) return { host, slug: match[1] };
  }
  return null;
}

export async function branchExists(cwd: string, branch: string): Promise<boolean> {
  try {
    await runGit(["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], cwd);
    return true;
  } catch {
    return false;
  }
}

const ORIGIN_HEAD_REF_PATTERN = /^refs\/remotes\/origin\/(.+)$/;

/** The repo's default branch: `origin/HEAD`, else a local `main`/`master`, else the current one. */
export async function getDefaultBaseBranch(cwd: string): Promise<string> {
  try {
    const ref = await runGit(["symbolic-ref", "refs/remotes/origin/HEAD"], cwd);
    const match = ORIGIN_HEAD_REF_PATTERN.exec(ref);
    if (match?.[1]) return match[1];
  } catch {
    // No origin, or no origin/HEAD set — fall through.
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
 * Updates only the `origin/<baseBranch>` remote-tracking ref, which is safe even while
 * `baseBranch` is checked out somewhere (fetching into the local branch would be refused).
 */
async function fetchOriginBranch(cwd: string, baseBranch: string): Promise<void> {
  await runGit(
    ["fetch", "origin", `refs/heads/${baseBranch}:refs/remotes/origin/${baseBranch}`],
    cwd,
    { nonInteractive: true, timeoutMs: 30_000 },
  );
}

/**
 * The starting ref for a new task's branch: a freshly fetched `origin/<baseBranch>`, falling back
 * to the local branch (offline, no origin, local-only). `useLocalBranch` always uses the local
 * branch, keeping unpushed commits.
 */
export async function resolveBaseBranchRef(
  cwd: string,
  baseBranch: string,
  useLocalBranch = false,
): Promise<string> {
  if (useLocalBranch) {
    if (await branchExists(cwd, baseBranch)) return baseBranch;
    throw new AppError(
      "TASK_BASE_BRANCH_NOT_FOUND",
      `Base branch "${baseBranch}" was not found locally.`,
    );
  }

  const fetched = await fetchOriginBranch(cwd, baseBranch)
    .then(() => true)
    .catch(() => false);
  if (fetched) return `origin/${baseBranch}`;

  if (await branchExists(cwd, baseBranch)) return baseBranch;

  throw new AppError(
    "TASK_BASE_BRANCH_NOT_FOUND",
    `Base branch "${baseBranch}" was not found locally or on origin.`,
  );
}

/** `git branch -D`; git still refuses when `branch` is checked out in `cwd`. */
export async function deleteLocalBranch(cwd: string, branch: string): Promise<void> {
  await runGit(["branch", "-D", branch], cwd);
}

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

/** Creates a new branch off `baseBranchRef` and checks it out directly in `repoRoot`. */
export async function checkoutNewBranch(
  repoRoot: string,
  branchName: string,
  baseBranchRef: string,
): Promise<void> {
  // `--no-track`: see createWorktreeWithBranch.
  await runGit(["checkout", "--no-track", "-b", branchName, baseBranchRef], repoRoot);
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

/** True if every commit on `branch` is an ancestor of `ontoBranch` (local refs only, no fetch). */
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

/** True when `branch` has a commit no other ref (branch, remote-tracking branch, tag) reaches,
 *  i.e. deleting it would lose history. */
export async function branchHasUniqueCommits(repoRoot: string, branch: string): Promise<boolean> {
  try {
    const count = await runGit(
      [
        "rev-list",
        "--count",
        `refs/heads/${branch}`,
        "--not",
        // Short name: with `--branches`, `--exclude` matches without the `refs/heads/` prefix.
        `--exclude=${branch}`,
        "--branches",
        "--remotes",
        "--tags",
      ],
      repoRoot,
    );
    return Number(count.trim()) > 0;
  } catch {
    // Can't tell: treat as "has commits" so nothing is offered for deletion on a guess.
    return true;
  }
}

/** True if `worktreePath` has any uncommitted changes (staged, unstaged, or untracked). */
export async function hasUncommittedChanges(worktreePath: string): Promise<boolean> {
  const status = await runGit(["status", "--porcelain"], worktreePath);
  return status.length > 0;
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

/** `-- . ':(exclude)path'...` pathspec args so `git status`/`git stash` skip those paths; empty
 *  when there's nothing to exclude. */
function excludePathspecArgs(excludePaths: string[]): string[] {
  if (excludePaths.length === 0) return [];
  return ["--", ".", ...excludePaths.map((p) => `:(exclude)${p}`)];
}

/**
 * Relative paths `git status --porcelain` reports as dirty (staged, unstaged, or untracked); for a
 * rename only the new path. `excludePaths` keeps nested worktrees out of the list.
 */
export async function getStatusFiles(cwd: string, excludePaths: string[] = []): Promise<string[]> {
  // `-z`: otherwise non-ASCII paths come back quoted with octal escapes. A rename/copy's old path
  // is an extra NUL-terminated field with no status prefix, skipped below.
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

/** Tracked plus untracked-but-not-ignored files (`ls-files -co --exclude-standard`); `-z` as in
 *  `getStatusFiles`. */
export async function listWorkingTreeFiles(cwd: string): Promise<string[]> {
  const list = await runGit(["ls-files", "-co", "--exclude-standard", "-z"], cwd);
  return list ? list.split("\0").filter(Boolean) : [];
}

/** Marks the stashes `discardWorkingTreeChanges` creates, so `listAppStashes` can find them. */
const STASH_MESSAGE_PREFIX = "worktree-to-root: root's pre-sync state";

/** Current branch label for the stash message; "detached HEAD" or "unknown" when there's none. */
async function currentBranchLabel(cwd: string): Promise<string> {
  try {
    const branch = await runGit(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
    return branch === "HEAD" ? "detached HEAD" : branch;
  } catch {
    return "unknown";
  }
}

/**
 * Clears every uncommitted change in `cwd` (tracked and untracked, never gitignored paths) by
 * stashing it with `--include-untracked`, so it stays recoverable. Returns the stash SHA, or null
 * when nothing was dirty. `excludePaths` keeps nested worktrees out of the stash.
 *
 * With an `:(exclude)` pathspec, `git stash push` can exit 1 with "ignored by one of your
 * .gitignore files" even though the stash was created; that message is treated as success and
 * the `rev-parse` below is the real check.
 */
export async function discardWorkingTreeChanges(
  cwd: string,
  excludePaths: string[] = [],
): Promise<string | null> {
  const pathspecArgs = excludePathspecArgs(excludePaths);
  const dirty = await runGit(["status", "--porcelain", ...pathspecArgs], cwd);
  if (!dirty) return null;

  const branch = await currentBranchLabel(cwd);
  const message = `${STASH_MESSAGE_PREFIX} (was on ${branch}, ${new Date().toISOString()})`;

  try {
    await runGit(["stash", "push", "--include-untracked", "-m", message, ...pathspecArgs], cwd);
  } catch (err) {
    const errMessage = errorMessage(err);
    if (!errMessage.includes("ignored by one of your .gitignore files")) throw err;
  }
  return await runGit(["rev-parse", "refs/stash"], cwd);
}

export type AppStash = { sha: string; message: string };

/**
 * Every stash `discardWorkingTreeChanges` created in `cwd`, newest first. Uses the SHA (`%H`), not
 * `stash@{N}`, which shifts once an older entry is dropped.
 */
export async function listAppStashes(cwd: string): Promise<AppStash[]> {
  const output = await runGit(["stash", "list", "--format=%H%x09%s"], cwd).catch(() => "");
  if (!output) return [];
  return (
    output
      .split("\n")
      .map((line) => {
        const [sha, ...rest] = line.split("\t");
        return { sha: sha ?? "", message: rest.join("\t") };
      })
      // `.includes`: git prepends "On <branch>: " to the stash message.
      .filter((entry) => entry.sha && entry.message.includes(STASH_MESSAGE_PREFIX))
  );
}

export async function checkoutExistingBranch(cwd: string, branch: string): Promise<void> {
  await runGit(["checkout", branch], cwd);
}

export type FileDiff = { added: string[]; modified: string[]; removed: string[] };

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

/** Paths changed between `baseRef` and `worktreeDir`'s working tree (commits and uncommitted
 *  changes). Renames/copies contribute both paths. */
export async function getTouchedPathsSinceMergeBase(
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
