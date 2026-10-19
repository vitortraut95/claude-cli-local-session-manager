import { useSyncExternalStore } from "react";
import * as tasksApi from "../services/tasksApi";
import type { EnvPreviews } from "../services/tasksApi";

export type TeamLinks = {
  /** Null = no Jenkins configured (button hidden). */
  jenkinsBaseUrl: string | null;
  envPreviews: EnvPreviews;
};

const EMPTY: TeamLinks = { jenkinsBaseUrl: null, envPreviews: {} };

let snapshot: TeamLinks = EMPTY;
const listeners = new Set<() => void>();
let started = false;

function load() {
  tasksApi
    .fetchPreferences()
    .then((prefs) => {
      const base = prefs.jenkinsBaseUrl?.trim() ?? "";
      snapshot = {
        jenkinsBaseUrl: base === "" ? null : base,
        envPreviews: prefs.envPreviews ?? {},
      };
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
