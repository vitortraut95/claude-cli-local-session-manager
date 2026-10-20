import axios from "axios";
import { withServerErrorMessage } from "../utils/apiClient";

const client = axios.create({
  baseURL: "/tasks",
});

export type Language = "en" | "pt";

/** The task queue's scheduler; mirrors the server's `OrchestratorPreferences`. */
export type OrchestratorPreferences = {
  enabled: boolean;
  maxSessions: number;
  minFreeMemoryPercent: number;
  maxUsagePercent: number;
  /** `scripts/heavy-run` limits. Optional: older backend. */
  testSlots?: number;
  testMemoryMaxGb?: number;
  testCpuPercent?: number;
};

export type UserPreferences = {
  defaultPrompt: string;
  /** NewSessionModal's pre-filled prompt. Optional: older backend. */
  defaultSessionPrompt?: string;
  branchTypes: string[];
  /** Fallback until a project's `RepoInfo.hasActiveSessionInRoot` is known. */
  useWorktreeByDefault: boolean;
  /** NewTaskModal's "--permission-mode auto" checkbox, remembered as last left. */
  useAutoPermissionModeByDefault: boolean;
  /** Null = never chosen; callers fall back to the browser's language. */
  language: Language | null;
  /** Repo roots used via "New task", most-recently-used first. */
  recentProjectPaths: string[];
  /** How many of a project's most recent sessions the Cleanup "old sessions" finding keeps. */
  keepRecentSessionsPerProject: number;
  /** Folders holding the user's repos (e.g. `~/git`). Null = never set (asked on startup).
   *  Optional: older backend. */
  workspaceDirs?: string[] | null;
  /** Team skills hub setup. Optional: older backend. */
  skillsHub?: SkillsHubPreferences;
  /** Base URL of the team's Jenkins. Null = never set (asked on startup); "" = not used.
   *  Optional: older backend. */
  jenkinsBaseUrl?: string | null;
  /** `env/*` preview sites per project folder name; `{env}` in the URL = branch slug. Optional:
   *  older backend. */
  envPreviews?: EnvPreviews;
  /** Installed skill the "Test task" button runs (`/<skill> <ticket link>`); "" = button hidden.
   *  Optional: older backend. */
  taskTestSkill?: string;
  /** "Test task" modal's "--permission-mode auto" checkbox, remembered as last left (default on).
   *  Optional: older backend. */
  taskTestPermissionModeAuto?: boolean;
  /** UI theme; null = follow the system. Optional: older backend. */
  theme?: "light" | "dark" | null;
  /** Task queue scheduler. Optional: older backend. */
  orchestrator?: OrchestratorPreferences;
  /** Optional: older backend. */
  worktreeSetup?: WorktreeSetup;
  /** Where Claude sessions open: a terminal tab each, or panes of one tmux grid. Optional: older
   *  backend. */
  terminalLayout?: "tabs" | "tmux-grid";
};

/** Per repo folder name: what a new task worktree gets from the main checkout. */
export type WorktreeSetup = Record<string, { linkNodeModules: boolean; copyEnvFiles: boolean }>;

export type EnvPreviewTemplate = { label: string; url: string };
export type EnvPreviews = Record<string, EnvPreviewTemplate[]>;

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

export type WorkspaceDirSuggestion = {
  dir: string;
  repoCount: number;
  knownRepoCount: number;
  recommended: boolean;
};

export async function fetchWorkspaceDirSuggestions(): Promise<WorkspaceDirSuggestion[]> {
  const { data } = await withServerErrorMessage(() =>
    client.get<{ suggestions: WorkspaceDirSuggestion[] }>("/workspace-dirs/suggestions"),
  );
  return data.suggestions;
}

export type WorkspaceDirStatus = { dir: string; exists: boolean; repoCount: number };

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

export type SkillsHubPreferences = {
  /** The hub's clone URL. Null = never set; "" = not used. Optional: older backends don't send it. */
  repoUrl?: string | null;
  path: string | null;
  catalogs: string[] | null;
  /** `<catalog>/<skill>` picks on top of whole catalogs. Optional: older backends don't send it. */
  skills?: string[];
  /** Background sync on server start. Optional: older backends don't send it (treated as on). */
  autoUpdateOnStart?: boolean;
};
