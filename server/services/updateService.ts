import { execFile, spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { AppError } from "../utils/httpError.js";

const execFileAsync = promisify(execFile);

export type UpdateStatus = {
  branch: string;
  tracking: string;
  ahead: number;
  behind: number;
  updateAvailable: boolean;
};

export type UpdateJobStatus =
  | { state: "idle" }
  | { state: "running"; startedAt: string }
  | { state: "success"; branch: string; pullSummary: string; finishedAt: string }
  | { state: "error"; message: string; code?: string; finishedAt: string };

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

async function getRepoRoot(): Promise<string> {
  return git(["rev-parse", "--show-toplevel"], process.cwd());
}

/** Not `@{u}`: this process may run from a `--no-track` worktree branch with no upstream. */
const UPDATE_TARGET_REF = "origin/main";

export async function getUpdateStatus(): Promise<UpdateStatus> {
  const repoRoot = await getRepoRoot();
  const branch = await git(["rev-parse", "--abbrev-ref", "HEAD"], repoRoot);

  try {
    await git(["fetch", "--quiet", "origin", "main"], repoRoot);
  } catch (err) {
    throw new AppError(
      "UPDATE_FETCH_FAILED",
      `Could not reach the remote repository: ${errorMessage(err)}`,
      { cause: err },
    );
  }

  const counts = await git(
    ["rev-list", "--left-right", "--count", `HEAD...${UPDATE_TARGET_REF}`],
    repoRoot,
  );
  const [aheadStr, behindStr] = counts.split(/\s+/);
  if (aheadStr === undefined || behindStr === undefined) {
    throw new AppError(
      "UPDATE_UNEXPECTED_GIT_OUTPUT",
      `Unexpected "git rev-list --left-right --count" output: "${counts}"`,
    );
  }
  const ahead = Number(aheadStr);
  const behind = Number(behindStr);

  return { branch, tracking: UPDATE_TARGET_REF, ahead, behind, updateAvailable: behind > 0 };
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
 * Launches the forced update (fetch + hard reset, discarding local changes, + `yarn install`) as
 * a detached process and returns immediately: `tsx watch` restarts this process as soon as the
 * reset rewrites a source file. The frontend polls getUpdateJobStatus() (a status file) instead.
 */
export async function startUpdate(): Promise<void> {
  const repoRoot = await getRepoRoot();

  const existingJob = await getUpdateJobStatus();
  if (existingJob.state === "running") {
    throw new AppError("UPDATE_ALREADY_RUNNING", "An update is already in progress.");
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
