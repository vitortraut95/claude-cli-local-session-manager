import { appendFile } from "node:fs/promises";
import path from "node:path";
import { REPO_ROOT } from "./repoRoot.js";

/**
 * Append-only event log of the task flow (queue, scheduler, status changes, root lock, cleanup,
 * launches), one JSON object per line in the gitignored `history.jsonl` at the repo root, for
 * measuring where time goes and finding errors. `scripts/heavy-run` and its hook append to the
 * same file. Each line: `{ "ts": ISO time, "type": "<area>.<event>", ...data }`.
 */

export const HISTORY_FILE = path.join(REPO_ROOT, "history.jsonl");

/** Best-effort: a failed write never breaks the action being recorded. */
export function recordEvent(type: string, data: Record<string, unknown> = {}): void {
  const line = `${JSON.stringify({ ts: new Date().toISOString(), type, ...data })}\n`;
  void appendFile(HISTORY_FILE, line, "utf8").catch((err: unknown) => {
    console.warn("[history] Couldn't record event:", err);
  });
}
