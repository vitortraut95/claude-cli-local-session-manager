import { useSyncExternalStore } from "react";
import * as preferencesApi from "../services/preferencesApi";
import type { EnvPreviews } from "../services/preferencesApi";

type TeamLinks = {
  /** Null = no Jenkins configured (button hidden). */
  jenkinsBaseUrl: string | null;
  envPreviews: EnvPreviews;
  /** `terminalLayout` is the Limux grid: actions that open a session offer grid or terminal. */
  gridLayout: boolean;
};

const EMPTY: TeamLinks = { jenkinsBaseUrl: null, envPreviews: {}, gridLayout: false };

let snapshot: TeamLinks = EMPTY;
const listeners = new Set<() => void>();
let started = false;

function load() {
  preferencesApi
    .fetchPreferences()
    .then((prefs) => {
      const base = prefs.jenkinsBaseUrl?.trim() ?? "";
      snapshot = {
        jenkinsBaseUrl: base === "" ? null : base,
        envPreviews: prefs.envPreviews ?? {},
        gridLayout: prefs.terminalLayout === "limux-grid",
      };
      listeners.forEach((listener) => listener());
    })
    .catch(() => undefined);
}

function subscribe(listener: () => void) {
  if (!started) {
    started = true;
    load();
    window.addEventListener(preferencesApi.PREFERENCES_CHANGED_EVENT, load);
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Jenkins/preview-link/terminal config for the session cards — fetched once for all of them and reloaded
 *  on `PREFERENCES_CHANGED_EVENT`. */
export function useTeamLinks(): TeamLinks {
  return useSyncExternalStore(subscribe, () => snapshot);
}
