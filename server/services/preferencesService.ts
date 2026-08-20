import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { REPO_ROOT } from "../utils/repoRoot.js";

export type Language = "en" | "pt" | "es";

export type UserPreferences = {
  defaultPrompt: string;
  branchTypes: string[];
  useWorktreeByDefault: boolean;
  /** Mirrors the "new task" modal's own "--permission-mode auto" checkbox — remembered
   *  automatically as whatever it was last left at (no separate "save as default" step, unlike
   *  defaultPrompt/useWorktreeByDefault), since there's no meaningfully different "draft" value
   *  to preserve across an accidental close the way a half-written prompt is. */
  useAutoPermissionModeByDefault: boolean;
  /** Null means "never explicitly chosen" — the frontend falls back to the browser's own
   *  language in that case rather than this ever defaulting to a fixed language server-side. */
  language: Language | null;
  /** Whether the onboarding modal (explains the worktree dev workflow) has already been shown
   *  once — gates its auto-open on first visit. */
  hasSeenOnboarding: boolean;
  /** Repo roots used via the "new task" modal, most-recently-used first — see
   *  `taskService.ts`'s `recordUsedProjectPath`. Lets `getKnownProjectFolders()` offer a project
   *  folder before it has any session/`.jsonl` of its own yet, and (once cached listing lands)
   *  without needing the full session scan at all. No management UI — hand-edit this file to
   *  remove a stale entry, same convention as `branchTypes`. */
  recentProjectPaths: string[];
  /** How many of a project's most-recently-updated sessions the "Cleanup" modal's
   *  `prune-old-sessions` finding always keeps — the rest become deletion candidates (see
   *  `cleanupService.ts`). No management UI by design (same as `branchTypes`) — hand-edit this
   *  file to change it. */
  keepRecentSessionsPerProject: number;
};

const PREFERENCES_PATH = path.join(REPO_ROOT, "userPreferences.json");

const DEFAULT_PREFERENCES: UserPreferences = {
  defaultPrompt: "",
  branchTypes: ["feature", "fix"],
  useWorktreeByDefault: true,
  useAutoPermissionModeByDefault: false,
  language: null,
  hasSeenOnboarding: false,
  recentProjectPaths: [],
  keepRecentSessionsPerProject: 5,
};

function isLanguage(value: unknown): value is Language {
  return value === "en" || value === "pt" || value === "es";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/**
 * Everything the "new task" modal remembers between sessions, in one gitignored, per-machine
 * local file. Created lazily on first save (see `saveUserPreferences`); missing/malformed fields
 * fall back individually to `DEFAULT_PREFERENCES` rather than rejecting the whole file, since a
 * user hand-editing the JSON shouldn't lose everything else over one typo — and the file not
 * existing at all (fresh clone, never saved to) falls back the same way.
 */
export async function getUserPreferences(): Promise<UserPreferences> {
  try {
    const raw = await readFile(PREFERENCES_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return {
      defaultPrompt:
        typeof parsed.defaultPrompt === "string"
          ? parsed.defaultPrompt
          : DEFAULT_PREFERENCES.defaultPrompt,
      branchTypes:
        isStringArray(parsed.branchTypes) && parsed.branchTypes.length > 0
          ? parsed.branchTypes
          : DEFAULT_PREFERENCES.branchTypes,
      useWorktreeByDefault:
        typeof parsed.useWorktreeByDefault === "boolean"
          ? parsed.useWorktreeByDefault
          : DEFAULT_PREFERENCES.useWorktreeByDefault,
      useAutoPermissionModeByDefault:
        typeof parsed.useAutoPermissionModeByDefault === "boolean"
          ? parsed.useAutoPermissionModeByDefault
          : DEFAULT_PREFERENCES.useAutoPermissionModeByDefault,
      language: isLanguage(parsed.language) ? parsed.language : DEFAULT_PREFERENCES.language,
      hasSeenOnboarding:
        typeof parsed.hasSeenOnboarding === "boolean"
          ? parsed.hasSeenOnboarding
          : DEFAULT_PREFERENCES.hasSeenOnboarding,
      recentProjectPaths: isStringArray(parsed.recentProjectPaths)
        ? parsed.recentProjectPaths
        : DEFAULT_PREFERENCES.recentProjectPaths,
      keepRecentSessionsPerProject:
        typeof parsed.keepRecentSessionsPerProject === "number" &&
        Number.isInteger(parsed.keepRecentSessionsPerProject) &&
        parsed.keepRecentSessionsPerProject >= 0
          ? parsed.keepRecentSessionsPerProject
          : DEFAULT_PREFERENCES.keepRecentSessionsPerProject,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export async function saveUserPreferences(preferences: UserPreferences): Promise<void> {
  await writeFile(PREFERENCES_PATH, `${JSON.stringify(preferences, null, 2)}\n`, "utf-8");
}
