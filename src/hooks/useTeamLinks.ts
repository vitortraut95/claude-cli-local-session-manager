import { useSyncExternalStore } from "react";
import * as tasksApi from "../services/tasksApi";
import type { EnvPreviews } from "../services/tasksApi";

/** Legacy `.env` value: used while `jenkinsBaseUrl` is null (never set), and as the prompt's
 *  prefill. */
export const LEGACY_ENV_JENKINS_BASE_URL =
  (import.meta.env.VITE_JENKINS_BASE_URL as string | undefined)?.trim() ?? "";

export type TeamLinks = {
  /** Null = no Jenkins configured (button hidden). */
  jenkinsBaseUrl: string | null;
  envPreviews: EnvPreviews;
};

const EMPTY: TeamLinks = { jenkinsBaseUrl: LEGACY_ENV_JENKINS_BASE_URL || null, envPreviews: {} };

let snapshot: TeamLinks = EMPTY;
const listeners = new Set<() => void>();
let started = false;

function load() {
  tasksApi
    .fetchPreferences()
    .then((prefs) => {
      const stored = prefs.jenkinsBaseUrl;
      const base = stored == null ? LEGACY_ENV_JENKINS_BASE_URL : stored.trim();
      snapshot = { jenkinsBaseUrl: base || null, envPreviews: prefs.envPreviews ?? {} };
      listeners.forEach((listener) => listener());
    })
    .catch(() => undefined);
}

function subscribe(listener: () => void) {
  if (!started) {
    started = true;
    load();
    window.addEventListener(tasksApi.PREFERENCES_CHANGED_EVENT, load);
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Jenkins/preview-link config for the session cards — fetched once for all of them and reloaded
 *  on `PREFERENCES_CHANGED_EVENT`. */
export function useTeamLinks(): TeamLinks {
  return useSyncExternalStore(subscribe, () => snapshot);
}
