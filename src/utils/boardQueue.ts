import type {
  BoardWatcherStatus,
  WatcherActivity,
  WatcherDecision,
  WatcherWork,
} from "../services/boardWatcherApi";

export type QueueState = "running" | "queued" | "next" | "waiting";

export type QueueItem = {
  subject: string;
  state: QueueState;
  work?: WatcherWork;
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
  // A PR (`repo#id`) is always a review; a ticket's work comes with its decision.
  const workOf = (decision: WatcherDecision): WatcherWork | undefined =>
    decision.work ?? (decision.subject.includes("#") ? "review" : undefined);
  if (current?.subject && (current.kind === "review" || current.kind === "test")) {
    add({ subject: current.subject, state: "running", work: current.kind });
  }
  for (const subject of status.pendingReviews) add({ subject, state: "queued", work: "review" });
  for (const subject of status.pendingTests) add({ subject, state: "queued", work: "test" });
  for (const decision of status.lastDecisions) {
    if (WILL_DO.has(decision.action)) {
      add({
        subject: decision.subject,
        state: "next",
        work: workOf(decision),
        reason: decision.reason,
        decision,
      });
    }
  }
  for (const decision of status.lastDecisions) {
    if (decision.action === "wait" || decision.action === "skip") {
      add({
        subject: decision.subject,
        state: "waiting",
        work: workOf(decision),
        reason: decision.reason,
        decision,
      });
    }
  }
  return items;
}
