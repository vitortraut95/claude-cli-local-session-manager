import axios from "axios";
import { withServerErrorMessage } from "../utils/apiClient";

const client = axios.create({
  baseURL: "/tasks",
});

export type ProjectFolderOption = {
  path: string;
  label: string;
  /** True for repos already used via "New task", false for ones only found in a workspace dir.
   *  Absent from a backend older than that distinction — treated as recent. */
  recent?: boolean;
};

export async function fetchProjectFolders(): Promise<ProjectFolderOption[]> {
  const { data } = await withServerErrorMessage(() =>
    client.get<{ projects: ProjectFolderOption[] }>("/projects"),
  );
  return data.projects;
}

export type Language = "en" | "pt" | "es";

export type UserPreferences = {
  defaultPrompt: string;
  /** NewSessionModal's own pre-filled prompt (separate from NewTaskModal's `defaultPrompt`).
   *  Optional like `workspaceDirs`: a backend from before it existed doesn't send it. */
  defaultSessionPrompt?: string;
  branchTypes: string[];
  /** Fallback only, used before a project's `RepoInfo.hasActiveSessionInRoot` is known — once it
   *  is, NewTaskModal's "no worktree" checkbox follows that instead (see `RepoInfo`'s own doc
   *  comment). */
  useWorktreeByDefault: boolean;
  /** Mirrors NewTaskModal's "--permission-mode auto" checkbox — remembered as whatever it was
   *  last left at, no separate "save as default" step. */
  useAutoPermissionModeByDefault: boolean;
  /** Null means "never explicitly chosen" — callers fall back to the browser's own language in
   *  that case rather than this ever defaulting to a fixed language. */
  language: Language | null;
  /** Repo roots used via the "new task" modal, most-recently-used first. Editable in the
   *  header's settings modal. */
  recentProjectPaths: string[];
  /** How many of a project's most-recently-updated sessions the Cleanup modal's "old sessions"
   *  finding always keeps. Editable in the header's settings modal. */
  keepRecentSessionsPerProject: number;
  /** Folders holding the user's repos (e.g. `~/git`). Null = never set — the app asks on startup
   *  until it is (see WorkspaceDirsPromptModal). Optional in the type too: a backend still on the
   *  version before this field existed simply doesn't send it. */
  workspaceDirs?: string[] | null;
  /** Team skills hub setup. Optional for the same reason as `workspaceDirs`. */
  skillsHub?: SkillsHubPreferences;
  /** Base URL of the team's Jenkins. Null = never set (the startup prompt asks, see
   *  TeamIntegrationsPromptModal); "" = not used. Optional like `workspaceDirs`. */
  jenkinsBaseUrl?: string | null;
  /** `env/*` preview sites per project folder name: `{ label, url }` with `{env}` in the URL
   *  replaced by the branch slug. Optional like `workspaceDirs`. */
  envPreviews?: EnvPreviews;
};

export type EnvPreviewTemplate = { label: string; url: string };
export type EnvPreviews = Record<string, EnvPreviewTemplate[]>;

/** Everything the app remembers between sessions in one JSON file (`userPreferences.json`, see
 *  preferencesService.ts) instead of separate per-field files — originally just the "new task"
 *  modal's own fields, now shared with the language switcher and the rest of Settings too. */
export async function fetchPreferences(): Promise<UserPreferences> {
  const { data } = await withServerErrorMessage(() => client.get<UserPreferences>("/preferences"));
  return data;
}

/** Replaces the whole preferences file — callers must send the full object (merging in whatever
 *  fields they aren't intentionally changing), not just the one field they care about. Prefer
 *  `updatePreferences` below unless you already have a guaranteed-fresh full object in hand. */
export async function savePreferences(preferences: UserPreferences): Promise<void> {
  await withServerErrorMessage(() => client.put("/preferences", preferences));
}

/** Serializes `updatePreferences` calls so a fast pair of them (e.g. `setLanguage` right after
 *  a Settings save, fired within the same tick) can't both read the
 *  same "before" snapshot and have the second PUT silently discard the first's change — see
 *  `updatePreferences`'s own doc comment for why the GET-merge-PUT step exists in the first place. */
let preferencesQueue: Promise<void> = Promise.resolve();

