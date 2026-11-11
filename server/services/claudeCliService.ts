import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { AppError, errorMessage } from "../utils/httpError.js";
import { sanitizedSpawnEnv } from "../utils/spawnEnv.js";
import type { ClaudeCliStatus } from "../../shared/system.js";

/**
 * The installed Claude CLI against the newest on npm. `claude update` updates either install
 * (native or a global npm package), so the app never needs to know which one it is.
 */

const execFileAsync = promisify(execFile);

const REGISTRY_URL = "https://registry.npmjs.org/@anthropic-ai/claude-code/latest";
const LATEST_CACHE_MS = 60 * 60 * 1000;
const UPDATE_TIMEOUT_MS = 5 * 60 * 1000;
export const CLAUDE_UPDATE_COMMAND = "claude update";

let latestCache: { version: string | null; at: number } | null = null;

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function installedVersion(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("claude", ["--version"], {
      timeout: 10_000,
      env: sanitizedSpawnEnv(),
    });
    return /(\d+\.\d+\.\d+)/.exec(stdout)?.[1] ?? null;
  } catch {
    return null;
  }
}

async function latestVersion(): Promise<string | null> {
  if (latestCache && Date.now() - latestCache.at < LATEST_CACHE_MS) return latestCache.version;
  let version: string | null = null;
  try {
    const response = await fetch(REGISTRY_URL, { signal: AbortSignal.timeout(10_000) });
    if (response.ok) {
      const data = (await response.json()) as { version?: unknown };
      if (typeof data.version === "string") version = data.version;
    }
  } catch {
    // Offline: no "latest", so no update shown.
  }
  latestCache = { version, at: Date.now() };
  return version;
}

export async function getClaudeCliStatus(): Promise<ClaudeCliStatus> {
  const [version, latest] = await Promise.all([installedVersion(), latestVersion()]);
  return {
    installed: version !== null,
    version,
    latest,
    updateAvailable: !!version && !!latest && compareVersions(version, latest) < 0,
    updateCommand: CLAUDE_UPDATE_COMMAND,
  };
}

/** Runs `claude update`. Sessions already open keep their version until reopened. */
export async function updateClaudeCli(): Promise<ClaudeCliStatus> {
  try {
    await execFileAsync("claude", ["update"], {
      timeout: UPDATE_TIMEOUT_MS,
      env: sanitizedSpawnEnv(),
      maxBuffer: 4 * 1024 * 1024,
    });
  } catch (err) {
    // execFile's message already carries the command's stderr.
    throw new AppError(
      "CLAUDE_CLI_UPDATE_FAILED",
      `"${CLAUDE_UPDATE_COMMAND}" failed: ${errorMessage(err).trim().slice(-500)}`,
    );
  }
  return getClaudeCliStatus();
}
