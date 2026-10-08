import { useCallback, useEffect, useState } from "react";
import * as tasksApi from "../services/tasksApi";
import type { SkillsHubStatus } from "../services/tasksApi";

/** Last status any instance loaded — seeds every new/reopened consumer so the New Task / New
 *  Session panel shows right away (then refreshes quietly) instead of popping in after a fetch. */
let lastStatus: SkillsHubStatus | null = null;

/**
 * The team skills hub status, loaded whenever `enabled` turns true and again on
 * every `SKILLS_HUB_CHANGED_EVENT` — shared by the New Task panel, the settings row and the
 * management modal so a change made in one shows up in the others. A failed load (including a
 * backend older than these routes) leaves `status` null with `failed` set: callers hide the feature
 * instead of showing an error, since it's optional. `status` null without `failed` = still loading.
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
