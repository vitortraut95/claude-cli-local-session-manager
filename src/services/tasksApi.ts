import axios from "axios";
import type { TaskRepoRef } from "../types/session";
import { type ApiError, withServerErrorMessage } from "../utils/apiClient";

const client = axios.create({
  baseURL: "/tasks",
});

export type ProjectFolderOption = {
  path: string;
  label: string;
  /** False for repos only found in a workspace dir. Absent (older backend) = recent. */
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
};

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
export async function savePreferences(preferences: UserPreferences): Promise<void> {
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

export type RepoInfo = {
  repoRoot: string;
  defaultBaseBranch: string;
  /** A session is active with its working directory exactly at `repoRoot` — drives the "use a
   *  worktree" default. */
  hasActiveSessionInRoot: boolean;
};

export async function fetchRepoInfo(folderPath: string): Promise<RepoInfo> {
  const { data } = await withServerErrorMessage(() =>
    client.get<RepoInfo>("/repo-info", { params: { folderPath } }),
  );
  return data;
}

/** First step of "New task" (then `createTaskWorktree`, `launchTaskTerminal`); each call is one
 *  step in the modal's progress checklist. */
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
  taskKey = "",
  taskLink = "",
): Promise<{ worktreePath: string }> {
  const { data } = await withServerErrorMessage(() =>
    client.post<{ worktreePath: string }>("/worktree", {
      folderPath,
      branchName,
      baseBranchRef,
      baseBranch,
      useWorktree,
      taskKey,
      taskLink,
    }),
  );
  return data;
}

/** Opens a terminal in `worktreePath` running `claude <prompt>`. `repoRoot` ("" if unknown) is
 *  remembered for the folder dropdown. A non-blank `nickname`, `originBranch`/`destinationBranch`
 *  and `taskKey` ("" = none) are saved for the new session. */
export async function launchTaskTerminal(
  worktreePath: string,
  prompt: string,
  permissionModeAuto: boolean,
  repoRoot: string,
  nickname = "",
  originBranch = "",
  destinationBranch = "",
  taskKey = "",
  addDirs: string[] = [],
): Promise<void> {
  await withServerErrorMessage(() =>
    client.post("/launch", {
      worktreePath,
      prompt,
      permissionModeAuto,
      repoRoot,
      nickname,
      originBranch,
      destinationBranch,
      taskKey,
      addDirs,
    }),
  );
}

/** One repo of a task as `GET /tasks/by-key/:key` returns it. */
export type TaskRepo = TaskRepoRef & { defaultBranch: string | null };

export type TaskDetails = {
  key: string;
  link: string | null;
  repos: TaskRepo[];
  sessions: { id: string; title: string; nickname: string | null; isActive: boolean }[];
};

export async function fetchTask(taskKey: string): Promise<TaskDetails> {
  const { data } = await withServerErrorMessage(() =>
    client.get<TaskDetails>(`/by-key/${encodeURIComponent(taskKey)}`),
  );
  return data;
}

export type AddRepoStep = "repo" | "base" | "worktree";

export type AddRepoInput = {
  folderPath: string;
  branchName: string;
  baseBranch: string;
  useLocalBranch: boolean;
  /** Omitted = the server's smart default (a worktree only when the root has an active session). */
  useWorktree?: boolean;
  taskLink: string;
};

export type AddRepoResult = {
  repoRoot: string;
  branch: string;
  baseBranch: string;
  /** Where the branch is checked out — what to `/add-dir`. */
  workingDirectory: string;
  completedSteps: AddRepoStep[];
};

/** A failed add-repo also says which step failed and which had already finished (nothing is
 *  rolled back server-side). */
export type AddRepoError = ApiError & { failedStep?: AddRepoStep; completedSteps?: AddRepoStep[] };

export async function addRepoToTask(taskKey: string, input: AddRepoInput): Promise<AddRepoResult> {
  try {
    const { data } = await withServerErrorMessage(() =>
      client.post<AddRepoResult>(`/by-key/${encodeURIComponent(taskKey)}/repos`, input),
    );
    return data;
  } catch (err) {
    const cause = err instanceof Error ? err.cause : undefined;
    if (err instanceof Error && axios.isAxiosError<Partial<AddRepoError>>(cause)) {
      const body = cause.response?.data;
      Object.assign(err, {
        failedStep: body?.failedStep,
        completedSteps: body?.completedSteps ?? [],
      });
    }
    throw err;
  }
}

/** Only drops the link — the branch, worktree and sessions stay. */
export async function unlinkTaskRepo(
  taskKey: string,
  repoRoot: string,
  branch: string,
): Promise<void> {
  await withServerErrorMessage(() =>
    client.delete(`/by-key/${encodeURIComponent(taskKey)}/repos`, { data: { repoRoot, branch } }),
  );
}

/** "Open PR" for one repo/branch of a multi-repo task — works for a repo with no session of its
 *  own; the server only accepts a repo/branch that belongs to the task. */
export async function fetchTaskRepoPrUrl(
  taskKey: string,
  repoRoot: string,
  branch: string,
  base = "",
): Promise<string> {
  const { data } = await withServerErrorMessage(() =>
    client.get<{ url: string }>(`/by-key/${encodeURIComponent(taskKey)}/pr-url`, {
      params: { repoRoot, branch, base },
    }),
  );
  return data.url;
}

/** Header's "Test task": a terminal running `claude "/<taskTestSkill> <ticketLink>"` — the skill
 *  comes from the saved preference, resolved server-side. */
export async function launchTaskTest(
  ticketLink: string,
  permissionModeAuto: boolean,
  nickname: string,
): Promise<void> {
  await withServerErrorMessage(() =>
    client.post("/test-task", { ticketLink, permissionModeAuto, nickname }),
  );
}

// ---------------------------------------------------------------------------------------------
// Team skills hub. Optional from the UI's point of view: a failure (or a 404 from an older
// backend) only hides the skills panel, never blocks a task.

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
  /** Null = no hub repo configured (the modal asks for the URL first). */
  cloneUrl: string | null;
  /** True while `cloneUrl` was detected from an existing clone, not saved. */
  repoUrlDetected?: boolean;
  /** The user said there's no hub (`repoUrl` saved as ""). */
  notUsed?: boolean;
  webUrl: string;
  /** Folder name a clone gets. Absent on older backends. */
  cloneFolderName?: string;
  cloneParentDirs: string[];
  /** Every skill in `userSkillsDir` (hub or not). Absent on older backends. */
  installedSkills?: InstalledSkill[];
};

export type InstalledSkill = { name: string; description: string };

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

/** Fired after anything changes the hub setup, so every `useSkillsHubStatus` reloads. */
export const SKILLS_HUB_CHANGED_EVENT = "skills-hub-changed";

export function notifySkillsHubChanged(): void {
  window.dispatchEvent(new Event(SKILLS_HUB_CHANGED_EVENT));
}
