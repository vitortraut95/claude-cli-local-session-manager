#!/usr/bin/env node
// Runs a forced `git fetch` + `reset --hard` (see the comment below for why "forced") +
// `yarn install` as a standalone process, detached from the API server.
//
// The dev server runs under `tsx watch`, which restarts the Node process the instant the
// reset rewrites any watched source file — killing whatever was mid-flight in that process,
// including the HTTP response for the request that triggered this update. Spawning this as a
// separate, detached OS process (see startUpdate() in ../services/updateService.ts) means the
// actual work survives that restart; it writes its result to `statusFile` when done, and the
// API server reports that back to the frontend by polling GET /system/update-job.
//
// Plain JS on purpose, not TS: this must run standalone via a bare `node` invocation (in both
// dev and a built production server), with no dependency on tsx or a compiled dist/ existing.

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
  // Force-align to origin/main rather than merging/fast-forwarding: a machine that ended up with
  // diverged local commits (or any other local edit) would otherwise make `git pull` stop and ask
  // which merge strategy to use — exactly the friction this app wants to never surface. Targets
  // "origin/main" directly instead of the current branch's own `@{u}` upstream: this repo can be
  // dogfooded on itself (see CLAUDE.md), so the process running this update might be sitting in a
  // `--no-track` worktree branch with no upstream configured at all — resolving `@{u}` there
  // throws before ever reaching the actual update. "Update app" always means "make this checkout's
  // working tree identical to the published main branch", regardless of what branch/worktree
  // happened to launch it from — `reset --hard origin/main` moves *whatever branch is currently
  // checked out here* to that commit rather than switching to a branch literally named "main" (a
  // plain `checkout -B main origin/main` would fail with "already used by worktree" when run from
  // a linked worktree, since "main" is locked to the primary checkout there). `git clean -fd`
  // afterward removes stray untracked files too (e.g. one left over from a previous failed
  // update) — it never touches gitignored files (this app's own sidecar JSON files included)
  // since that needs an explicit `-x`.
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
