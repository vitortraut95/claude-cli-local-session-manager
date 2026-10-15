import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { REPO_ROOT } from "./repoRoot.js";

/**
 * Per-session origin/destination branches the user set by hand (the card's branch editor) or that
 * the "New task" flow recorded at launch — same gitignored sidecar convention as `nicknames.ts`.
 * Keyed by session id, not by branch like `taskBaseBranches.ts`: what's being corrected here is one
 * session's view of its branches (e.g. a transcript-recorded `gitBranch` gone stale), not a fact
 * about the branch itself. Either side may be null (only one of them overridden); an entry with
 * both null is dropped.
 */
export type SessionBranchOverride = { origin: string | null; destination: string | null };

function getSessionBranchesPath(): string {
  return path.join(REPO_ROOT, "session-branches.json");
}

function asBranchOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function getSessionBranches(): Promise<Record<string, SessionBranchOverride>> {
  try {
    const raw = await readFile(getSessionBranchesPath(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result: Record<string, SessionBranchOverride> = {};
    for (const [id, entry] of Object.entries(parsed as Record<string, unknown>)) {
      if (!entry || typeof entry !== "object") continue;
      const { origin, destination } = entry as Record<string, unknown>;
      result[id] = { origin: asBranchOrNull(origin), destination: asBranchOrNull(destination) };
    }
    return result;
  } catch {
    return {};
  }
}

/** Blank/whitespace-only values clear that side; both blank removes the entry. */
export async function setSessionBranchOverride(
  id: string,
  origin: string,
  destination: string,
): Promise<void> {
  const all = await getSessionBranches();
  const entry = { origin: asBranchOrNull(origin), destination: asBranchOrNull(destination) };
  if (entry.origin || entry.destination) {
    all[id] = entry;
  } else {
    delete all[id];
  }
  await writeFile(getSessionBranchesPath(), JSON.stringify(all, null, 2), "utf8");
}
