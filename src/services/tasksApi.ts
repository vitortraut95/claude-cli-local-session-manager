import axios from "axios";
import { withServerErrorMessage } from "../utils/apiClient";

const client = axios.create({
  baseURL: "/tasks",
});

export type ProjectFolderOption = {
  path: string;
  label: string;
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
  /** Whether the onboarding modal (worktree dev workflow walkthrough) has already been shown once. */
  hasSeenOnboarding: boolean;
  /** Repo roots used via the "new task" modal, most-recently-used first. No dedicated UI —
   *  hand-edit userPreferences.json to remove a stale entry, same as branchTypes. */
  recentProjectPaths: string[];
  /** How many of a project's most-recently-updated sessions the Cleanup modal's "old sessions"
   *  finding always keeps. No dedicated UI — hand-edit userPreferences.json to change it. */
  keepRecentSessionsPerProject: number;
};

/** Everything the app remembers between sessions in one JSON file (`userPreferences.json`, see
 *  preferencesService.ts) instead of separate per-field files — originally just the "new task"
 *  modal's own fields, now shared with the language switcher / onboarding-seen flag too. */
export async function fetchPreferences(): Promise<UserPreferences> {
  const { data } = await withServerErrorMessage(() =>
    client.get<UserPreferences>("/preferences"),
  );
  return data;
}

/** Replaces the whole preferences file — callers must send the full object (merging in whatever
 *  fields they aren't intentionally changing), not just the one field they care about. Prefer
 *  `updatePreferences` below unless you already have a guaranteed-fresh full object in hand. */
export async function savePreferences(preferences: UserPreferences): Promise<void> {
  await withServerErrorMessage(() => client.put("/preferences", preferences));
}

/** Serializes `updatePreferences` calls so a fast pair of them (e.g. `setLanguage` right after
 *  `markOnboardingSeen`, both fired from LanguageProvider within the same tick) can't both read the
 *  same "before" snapshot and have the second PUT silently discard the first's change — see
 *  `updatePreferences`'s own doc comment for why the GET-merge-PUT step exists in the first place. */
let preferencesQueue: Promise<void> = Promise.resolve();

/**
 * Safely changes just `partial`'s fields without clobbering the rest: fetches the freshest
 * preferences, merges `partial` over them, then PUTs the full object back. Different features own
 * different fields (NewTaskModal owns defaultPrompt/branchTypes/useWorktreeByDefault;
 * usePreferences owns language/hasSeenOnboarding) and none of them keeps the others' fields in its
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
