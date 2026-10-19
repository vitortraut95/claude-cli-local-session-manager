import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { errorMessage } from "../httpError.js";

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
