import { useCallback, useEffect, useMemo, useState } from "react";
import * as boardWatcherApi from "../services/boardWatcherApi";
import * as tasksApi from "../services/tasksApi";
import type { WatcherActionEntry } from "../../shared/boardWatcher";
import type { QueueEntry } from "../../shared/tasks";
import { buildTaskProblems } from "../utils/sessionGroups";

/** How often the queue and the watcher's actions are re-read (the sessions come from the page). */
const REFRESH_MS = 30_000;

/**
 * The task queue and the Board watcher's latest actions, re-read in the background: they put
 * sessions in "needs you" (a launch error, a failed test or review) and give the navigation its
 * queue count. A failed read keeps the last good data.
 */
export function useTaskSignals() {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [actions, setActions] = useState<WatcherActionEntry[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void Promise.all([
        tasksApi.fetchTaskQueue().catch(() => null),
        boardWatcherApi.fetchWatcherActions(200).catch(() => null),
      ]).then(([nextQueue, nextActions]) => {
        if (cancelled) return;
        if (nextQueue) setQueue(nextQueue);
        if (nextActions) setActions(nextActions);
      });
    };
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [reloadKey]);

  const problems = useMemo(() => buildTaskProblems(queue, actions), [queue, actions]);
  /** Entries still waiting for their session (what the queue page lists as "in line"). */
  const pendingQueueCount = queue.filter((entry) => !entry.launchedAt).length;
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  return {
    queue,
    actions,
    problems,
    pendingQueueCount,
    /** Re-reads now (after the queue was saved, for instance). */
    reload,
  };
}
