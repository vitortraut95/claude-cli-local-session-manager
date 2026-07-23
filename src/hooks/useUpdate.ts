import { useCallback, useEffect, useState } from "react";
import * as systemApi from "../services/systemApi";
import type { UpdateJobStatus, UpdateStatus } from "../services/systemApi";
import { useToast } from "./useToast";

const JOB_POLL_INTERVAL_MS = 1000;
const JOB_POLL_TIMEOUT_MS = 5 * 60 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Polls until the update job leaves "running"/"idle". Tolerant of individual poll failures:
 * `git pull` rewrites source files the dev server's `tsx watch` is watching, which restarts
 * the API process mid-update — polls landing in that brief gap fail transiently and just get
 * retried, rather than aborting the whole wait.
 */
async function waitForUpdateJob(): Promise<UpdateJobStatus> {
  const deadline = Date.now() + JOB_POLL_TIMEOUT_MS;
  let job: UpdateJobStatus = { state: "idle" };

  while (job.state === "idle" || job.state === "running") {
    if (Date.now() > deadline) {
      throw new Error("Timed out waiting for the update to finish.");
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

  const refreshStatus = useCallback(async () => {
    setChecking(true);
    try {
      const data = await systemApi.fetchUpdateStatus();
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshStatus();
  }, [refreshStatus]);

  const applyUpdate = useCallback(async () => {
    setUpdating(true);
    try {
      await systemApi.applyUpdate();
      const job = await waitForUpdateJob();
      if (job.state === "error") throw new Error(job.message);
      showToast("Updated successfully. Restart the app to load the new version.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not update the application.", "error");
    } finally {
      setUpdating(false);
      await refreshStatus();
    }
  }, [showToast, refreshStatus]);

  return { status, checking, updating, applyUpdate };
}
