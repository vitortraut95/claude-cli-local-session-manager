import { readdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * Active sessions come from the CLI's state files `~/.claude/sessions/<pid>.json`
 * (`{pid, sessionId, ...}`, removed on clean exit), confirmed with a signal-0 `kill` since a dead
 * pid's file is a leftover. `ps` can't be used: the CLI hides its args.
 */
function getClaudeSessionsDir(): string {
  return path.join(os.homedir(), ".claude", "sessions");
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function getActiveResumeSessionIds(): Promise<Set<string>> {
  const dir = getClaudeSessionsDir();
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return new Set();
  }

  const ids = new Set<string>();
  await Promise.all(
    entries
      .filter((name) => name.endsWith(".json"))
      .map(async (name) => {
        try {
          const raw = await readFile(path.join(dir, name), "utf-8");
          const data = JSON.parse(raw) as { pid?: number; sessionId?: string };
          if (data.pid && data.sessionId && isProcessAlive(data.pid)) {
            ids.add(data.sessionId);
          }
        } catch {
          // Ignore unreadable/malformed session state files.
        }
      }),
  );
  return ids;
}

/** The live pid running `sessionId`, if any. */
export async function findActiveSessionPid(sessionId: string): Promise<number | null> {
  const dir = getClaudeSessionsDir();
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return null;
  }

  for (const name of entries.filter((n) => n.endsWith(".json"))) {
    try {
      const raw = await readFile(path.join(dir, name), "utf-8");
      const data = JSON.parse(raw) as { pid?: number; sessionId?: string };
      if (data.sessionId === sessionId && data.pid && isProcessAlive(data.pid)) {
        return data.pid;
      }
    } catch {
      // Ignore unreadable/malformed session state files.
    }
  }
  return null;
}

/** Polls until `pid` is gone or `timeoutMs` elapses. */
export function waitForProcessExit(pid: number, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (!isProcessAlive(pid) || Date.now() - start > timeoutMs) {
        clearInterval(interval);
        resolve();
      }
    }, 200);
  });
}
