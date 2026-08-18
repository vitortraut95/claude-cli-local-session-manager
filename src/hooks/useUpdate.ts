import { useCallback, useEffect, useRef, useState } from "react";
import * as systemApi from "../services/systemApi";
import type { UpdateJobStatus, UpdateStatus } from "../services/systemApi";
import { useLanguage } from "./useLanguage";
import { useToast } from "./useToast";

const JOB_POLL_INTERVAL_MS = 1000;
const JOB_POLL_TIMEOUT_MS = 5 * 60 * 1000;
const MIN_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Polls until the update job leaves "running"/"idle". Tolerant of individual poll failures:
 * `git pull` rewrites source files the dev server's `tsx watch` is watching, which restarts
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
  const { showToast } = useToast();
  const { t } = useLanguage();
  const lastRefreshRef = useRef(0);
  const mountedRef = useRef(true);

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

  const applyUpdate = useCallback(async () => {
    setUpdating(true);
    try {
      await systemApi.applyUpdate();
      const job = await waitForUpdateJob(t("useUpdate.timeoutError"));
      if (job.state === "error") throw new Error(job.message);
      showToast(t("useUpdate.updateSuccess"), "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("useUpdate.updateError"), "error");
    } finally {
      if (mountedRef.current) setUpdating(false);
      await refreshStatus(true);
    }
  }, [showToast, refreshStatus, t]);

  return { status, checking, updating, applyUpdate };
}
