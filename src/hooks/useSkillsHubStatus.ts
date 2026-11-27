import { useCallback, useEffect, useState } from "react";
import * as skillsHubApi from "../services/skillsHubApi";
import type { SkillsHubStatus } from "../services/skillsHubApi";

/** How often to check again while the server says a hub sync is running. */
const SYNC_RECHECK_MS = 3_000;

/** Last status any instance loaded — seeds new consumers so they render before the fetch. */
let lastStatus: SkillsHubStatus | null = null;

/**
 * Skills hub status, loaded when `enabled` turns true and on every `SKILLS_HUB_CHANGED_EVENT`; while
 * the server reports a hub sync running (e.g. the one on server start), loaded again until it ends.
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
      const next = await skillsHubApi.fetchSkillsHubStatus();
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
    window.addEventListener(skillsHubApi.SKILLS_HUB_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(skillsHubApi.SKILLS_HUB_CHANGED_EVENT, onChanged);
  }, [enabled, reload]);

  const syncing = enabled && status?.syncing === true;
  useEffect(() => {
    if (!syncing) return;
    const timer = window.setTimeout(() => void reload(), SYNC_RECHECK_MS);
    return () => window.clearTimeout(timer);
  }, [syncing, status, reload]);

  return { status, setStatus, loading, failed, reload };
}
