import type { WatcherActionEntry } from "../../shared/boardWatcher";
import type { Session } from "../../shared/session";
import type { QueueEntry } from "../../shared/tasks";

/** Where a session sits in the list, in this order: what's running first, done last. */
export type SessionGroup = "attention" | "running" | "stopped" | "done";

export const SESSION_GROUPS: readonly SessionGroup[] = ["running", "attention", "stopped", "done"];

const GROUP_RANK: Record<SessionGroup, number> = { running: 0, attention: 1, stopped: 2, done: 3 };

/** "groups": by group, then by the last update; "date": by the last update only. */
export type SessionSort = "groups" | "date";

/** Why a session needs you. */
export type AttentionReason =
  | { kind: "waitingUser" }
  | { kind: "launchError"; message: string }
  | { kind: "testFailed"; message: string }
  | { kind: "reviewFailed"; message: string };

/** The task-level problems the queue and the Board's watcher report, by ticket key. */
export type TaskProblems = Map<string, AttentionReason>;

/** The first line of a multi-line text (a report's verdict), else the text itself. */
function firstLine(text: string | undefined): string {
  return (text ?? "").split(/\r?\n/)[0]?.trim() ?? "";
}

/**
 * Problems per ticket key: a queue entry that failed to launch, or the watcher's latest action on
 * the key being a failed test or review (the same signals as the task status rows).
 */
export function buildTaskProblems(
  queue: QueueEntry[],
  actions: WatcherActionEntry[],
): TaskProblems {
  const problems: TaskProblems = new Map();
  for (const entry of queue) {
    if (entry.error && !problems.has(entry.key)) {
      problems.set(entry.key, { kind: "launchError", message: entry.error });
    }
  }
  // Newest first, so the first action per key is its latest.
  const seen = new Set<string>();
  for (const action of actions) {
    if (seen.has(action.subject)) continue;
    seen.add(action.subject);
    if (problems.has(action.subject)) continue;
    const message = firstLine(action.detail) || action.title;
    if (action.action === "test-failed") {
      problems.set(action.subject, { kind: "testFailed", message });
    } else if (action.action === "review-failed") {
      problems.set(action.subject, { kind: "reviewFailed", message });
    }
  }
  return problems;
}

/** The task's key, or the test's when the session has no task. */
export function sessionKey(session: Session): string {
  return (
    [session.taskKey, session.testKey].map((key) => key?.trim() ?? "").find((key) => key !== "") ??
    ""
  );
}

/** What needs the user on this session, worst first; null = nothing. */
export function attentionReason(session: Session, problems: TaskProblems): AttentionReason | null {
  // A missing folder is a removed worktree: the work there is over, nothing to do.
  if (session.directoryMissing) return null;
  const key = sessionKey(session);
  const problem = key ? problems.get(key) : undefined;
  // A done task's old failure no longer needs anyone.
  if (problem && session.status !== "done") return problem;
  if (session.status === "waiting_user") return { kind: "waitingUser" };
  return null;
}

export function sessionGroup(session: Session, problems: TaskProblems): SessionGroup {
  if (attentionReason(session, problems)) return "attention";
  if (session.isActive) return "running";
  if (session.status === "done" || session.directoryMissing) return "done";
  return "stopped";
}

export function compareSessions(
  a: Session,
  b: Session,
  problems: TaskProblems,
  sort: SessionSort = "groups",
): number {
  if (sort === "date") return b.updatedAt.localeCompare(a.updatedAt);
  const byGroup = GROUP_RANK[sessionGroup(a, problems)] - GROUP_RANK[sessionGroup(b, problems)];
  return byGroup !== 0 ? byGroup : b.updatedAt.localeCompare(a.updatedAt);
}
