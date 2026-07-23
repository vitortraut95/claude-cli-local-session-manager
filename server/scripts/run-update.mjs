#!/usr/bin/env node
// Runs `git pull` + `npm install` as a standalone process, detached from the API server.
//
// The dev server runs under `tsx watch`, which restarts the Node process the instant `git
// pull` rewrites any watched source file — killing whatever was mid-flight in that process,
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
  let pullSummary;
  try {
    pullSummary = await git(["pull", "--ff-only"]);
  } catch (err) {
    throw new Error(`git pull failed: ${errorMessage(err)}`);
  }

  try {
    await execFileAsync("npm", ["install"], {
      cwd: repoRoot,
      timeout: 5 * 60 * 1000,
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (err) {
    throw new Error(`npm install failed: ${errorMessage(err)}`);
  }

  const branch = await git(["rev-parse", "--abbrev-ref", "HEAD"]);
  await writeStatus({ state: "success", branch, pullSummary });
} catch (err) {
  await writeStatus({ state: "error", message: err instanceof Error ? err.message : String(err) });
}
