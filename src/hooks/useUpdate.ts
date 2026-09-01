import { useCallback, useEffect, useRef, useState } from "react";
import * as systemApi from "../services/systemApi";
import type { UpdateJobStatus, UpdateStatus } from "../services/systemApi";
import { useLanguage } from "./useLanguage";
import { useToast } from "./useToast";
import { resolveApiErrorMessage } from "../utils/apiClient";

const JOB_POLL_INTERVAL_MS = 1000;
const JOB_POLL_TIMEOUT_MS = 5 * 60 * 1000;
const MIN_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Polls until the update job leaves "running"/"idle". Tolerant of individual poll failures: the
 * forced git reset rewrites source files the dev server's `tsx watch` is watching, which restarts
 * the API process mid-update — polls landing in that brief gap fail transiently and just get
 * retried, rather than aborting the whole wait.
 */
async function waitForUpdateJob(timeoutMessage: string): Promise<UpdateJobStatus> {
  const deadline = Date.now() + JOB_POLL_TIMEOUT_MS;
  let job: UpdateJobStatus = { state: "idle" };

  while (job.state === "idle" || job.state === "running") {
    if (Date.now() > deadline) {
      throw new Error(timeoutMessage);
    }
    await sleep(JOB_POLL_INTERVAL_MS);
    try {
      job = await systemApi.fetchUpdateJobStatus();
    } catch {
      // transient — the API process may be mid-restart; keep polling.
    }
  }

  return job;
}

export function useUpdate() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [updating, setUpdating] = useState(false);
  // Separate from `updating`: only true for the silent, startup-triggered update below — this is
  // what drives the blocking full-screen overlay, so a manual click of the update button (which
  // already has its own inline spinner/toast) never gets the overlay treatment too.
  const [autoUpdating, setAutoUpdating] = useState(false);
  const [autoUpdateError, setAutoUpdateError] = useState<string | null>(null);
  const { showToast } = useToast();
  const { t } = useLanguage();
  const lastRefreshRef = useRef(0);
  const mountedRef = useRef(true);
  // Guards the auto-update effect below so it only ever acts on the very first status check (app
  // launch) — later checks (on window focus/visibility) must never yank the app into a blocking
  // overlay while someone's mid-task.
  const initialCheckDoneRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshStatus = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastRefreshRef.current < MIN_REFRESH_INTERVAL_MS) {
      return;
    }

    lastRefreshRef.current = now;
    setChecking(true);
    try {
      const data = await systemApi.fetchUpdateStatus();
      if (mountedRef.current) setStatus(data);
    } catch {
      if (mountedRef.current) setStatus(null);
    } finally {
      if (mountedRef.current) setChecking(false);
    }
  }, []);

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshStatus();
      }
    };

    window.setTimeout(refreshIfVisible, 0);

    document.addEventListener("visibilitychange", refreshIfVisible);
    window.addEventListener("focus", refreshIfVisible);

    return () => {
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.removeEventListener("focus", refreshIfVisible);
    };
  }, [refreshStatus]);

  /** `silent: true` is the startup auto-update path (see the effect below): no toast, and a
   *  successful run reloads the page instead, since the point is to land the user straight on the
   *  freshly updated app rather than have them notice a toast and keep using the stale bundle. */
  const applyUpdate = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      setUpdating(true);
      if (silent) {
        setAutoUpdating(true);
        setAutoUpdateError(null);
      }
      try {
        await systemApi.applyUpdate();
        const job = await waitForUpdateJob(t("useUpdate.timeoutError"));
        if (job.state === "error") throw Object.assign(new Error(job.message), { code: job.code });
        if (silent) {
          window.location.reload();
          return;
        }
        showToast(t("useUpdate.updateSuccess"), "success");
      } catch (err) {
        const message = resolveApiErrorMessage(err, t, "useUpdate.updateError");
        if (silent) {
          if (mountedRef.current) setAutoUpdateError(message);
        } else {
          showToast(message, "error");
        }
      } finally {
        if (mountedRef.current) {
          setUpdating(false);
          if (silent) setAutoUpdating(false);
        }
        await refreshStatus(true);
      }
    },
    [showToast, refreshStatus, t],
  );

  // Startup auto-update: once the very first status check resolves, if an update is already
  // available, apply it immediately and silently rather than waiting for the user to notice and
  // click the button — see `autoUpdating`/`autoUpdateError` above for how the caller surfaces this.
  // `applyUpdate` itself owns every setState call for this path (including flipping `autoUpdating`
  // on) — the effect body only ever calls it, never sets state directly.
  useEffect(() => {
    if (checking) return;
    if (initialCheckDoneRef.current) return;
    initialCheckDoneRef.current = true;
    if (!status?.updateAvailable) return;
    // Deferred via a 0ms timer so applyUpdate's setState calls happen in a callback, not
    // synchronously in the effect body itself (same pattern NewTaskModal's project-folder fetch
    // uses, for the same reason).
    const timer = setTimeout(() => {
      void applyUpdate({ silent: true });
    }, 0);
    return () => clearTimeout(timer);
  }, [checking, status, applyUpdate]);

  const dismissAutoUpdateError = useCallback(() => setAutoUpdateError(null), []);

  return {
    status,
    checking,
    updating,
    applyUpdate,
    autoUpdating,
    autoUpdateError,
    dismissAutoUpdateError,
  };
}
