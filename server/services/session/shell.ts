import { spawn } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { sanitizedSpawnEnv } from "../../utils/spawnEnv.js";

/** Time to wait for an immediate spawn failure (e.g. binary missing) before assuming success. */
const SPAWN_ERROR_GRACE_PERIOD_MS = 300;

export function trySpawnDetached(bin: string, args: string[], cwd?: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(bin, args, {
      detached: true,
      stdio: "ignore",
      cwd,
      env: sanitizedSpawnEnv(),
    });

    const timer = setTimeout(() => {
      child.removeListener("error", onError);
      child.unref();
      resolve(true);
    }, SPAWN_ERROR_GRACE_PERIOD_MS);

    function onError() {
      clearTimeout(timer);
      resolve(false);
    }

    child.once("error", onError);
  });
}

export async function directoryExists(dir: string): Promise<boolean> {
  try {
    return (await stat(dir)).isDirectory();
  } catch {
    return false;
  }
}

/** True when `bin` is an executable in some `PATH` entry (like `which`, without spawning). */
export function commandExists(bin: string): boolean {
  const dirs = (process.env.PATH ?? "").split(path.delimiter);

  for (const dir of dirs) {
    try {
      accessSync(path.join(dir, bin), constants.X_OK);
      return true;
    } catch {
      // Not in this PATH entry — keep looking.
    }
  }
  return false;
}

/** Wraps `value` in single quotes for a POSIX shell, escaping any embedded ones. */
export function posixShellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