/**
 * Safely changes just `partial`'s fields without clobbering the rest: fetches the freshest
 * preferences, merges `partial` over them, then PUTs the full object back. Different features own
 * different fields (NewTaskModal owns defaultPrompt/branchTypes/useWorktreeByDefault;
 * LanguageProvider owns language) and none of them keeps the others' fields in its
 * own state — building a full-object PUT from a stale local copy would silently revert whatever
 * the other side saved most recently. The extra GET keeps every save correct regardless of save
 * order *as long as calls are serialized* — chained onto `preferencesQueue` for exactly that reason,
 * so two calls issued back-to-back run their GET-merge-PUT one at a time instead of racing each
 * other's snapshot. Preference saves are infrequent/user-initiated, so the round trip is cheap.
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

/** Fired (on `window`) after the settings modal saves something — components that cache
 *  preferences in their own state (NewTaskModal) listen for it and reload, so their next own save
 *  or displayed default isn't a stale copy of what was just changed. */
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

export type RepoInfo = {
  repoRoot: string;
  defaultBaseBranch: string;
  /** True when a Claude session is currently active with its working directory exactly at
   *  `repoRoot` — the only case where skipping the worktree (branch checked out directly in
   *  `repoRoot`) would actually collide with something already running. Drives the "New task"
   *  modal's smart default for its "don't use a worktree" checkbox. */
  hasActiveSessionInRoot: boolean;
};

export async function fetchRepoInfo(folderPath: string): Promise<RepoInfo> {
  const { data } = await withServerErrorMessage(() =>
    client.get<RepoInfo>("/repo-info", { params: { folderPath } }),
  );
  return data;
}

/**
 * The "new task" creation flow is split into separate calls (this, `createTaskWorktree`,
 * `launchTaskTerminal`) rather than one — see NewTaskModal for why: each maps to one visible step
 * in the modal's live progress checklist, so a failure shows exactly which step it happened at
 * instead of one opaque error.
 */
export async function resolveBaseBranch(
  folderPath: string,
  baseBranch: string,
  useLocalBranch = false,
): Promise<{ baseBranchRef: string }> {
  const { data } = await withServerErrorMessage(() =>
    client.post<{ baseBranchRef: string }>("/resolve-base-branch", {
      folderPath,
      baseBranch,
      useLocalBranch,
    }),
  );
  return data;
}

export async function createTaskWorktree(
  folderPath: string,
  branchName: string,
  baseBranchRef: string,
  baseBranch: string,
  useWorktree: boolean,
): Promise<{ worktreePath: string }> {
  const { data } = await withServerErrorMessage(() =>
    client.post<{ worktreePath: string }>("/worktree", {
      folderPath,
      branchName,
      baseBranchRef,
      baseBranch,
      useWorktree,
    }),
  );
  return data;
}

/** Opens a terminal in `worktreePath` running `claude <prompt>` (see server-side
 *  launchTaskTerminal for why a positional arg, not a temp file/stdin). `repoRoot` is only used
 *  server-side to remember the project folder for next time's dropdown — pass "" if unknown.
 *  `nickname`, when non-blank, is set as the new session's local nickname before the terminal
 *  opens (see server-side launchTaskTerminal) — pass "" to skip it. */
export async function launchTaskTerminal(
  worktreePath: string,
  prompt: string,
  permissionModeAuto: boolean,
  repoRoot: string,
  nickname = "",
): Promise<void> {
  await withServerErrorMessage(() =>
    client.post("/launch", { worktreePath, prompt, permissionModeAuto, repoRoot, nickname }),
  );
}

// ---------------------------------------------------------------------------------------------
// Team skills hub — see server/services/skillsHubService.ts. Every call here is
// optional from the UI's point of view: a failure (or a backend older than these routes, which
// answers 404) only hides/degrades the skills panel, never blocks a task.

export type SkillsHubPreferences = {
  /** The hub's clone URL. Null = never set; "" = not used. Optional: older backends don't send it. */
  repoUrl?: string | null;
  path: string | null;
  catalogs: string[] | null;
  /** `<catalog>/<skill>` picks on top of whole catalogs. Optional: older backends don't send it. */
  skills?: string[];
  inviteDismissed: boolean;
  /** Background sync on server start. Optional: older backends don't send it (treated as on). */
  autoUpdateOnStart?: boolean;
};

export type HubSkill = { name: string; description: string; dir: string };
export type HubCatalog = { name: string; skills: HubSkill[] };
export type SkillLinkState = "linked" | "missing" | "broken" | "conflict";
export type SkillStatus = {
  name: string;
  catalog: string;
  description: string;
  state: SkillLinkState;
  conflictWith?: string;
};

