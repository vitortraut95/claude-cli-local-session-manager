import { errorMessage } from "../httpError.js";
import { runGit } from "./core.js";

/** True if `worktreePath` has any uncommitted changes (staged, unstaged, or untracked). */
export async function hasUncommittedChanges(worktreePath: string): Promise<boolean> {
  const status = await runGit(["status", "--porcelain"], worktreePath);
  return status.length > 0;
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

type AppStash = { sha: string; message: string };

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
