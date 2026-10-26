import axios from "axios";
import { withServerErrorMessage } from "../utils/apiClient";
import type {
  UserPreferences,
  WorkspaceDirStatus,
  WorkspaceDirSuggestion,
} from "../../shared/preferences";
export type {
  EnvPreviewTemplate,
  EnvPreviews,
  Language,
  OrchestratorPreferences,
  SkillsHubPreferences,
  TerminalLayout,
  UserPreferences,
  WorkspaceDirStatus,
  WorkspaceDirSuggestion,
  WorktreeSetup,
} from "../../shared/preferences";

const client = axios.create({
  baseURL: "/tasks",
});

/** Contents of `userPreferences.json`. */
export async function fetchPreferences(): Promise<UserPreferences> {
  const { data } = await withServerErrorMessage(() => client.get<UserPreferences>("/preferences"));
  return data;
}

/** Replaces the whole file with an imported one; missing fields fall back to defaults. */
export async function importPreferences(file: unknown): Promise<void> {
  await withServerErrorMessage(() => client.post("/preferences/import", file));
}

/** Replaces the whole preferences file — send the full object. Prefer `updatePreferences`. */
async function savePreferences(preferences: UserPreferences): Promise<void> {
  await withServerErrorMessage(() => client.put("/preferences", preferences));
}

/** Serializes `updatePreferences` calls so two back-to-back saves can't read the same snapshot
 *  and have the second PUT discard the first's change. */
let preferencesQueue: Promise<void> = Promise.resolve();

/**
 * Changes only `partial`'s fields: GETs the freshest preferences, merges, PUTs the full object.
 * A PUT from a stale local copy would revert fields other features saved; calls are chained on
 * `preferencesQueue` so the GET-merge-PUT steps never interleave.
 */
export async function updatePreferences(partial: Partial<UserPreferences>): Promise<void> {
  const run = async () => {
    const current = await fetchPreferences();
    await savePreferences({ ...current, ...partial });
  };
  const result = preferencesQueue.then(run, run);
  preferencesQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/** Fired on `window` after Settings saves; components caching preferences reload on it. */
export const PREFERENCES_CHANGED_EVENT = "preferences-changed";

export function notifyPreferencesChanged(): void {
  window.dispatchEvent(new Event(PREFERENCES_CHANGED_EVENT));
}

export async function fetchWorkspaceDirSuggestions(): Promise<WorkspaceDirSuggestion[]> {
  const { data } = await withServerErrorMessage(() =>
    client.get<{ suggestions: WorkspaceDirSuggestion[] }>("/workspace-dirs/suggestions"),
  );
  return data.suggestions;
}

/** Normalizes each folder (`~` expanded, absolute) and reports whether it exists and how many
 *  repos it holds — nothing is saved. */
export async function inspectWorkspaceDirs(dirs: string[]): Promise<WorkspaceDirStatus[]> {
  const { data } = await withServerErrorMessage(() =>
    client.post<{ dirs: WorkspaceDirStatus[] }>("/workspace-dirs/inspect", { dirs }),
  );
  return data.dirs;
}

export async function openPreferencesInEditor(): Promise<void> {
  await withServerErrorMessage(() => client.post("/preferences/open-in-editor"));
}
