import { useCallback, useEffect, useState } from "react";
import * as systemApi from "../services/systemApi";
import type { UpdateStatus } from "../services/systemApi";
import { useToast } from "./useToast";

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
