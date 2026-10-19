import { useCallback, useEffect, useState } from "react";
import * as tasksApi from "../services/tasksApi";
import type { SkillsHubStatus } from "../services/tasksApi";

/** Last status any instance loaded — seeds new consumers so they render before the fetch. */
let lastStatus: SkillsHubStatus | null = null;

/**
 * Skills hub status, loaded when `enabled` turns true and on every `SKILLS_HUB_CHANGED_EVENT`.
 * `status` null + `failed` = load failed (callers hide the feature); null without `failed` =
 * still loading.
 */
export function useSkillsHubStatus(enabled: boolean) {
  const [status, setStatus] = useState<SkillsHubStatus | null>(lastStatus);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const next = await tasksApi.fetchSkillsHubStatus();
      lastStatus = next;
      setStatus(next);
      setFailed(false);
    } catch {
      lastStatus = null;
      setStatus(null);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    // Fetch-on-open — the state updates only happen inside `reload`'s own async flow.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    const onChanged = () => void reload();
    window.addEventListener(tasksApi.SKILLS_HUB_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(tasksApi.SKILLS_HUB_CHANGED_EVENT, onChanged);
  }, [enabled, reload]);

  return { status, setStatus, loading, failed, reload };
}
