import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runGit } from "../utils/git.js";
import { AppError, ConflictError, errorMessage } from "../utils/httpError.js";
import { REPO_ROOT } from "../utils/repoRoot.js";

export type UpdateStatus = {
  branch: string;
  tracking: string;
  ahead: number;
  behind: number;
  updateAvailable: boolean;
  /** Uncommitted or untracked files, or commits not on origin/main: the update would discard
   *  them, so it never runs on its own and needs `force`. Optional: older backend. */
  hasLocalChanges?: boolean;
  /** `git status --porcelain` lines (first `MAX_LISTED_FILES`). */
  changedFiles?: string[];
  changedFileCount?: number;
};

const MAX_LISTED_FILES = 20;

export type UpdateJobStatus =
  | { state: "idle" }
  | { state: "running"; startedAt: string }
  | { state: "success"; branch: string; pullSummary: string; finishedAt: string }
  | { state: "error"; message: string; code?: string; finishedAt: string };

/** Not `@{u}`: this process may run from a `--no-track` worktree branch with no upstream. */
const UPDATE_TARGET_REF = "origin/main";

export async function getUpdateStatus(): Promise<UpdateStatus> {
  const repoRoot = REPO_ROOT;
  const branch = await runGit(["rev-parse", "--abbrev-ref", "HEAD"], repoRoot);

  try {
    await runGit(["fetch", "--quiet", "origin", "main"], repoRoot, { nonInteractive: true });
  } catch (err) {
    throw new AppError(
      "UPDATE_FETCH_FAILED",
      `Could not reach the remote repository: ${errorMessage(err)}`,
      { cause: err },
    );
  }

  const counts = await runGit(
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

  const changed = (await runGit(["status", "--porcelain"], repoRoot))
    .split("\n")
    .filter((line) => line.trim() !== "");

  return {
    branch,
    tracking: UPDATE_TARGET_REF,
    ahead,
    behind,
    updateAvailable: behind > 0,
    hasLocalChanges: changed.length > 0 || ahead > 0,
    changedFiles: changed.slice(0, MAX_LISTED_FILES),
    changedFileCount: changed.length,
  };
}

const UPDATE_SCRIPT = fileURLToPath(new URL("../scripts/run-update.mjs", import.meta.url));

function jobStatusFile(repoRoot: string): string {
  return path.join(repoRoot, "node_modules", ".tmp", "update-job.json");
}

export async function getUpdateJobStatus(): Promise<UpdateJobStatus> {
  const repoRoot = REPO_ROOT;
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
 * With local changes it's refused unless `force` (the user confirmed discarding them).
 */
export async function startUpdate(force: boolean): Promise<void> {
  const repoRoot = REPO_ROOT;

  if (!force && (await getUpdateStatus()).hasLocalChanges) {
    throw new ConflictError(
      "UPDATE_LOCAL_CHANGES",
      "There are local changes (uncommitted files or unpushed commits) the update would discard.",
    );
  }

  const existingJob = await getUpdateJobStatus();
  if (existingJob.state === "running") {
    throw new ConflictError("UPDATE_ALREADY_RUNNING", "An update is already in progress.");
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
