import { readFile } from "node:fs/promises";
import path from "node:path";
import { HISTORY_FILE } from "../utils/history.js";

/**
 * Reads `history.jsonl` back for a session card: the events tied to it and a summary of where
 * its task's time went. An event belongs to a session when it carries its task key or session id,
 * or — for heavy-run events, which only know their folder — ran inside its worktree.
 */

export type HistoryEvent = { ts: string; type: string } & Record<string, unknown>;

export async function readHistory(): Promise<HistoryEvent[]> {
  let raw: string;
  try {
    raw = await readFile(HISTORY_FILE, "utf8");
  } catch {
    return [];
  }
  const events: HistoryEvent[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as Partial<HistoryEvent>;
      if (typeof parsed.ts === "string" && typeof parsed.type === "string") {
        events.push(parsed as HistoryEvent);
      }
    } catch {
      // A torn or hand-edited line is skipped.
    }
  }
  return events;
}

export type HistoryTarget = {
  sessionId: string;
  taskKey: string | null;
  /** Only for a linked worktree: a repo root's folder is shared by every task in it. */
  worktreePath: string | null;
};

function isInside(dir: unknown, root: string): boolean {
  if (typeof dir !== "string") return false;
  const resolved = path.resolve(dir);
  const base = path.resolve(root);
  return resolved === base || resolved.startsWith(`${base}${path.sep}`);
}

export function belongsTo(event: HistoryEvent, target: HistoryTarget): boolean {
  if (target.taskKey && event.key === target.taskKey) return true;
  if (event.sessionId === target.sessionId) return true;
  // Root events name the holder; a refusal also names the worktree that asked.
  if (target.taskKey && event.heldBy === target.taskKey) return true;
  if (target.worktreePath && isInside(event.worktreePath, target.worktreePath)) return true;
  if (event.type === "sessions.resumeOpen" && Array.isArray(event.resumed)) {
    return event.resumed.some((r) => (r as { id?: unknown }).id === target.sessionId);
  }
  if (target.worktreePath && event.type.startsWith("heavy.")) {
    return isInside(event.cwd, target.worktreePath);
  }
  return false;
}

export type HistorySummary = {
  /** From entering the queue to its session opening. */
  queuedMs: number | null;
  /** Scheduler blocks (any task's) while this one was waiting in line, by reason. */
  queueBlocks: { reason: string; durationMs: number }[];
  /** Time spent in each status, from its changes up to now. */
  statusMs: Record<string, number>;
  currentStatus: string | null;
  /** First event to "done", when it got there. */
  totalMs: number | null;
  heavyRuns: number;
  heavyFailed: number;
  heavyOverCap: number;
  heavySlotWaitS: number;
  heavyMemoryWaitS: number;
  heavyDurationS: number;
  heavyBlocked: number;
  rootHeldMs: number;
  rootRefused: number;
  errors: { ts: string; type: string; message: string }[];
};

const num = (value: unknown): number => (typeof value === "number" ? value : 0);

export function summarize(
  events: HistoryEvent[],
  all: HistoryEvent[],
  now = Date.now(),
): HistorySummary {
  const at = (e: HistoryEvent) => Date.parse(e.ts);
  const added = events.find((e) => e.type === "queue.added");
  const launched = events.find((e) => e.type === "queue.launched");

  const queueBlocks: Record<string, number> = {};
  if (added) {
    const from = at(added);
    const to = launched ? at(launched) : now;
    for (const e of all) {
      if (e.type !== "scheduler.unblocked") continue;
      const end = at(e);
      const start = end - num(e.durationMs);
      const overlap = Math.min(end, to) - Math.max(start, from);
      if (overlap > 0) {
        const reason = String(e.reason);
        queueBlocks[reason] = (queueBlocks[reason] ?? 0) + overlap;
      }
    }
  }

  const statusMs: Record<string, number> = {};
  let current: { status: string | null; since: number } | null = null;
  let doneAt: number | null = null;
  for (const e of events) {
    if (e.type !== "status.changed") continue;
    if (current?.status) {
      statusMs[current.status] = (statusMs[current.status] ?? 0) + at(e) - current.since;
    }
    current = { status: typeof e.to === "string" ? e.to : null, since: at(e) };
    if (e.to === "done") doneAt ??= at(e);
  }
  if (current?.status && current.status !== "done") {
    statusMs[current.status] = (statusMs[current.status] ?? 0) + now - current.since;
  }

  const heavy = events.filter((e) => e.type === "heavy.run");
  const errors = events
    .filter((e) => e.type.endsWith(".failed") || e.type === "scheduler.error")
    .map((e) => ({ ts: e.ts, type: e.type, message: typeof e.error === "string" ? e.error : "" }));
  for (const e of events) {
    if (e.type === "heavy.timeout") {
      errors.push({
        ts: e.ts,
        type: e.type,
        message: `${String(e.command)} (${String(e.reason)}, ${String(e.waitedS)}s)`,
      });
    }
  }
  for (const e of heavy) {
    if (e.status === 137 || e.status === 134) {
      errors.push({
        ts: e.ts,
        type: "heavy.overCap",
        message: `${String(e.command)} (exit ${String(e.status)})`,
      });
    }
  }
  errors.sort((a, b) => a.ts.localeCompare(b.ts));

  const first = events[0];
  return {
    queuedMs: launched ? num(launched.queuedMs) || null : null,
    queueBlocks: Object.entries(queueBlocks).map(([reason, durationMs]) => ({
      reason,
      durationMs,
    })),
    statusMs,
    currentStatus: current?.status ?? null,
    totalMs: first && doneAt !== null ? doneAt - at(first) : null,
    heavyRuns: heavy.length,
    heavyFailed: heavy.filter((e) => num(e.status) !== 0).length,
    heavyOverCap: heavy.filter((e) => e.status === 137 || e.status === 134).length,
    heavySlotWaitS: heavy.reduce((sum, e) => sum + num(e.slotWaitS), 0),
    heavyMemoryWaitS: heavy.reduce((sum, e) => sum + num(e.memoryWaitS), 0),
    heavyDurationS: heavy.reduce((sum, e) => sum + num(e.durationS), 0),
    heavyBlocked: events.filter((e) => e.type === "heavy.blocked").length,
    rootHeldMs: events
      .filter((e) => e.type === "root.released")
      .reduce((sum, e) => sum + num(e.heldMs), 0),
    rootRefused: events.filter((e) => e.type === "root.refused").length,
    errors,
  };
}
