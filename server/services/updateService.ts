import { execFile, spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

export type UpdateJobStatus =
  | { state: "idle" }
  | { state: "running"; startedAt: string }
  | { state: "success"; branch: string; pullSummary: string; finishedAt: string }
  | { state: "error"; message: string; finishedAt: string };

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

const UPDATE_SCRIPT = fileURLToPath(new URL("../scripts/run-update.mjs", import.meta.url));

function jobStatusFile(repoRoot: string): string {
  return path.join(repoRoot, "node_modules", ".tmp", "update-job.json");
}

export async function getUpdateJobStatus(): Promise<UpdateJobStatus> {
  const repoRoot = await getRepoRoot();
  try {
    const raw = await readFile(jobStatusFile(repoRoot), "utf8");
    return JSON.parse(raw) as UpdateJobStatus;
  } catch {
    return { state: "idle" };
  }
}

/**
 * Kicks off `git pull` + `npm install` as a detached process and returns as soon as it's
 * launched — it does not wait for the pull/install to finish. The dev server runs under `tsx
 * watch`, which restarts this very process the instant `git pull` rewrites a watched source
 * file; running the actual work in-process (and awaiting it here) would have this request's
 * response killed mid-flight by that restart. The frontend instead polls getUpdateJobStatus()
 * (backed by a status file, so it survives the restart) to learn the outcome.
 */
export async function startUpdate(): Promise<void> {
  const repoRoot = await getRepoRoot();

  const dirty = await git(["status", "--porcelain"], repoRoot);
  if (dirty) {
    throw new UpdateBlockedError(
      "The project has uncommitted changes. Commit or stash them before updating.",
    );
  }

  const statusFile = jobStatusFile(repoRoot);
  await mkdir(path.dirname(statusFile), { recursive: true });
  await writeFile(
    statusFile,
    JSON.stringify({ state: "running", startedAt: new Date().toISOString() }),
  );

  spawn(process.execPath, [UPDATE_SCRIPT, repoRoot, statusFile], {
    detached: true,
    stdio: "ignore",
  }).unref();
}
