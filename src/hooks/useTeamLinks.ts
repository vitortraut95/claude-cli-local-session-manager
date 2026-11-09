import { useSyncExternalStore } from "react";
import * as preferencesApi from "../services/preferencesApi";

type TeamLinks = {
  /** `terminalLayout` is the Limux grid: actions that open a session offer grid or terminal. */
  gridLayout: boolean;
};

const EMPTY: TeamLinks = { gridLayout: false };

let snapshot: TeamLinks = EMPTY;
const listeners = new Set<() => void>();
let started = false;

function load() {
  preferencesApi
    .fetchPreferences()
    .then((prefs) => {
      snapshot = { gridLayout: prefs.terminalLayout === "limux-grid" };
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

/** Terminal config for the session cards — fetched once for all of them and reloaded
 *  on `PREFERENCES_CHANGED_EVENT`. */
export function useTeamLinks(): TeamLinks {
  return useSyncExternalStore(subscribe, () => snapshot);
}
