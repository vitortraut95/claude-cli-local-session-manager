import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export class UpdateBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpdateBlockedError";
  }
}

export type UpdateStatus = {
  branch: string;
  tracking: string | null;
  ahead: number;
  behind: number;
  updateAvailable: boolean;
};

export type UpdateResult = {
  branch: string;
  pullSummary: string;
};

async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout.trim();
}

function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "stderr" in err) {
    const stderr = (err as { stderr?: unknown }).stderr;
    if (typeof stderr === "string" && stderr.trim()) return stderr.trim();
  }
  return err instanceof Error ? err.message : String(err);
}

/** Works from any cwd inside the repo, so it doesn't assume where this process was launched from. */
async function getRepoRoot(): Promise<string> {
  return git(["rev-parse", "--show-toplevel"], process.cwd());
}

async function getUpstream(repoRoot: string): Promise<string | null> {
  try {
    return await git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], repoRoot);
  } catch {
    return null;
  }
}

export async function getUpdateStatus(): Promise<UpdateStatus> {
  const repoRoot = await getRepoRoot();
  const branch = await git(["rev-parse", "--abbrev-ref", "HEAD"], repoRoot);

  try {
    await git(["fetch", "--quiet"], repoRoot);
  } catch (err) {
    throw new Error(`Could not reach the remote repository: ${errorMessage(err)}`, { cause: err });
  }

  const tracking = await getUpstream(repoRoot);
  if (!tracking) {
    return { branch, tracking: null, ahead: 0, behind: 0, updateAvailable: false };
  }

  const counts = await git(["rev-list", "--left-right", "--count", `HEAD...${tracking}`], repoRoot);
  const [aheadStr, behindStr] = counts.split(/\s+/);
  if (aheadStr === undefined || behindStr === undefined) {
    throw new Error(`Unexpected "git rev-list --left-right --count" output: "${counts}"`);
  }
  const ahead = Number(aheadStr);
  const behind = Number(behindStr);

  return { branch, tracking, ahead, behind, updateAvailable: behind > 0 };
}

export async function runUpdate(): Promise<UpdateResult> {
  const repoRoot = await getRepoRoot();

  const dirty = await git(["status", "--porcelain"], repoRoot);
  if (dirty) {
    throw new UpdateBlockedError(
      "The project has uncommitted changes. Commit or stash them before updating.",
    );
  }

  let pullSummary: string;
  try {
    pullSummary = await git(["pull", "--ff-only"], repoRoot);
  } catch (err) {
    throw new Error(`git pull failed: ${errorMessage(err)}`, { cause: err });
  }

  try {
    await execFileAsync("npm", ["install"], {
      cwd: repoRoot,
      timeout: 5 * 60 * 1000,
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (err) {
    throw new Error(`npm install failed: ${errorMessage(err)}`, { cause: err });
  }

  const branch = await git(["rev-parse", "--abbrev-ref", "HEAD"], repoRoot);
  return { branch, pullSummary };
}
