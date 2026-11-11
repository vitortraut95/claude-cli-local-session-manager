import { useEffect, useState } from "react";
import * as tasksApi from "../services/tasksApi";
import type { QueueLaunch } from "../services/tasksApi";

/** Looked at this often while something is launching, and this often otherwise. */
const ACTIVE_POLL_MS = 1_500;
const IDLE_POLL_MS = 5_000;

/**
 * The queue's launches (scheduler, "Start now", Board), polled while the page is visible: fast
 * while one is running. The ones that had already finished when this page first looked are left
 * out.
 */
export function useQueueLaunches(): QueueLaunch[] {
  const [launches, setLaunches] = useState<QueueLaunch[]>([]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let first = true;
    const stale = new Set<string>();

    const poll = async () => {
      window.clearTimeout(timer);
      let running = false;
      if (document.visibilityState === "visible") {
        try {
          const list = await tasksApi.fetchQueueLaunches();
          if (cancelled) return;
          if (first) {
            for (const launch of list) if (launch.finishedAt) stale.add(launch.id);
            first = false;
          }
          const shown = list.filter((launch) => !stale.has(launch.id));
          running = shown.some((launch) => !launch.finishedAt);
          setLaunches(shown);
        } catch {
          // Shown again on the next look.
        }
      }
      if (!cancelled) timer = window.setTimeout(poll, running ? ACTIVE_POLL_MS : IDLE_POLL_MS);
    };

    // A launch this tab started: look now, and once more as the server may not have begun yet.
    const onStarted = () => {
      void poll();
      window.setTimeout(() => void poll(), 700);
    };

    void poll();
    window.addEventListener(tasksApi.QUEUE_LAUNCH_STARTED_EVENT, onStarted);
    document.addEventListener("visibilitychange", onStarted);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener(tasksApi.QUEUE_LAUNCH_STARTED_EVENT, onStarted);
      document.removeEventListener("visibilitychange", onStarted);
    };
  }, []);

  return launches;
}
