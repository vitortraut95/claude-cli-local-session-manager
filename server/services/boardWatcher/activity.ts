import type {
  WatcherActivity,
  WatcherActivityEvent,
  WatcherActivityKind,
} from "../../../shared/boardWatcher.js";

/**
 * The watcher's live feed for the Board: each step as it happens (a look reading the board, a
 * review session, a build diagnosis…), and what's running right now. In memory only, the last
 * MAX_EVENTS; the Board asks for the ones after the last it has.
 */

const MAX_EVENTS = 80;
let seq = 0;
const events: WatcherActivityEvent[] = [];
/** Several things can run at once (a look and a review): the most recent one is shown. */
const running = new Map<string, { kind: WatcherActivityKind; subject?: string; since: string }>();

export function noteActivity(kind: WatcherActivityKind, subject?: string, detail?: string): void {
  seq += 1;
  events.push({
    seq,
    at: new Date().toISOString(),
    kind,
    ...(subject ? { subject } : {}),
    ...(detail ? { detail } : {}),
  });
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
}

/** Marks a step as running (also noted in the feed); the returned function ends it. */
export function startActivity(kind: WatcherActivityKind, subject?: string): () => void {
  const key = `${kind}:${subject ?? ""}:${seq + 1}`;
  noteActivity(kind, subject);
  running.set(key, { kind, subject, since: new Date().toISOString() });
  return () => {
    running.delete(key);
  };
}

export function readActivity(after = 0): WatcherActivity {
  const current = [...running.values()].at(-1) ?? null;
  return { events: events.filter((event) => event.seq > after), current };
}
