import type {
  BoardWatcherStatus,
  WatcherActivity,
  WatcherDecision,
} from "../services/boardWatcherApi";

export type QueueState = "running" | "queued" | "next" | "waiting";

export type QueueItem = {
  subject: string;
  state: QueueState;
  reason?: string;
  decision?: WatcherDecision;
};

const WILL_DO = new Set<WatcherDecision["action"]>([
  "review",
  "claim-test",
  "retest",
  "enqueue-dev",
  "start-progress",
]);

/** Everything in line, once each, most urgent first: what's running, what waits for a session,
 *  what the last look will do and what's on hold (with why). */
export function queueItems(
  status: BoardWatcherStatus,
  current: WatcherActivity["current"],
): QueueItem[] {
  const items: QueueItem[] = [];
  const seen = new Set<string>();
  const add = (item: QueueItem) => {
    if (seen.has(item.subject)) return;
    seen.add(item.subject);
    items.push(item);
  };
  if (current?.subject && (current.kind === "review" || current.kind === "test")) {
    add({ subject: current.subject, state: "running" });
  }
  for (const subject of [...status.pendingReviews, ...status.pendingTests]) {
    add({ subject, state: "queued" });
  }
  for (const decision of status.lastDecisions) {
    if (WILL_DO.has(decision.action)) {
      add({ subject: decision.subject, state: "next", reason: decision.reason, decision });
    }
  }
  for (const decision of status.lastDecisions) {
    if (decision.action === "wait" || decision.action === "skip") {
      add({ subject: decision.subject, state: "waiting", reason: decision.reason, decision });
    }
  }
  return items;
}
