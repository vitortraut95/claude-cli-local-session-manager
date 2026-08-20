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

/**
 * Safely changes just `partial`'s fields without clobbering the rest: fetches the freshest
 * preferences, merges `partial` over them, then PUTs the full object back. Different features own
 * different fields (NewTaskModal owns defaultPrompt/branchTypes/useWorktreeByDefault;
 * usePreferences owns language/hasSeenOnboarding) and none of them keeps the others' fields in its
 * own state — building a full-object PUT from a stale local copy would silently revert whatever
 * the other side saved most recently. The extra GET keeps every save correct regardless of save
 * order; preference saves are infrequent/user-initiated, so the round trip is cheap.
 */
export async function updatePreferences(partial: Partial<UserPreferences>): Promise<void> {
  const current = await fetchPreferences();
  await savePreferences({ ...current, ...partial });
}

export type RepoInfo = {
  repoRoot: string;
  defaultBaseBranch: string;
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
): Promise<{ baseBranchRef: string }> {
  const { data } = await withServerErrorMessage(() =>
    client.post<{ baseBranchRef: string }>("/resolve-base-branch", { folderPath, baseBranch }),
  );
  return data;
}

export async function createTaskWorktree(
  folderPath: string,
  branchName: string,
  baseBranchRef: string,
  useWorktree: boolean,
): Promise<{ worktreePath: string }> {
  const { data } = await withServerErrorMessage(() =>
    client.post<{ worktreePath: string }>("/worktree", {
      folderPath,
      branchName,
      baseBranchRef,
      useWorktree,
    }),
  );
  return data;
}

/** Opens a terminal in `worktreePath` running `claude <prompt>` (see server-side
 *  launchTaskTerminal for why a positional arg, not a temp file/stdin). `repoRoot` is only used
 *  server-side to remember the project folder for next time's dropdown — pass "" if unknown. */
export async function launchTaskTerminal(
  worktreePath: string,
  prompt: string,
  permissionModeAuto: boolean,
  repoRoot: string,
): Promise<void> {
  await withServerErrorMessage(() =>
    client.post("/launch", { worktreePath, prompt, permissionModeAuto, repoRoot }),
  );
}
