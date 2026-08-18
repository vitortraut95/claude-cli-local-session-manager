import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * Local "Compact & continue" links, stored in this app's own sidecar file — never inside
 * `~/.claude/projects/`, same reasoning as `nicknames.ts`. The Claude CLI has no notion of one
 * session being a follow-up of another, so this app tracks it itself: each entry records the
 * *new* ("pt2") session's id, pointing back at the old one it was compacted from.
 */
export type ContinuationEntry = {
  continuesFrom: string;
  createdAt: string;
};

function getContinuationsPath(): string {
  return path.join(os.homedir(), ".claude-session-manager", "session-continuations.json");
}

export async function getContinuations(): Promise<Record<string, ContinuationEntry>> {
  try {
    const raw = await readFile(getContinuationsPath(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, ContinuationEntry>;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Called right before the new ("pt2") session's terminal is launched — `newSessionId` is already
 * known at that point (see `--session-id`, generated server-side), so there's no "match it up
 * later" step: the link exists from the very first moment the new session does.
 */
export async function linkContinuation(newSessionId: string, oldSessionId: string): Promise<void> {
  const continuations = await getContinuations();
  continuations[newSessionId] = { continuesFrom: oldSessionId, createdAt: new Date().toISOString() };

  const filePath = getContinuationsPath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(continuations, null, 2), "utf8");
}

/** The reverse of `continuesFrom` isn't stored separately (nothing to keep in sync that way) —
 *  it's derived by scanning for the one entry (if any) whose `continuesFrom` is `oldSessionId`. */
export function findContinuedBy(
  continuations: Record<string, ContinuationEntry>,
  oldSessionId: string,
): string | null {
  for (const [newId, entry] of Object.entries(continuations)) {
    if (entry.continuesFrom === oldSessionId) return newId;
  }
  return null;
}
