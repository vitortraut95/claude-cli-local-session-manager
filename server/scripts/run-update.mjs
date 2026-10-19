#!/usr/bin/env node
// Runs a forced `git fetch` + `reset --hard origin/main` + `yarn install` as a detached process,
// so the work survives `tsx watch` restarting the API server when the reset rewrites sources.
// Writes its result to `statusFile`, which the server reports via GET /system/update-job.
//
// Plain JS: must run via a bare `node` invocation, without tsx or a compiled dist/.

import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const [, , repoRoot, statusFile] = process.argv;

async function git(args) {
  const { stdout } = await execFileAsync("git", args, { cwd: repoRoot });
  return stdout.trim();
}

function errorMessage(err) {
  if (err && typeof err === "object" && "stderr" in err) {
    const stderr = err.stderr;
    if (typeof stderr === "string" && stderr.trim()) return stderr.trim();
  }
  return err instanceof Error ? err.message : String(err);
}

async function writeStatus(status) {
  await writeFile(statusFile, JSON.stringify({ ...status, finishedAt: new Date().toISOString() }));
}

try {
  // Forced on purpose: local commits/edits must never stop the update. Targets origin/main, not
  // `@{u}`, since the checkout may be a `--no-track` worktree branch; resets the current branch
  // (a `checkout main` fails in a linked worktree). `clean -fd` without `-x` keeps gitignored
  // files such as the sidecar JSON files.
  let pullSummary;
  try {
    await git(["fetch", "--quiet", "origin", "main"]);
    pullSummary = await git(["reset", "--hard", "origin/main"]);
    await git(["clean", "-fd"]);
  } catch (err) {
    throw Object.assign(new Error(`git update failed: ${errorMessage(err)}`), {
      code: "UPDATE_GIT_PULL_FAILED",
    });
  }

  try {
    await execFileAsync("yarn", ["install"], {
      cwd: repoRoot,
      timeout: 5 * 60 * 1000,
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (err) {
    throw Object.assign(new Error(`yarn install failed: ${errorMessage(err)}`), {
      code: "UPDATE_YARN_INSTALL_FAILED",
    });
  }

  const branch = await git(["rev-parse", "--abbrev-ref", "HEAD"]);
  await writeStatus({ state: "success", branch, pullSummary });
} catch (err) {
  await writeStatus({
    state: "error",
    message: err instanceof Error ? err.message : String(err),
    code: err && typeof err === "object" && typeof err.code === "string" ? err.code : undefined,
  });
}