export type SkillsHubStatus = {
  found: boolean;
  path: string | null;
  configuredPathInvalid: boolean;
  branch: string | null;
  defaultBranch: string | null;
  upstream: string | null;
  dirty: boolean;
  behind: number | null;
  ahead: number | null;
  catalogs: HubCatalog[];
  /** Whole catalogs (future skills included). */
  selectedCatalogs: string[];
  /** Individually picked skills, as `<catalog>/<skill>`. */
  selectedSkills: string[];
  catalogsChosen: boolean;
  skills: SkillStatus[];
  userSkillsDir: string;
  inviteDismissed: boolean;
  /** Null = no hub repo configured (the modal asks for the URL first). Always a string on a
   *  backend from before the URL became a preference. */
  cloneUrl: string | null;
  /** True while `cloneUrl` was detected from an existing clone, not saved. */
  repoUrlDetected?: boolean;
  /** The user said there's no hub (`repoUrl` saved as ""). */
  notUsed?: boolean;
  webUrl: string;
  /** Folder name a clone gets. Absent on older backends. */
  cloneFolderName?: string;
  cloneParentDirs: string[];
};

export type SkillsLinkResult = { linked: string[]; unlinked: string[]; conflicts: string[] };

export type SkillsHubSyncResult = {
  status: SkillsHubStatus;
  fetched: boolean;
  fetchError: string | null;
  pulledCommits: number;
  pullSkippedReason: "dirty" | "diverged" | "failed" | null;
  links: SkillsLinkResult;
};

export async function fetchSkillsHubStatus(): Promise<SkillsHubStatus> {
  const { data } = await withServerErrorMessage(() =>
    client.get<SkillsHubStatus>("/skills-hub/status"),
  );
  return data;
}

/** Opens the hub clone or `~/.claude/skills` in the file manager (resolved server-side). */
export async function openSkillsFolder(target: "hub" | "userSkills"): Promise<void> {
  await withServerErrorMessage(() => client.post("/skills-hub/open-folder", { target }));
}

export async function syncSkillsHub(): Promise<SkillsHubSyncResult> {
  const { data } = await withServerErrorMessage(() =>
    client.post<SkillsHubSyncResult>("/skills-hub/sync"),
  );
  return data;
}

export async function cloneSkillsHub(parentDir: string): Promise<{ path: string }> {
  const { data } = await withServerErrorMessage(() =>
    client.post<{ path: string }>("/skills-hub/clone", { parentDir }),
  );
  return data;
}

export type SkillDetails = {
  catalog: string;
  name: string;
  description: string;
  requiresSkills: string[];
  /** SKILL.md without its frontmatter (markdown). */
  body: string;
  files: string[];
  dir: string;
};

export async function fetchSkillDetails(catalog: string, name: string): Promise<SkillDetails> {
  const { data } = await withServerErrorMessage(() =>
    client.get<SkillDetails>("/skills-hub/skill", { params: { catalog, name } }),
  );
  return data;
}

export type SkillsSelection = { catalogs: string[]; skills: string[] };

export async function setSkillsHubSelection(selection: SkillsSelection): Promise<SkillsLinkResult> {
  const { data } = await withServerErrorMessage(() =>
    client.put<SkillsLinkResult>("/skills-hub/selection", selection),
  );
  return data;
}

/** "" = not used. Changing it also forgets the clone path of the previous repo. */
export async function setSkillsHubRepoUrl(repoUrl: string): Promise<void> {
  await withServerErrorMessage(() => client.put("/skills-hub/repo-url", { repoUrl }));
}

/** The `origin` of a hub clone already on this machine — the startup prompt's prefill. */
export async function fetchDetectedHubRepoUrl(): Promise<string | null> {
  const { data } = await withServerErrorMessage(() =>
    client.get<{ repoUrl: string | null }>("/skills-hub/detected-repo-url"),
  );
  return data.repoUrl;
}

export async function setSkillsHubPath(path: string | null): Promise<void> {
  await withServerErrorMessage(() => client.put("/skills-hub/path", { path }));
}

/** Fired after anything changes the hub setup (clone, catalogs, path, flags) so both the New Task
 *  panel and the settings row reload their copy of the status. */
export const SKILLS_HUB_CHANGED_EVENT = "skills-hub-changed";

export function notifySkillsHubChanged(): void {
  window.dispatchEvent(new Event(SKILLS_HUB_CHANGED_EVENT));
}
