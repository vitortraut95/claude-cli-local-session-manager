import type { WatcherActionEntry } from "../../shared/boardWatcher";
import type { Session, WorkStatus } from "../../shared/session";
import type { QueueEntry } from "../../shared/tasks";

/** Worst first: a problem outranks waiting, which outranks running. */
export type TaskStatusLevel = "problem" | "waiting" | "running";

export type TaskStatusReason =
  | { kind: "running" }
  | { kind: "inProgress" }
  | { kind: "waitingUser" }
  | { kind: "todo" }
  | { kind: "queued" }
  | { kind: "launchError"; message: string }
  | { kind: "testFailed"; message: string }
  | { kind: "reviewFailed"; message: string };

export type TaskStatusRow = {
  key: string;
  title: string;
  level: TaskStatusLevel;
  reason: TaskStatusReason;
  /** Last interaction: the newest of the sessions, queue and actions for this key. */
  lastAt: string;
};

const LEVEL_RANK: Record<TaskStatusLevel, number> = { problem: 0, waiting: 1, running: 2 };

type Signal = { level: TaskStatusLevel; reason: TaskStatusReason };

/** The first line of a multi-line text (a report's verdict), else the text itself. */
function firstLine(text: string | undefined): string {
  return (text ?? "").split(/\r?\n/)[0]?.trim() ?? "";
}

/** The session's nickname, else its title. */
function titleOf(session: Session | undefined): string {
  return (
    [session?.nickname, session?.title]
      .map((text) => text?.trim() ?? "")
      .find((text) => text !== "") ?? ""
  );
}

/**
 * One row per ticket key that isn't done: the sessions, the task queue and the watcher's actions
 * give each key its signals, and the worst one sets its color. Keys with no signal (only `done`)
 * are left out.
 */
export function buildTaskStatusRows(input: {
  sessions: Session[];
  queue: QueueEntry[];
  actions: WatcherActionEntry[];
}): TaskStatusRow[] {
  // The task's key, or the test's when the session has no task.
  const keyOf = (value: { taskKey?: string | null; testKey?: string | null }) =>
    [value.taskKey, value.testKey].map((key) => key?.trim() ?? "").find((key) => key !== "") ?? "";

  const sessionsByKey = new Map<string, Session[]>();
  for (const session of input.sessions) {
    const key = keyOf(session);
    if (!key) continue;
    sessionsByKey.set(key, [...(sessionsByKey.get(key) ?? []), session]);
  }

  const queueByKey = new Map<string, QueueEntry[]>();
  for (const entry of input.queue) {
    queueByKey.set(entry.key, [...(queueByKey.get(entry.key) ?? []), entry]);
  }

  // Newest first, so the first match per key is its latest action.
  const latestActionByKey = new Map<string, WatcherActionEntry>();
  for (const action of input.actions) {
    if (!latestActionByKey.has(action.subject)) latestActionByKey.set(action.subject, action);
  }

  const keys = new Set([
    ...sessionsByKey.keys(),
    ...queueByKey.keys(),
    ...latestActionByKey.keys(),
  ]);
  const rows: { row: TaskStatusRow; lastMs: number }[] = [];

  for (const key of keys) {
    const sessions = [...(sessionsByKey.get(key) ?? [])].sort(
      (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
    );
    const queue = queueByKey.get(key) ?? [];
    const action = latestActionByKey.get(key);

    const workStatus: WorkStatus | null = sessions.find((s) => s.status)?.status ?? null;
    const hasActive = sessions.some((session) => session.isActive);
    const queueError = queue.find((entry) => entry.error);
    const queuePending = queue.find((entry) => !entry.error && !entry.launchedAt);

    const stamps = [
      ...sessions.map((session) => session.updatedAt),
      ...queue.flatMap((entry) => [entry.addedAt, entry.launchedAt ?? ""]),
      ...(action ? [action.ts] : []),
    ].filter(Boolean);
    const lastAt = stamps.reduce(
      (latest, stamp) => (Date.parse(stamp) > Date.parse(latest) ? stamp : latest),
      stamps[0] ?? "",
    );

    // Listed in priority order; the sort below keeps that order within a level.
    const signals: Signal[] = [];
    if (queueError) {
      signals.push({
        level: "problem",
        reason: { kind: "launchError", message: queueError.error ?? "" },
      });
    }
    if (action?.action === "test-failed") {
      signals.push({
        level: "problem",
        reason: { kind: "testFailed", message: firstLine(action.detail) || action.title },
      });
    }
    if (action?.action === "review-failed") {
      signals.push({
        level: "problem",
        reason: { kind: "reviewFailed", message: firstLine(action.detail) || action.title },
      });
    }
    if (hasActive) signals.push({ level: "running", reason: { kind: "running" } });
    if (workStatus === "in_progress") {
      signals.push({ level: "running", reason: { kind: "inProgress" } });
    }
    if (workStatus === "waiting_user") {
      signals.push({ level: "waiting", reason: { kind: "waitingUser" } });
    }
    if (workStatus === "todo") signals.push({ level: "waiting", reason: { kind: "todo" } });
    if (queuePending) signals.push({ level: "waiting", reason: { kind: "queued" } });

    if (signals.length === 0) continue;
    const primary = [...signals].sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level])[0]!;
    const title = titleOf(sessions[0]);

    rows.push({
      row: { key, title, level: primary.level, reason: primary.reason, lastAt },
      lastMs: Date.parse(lastAt) || 0,
    });
  }

  return rows.sort((a, b) => b.lastMs - a.lastMs).map((item) => item.row);
}
