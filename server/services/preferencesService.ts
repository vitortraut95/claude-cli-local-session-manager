import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { REPO_ROOT } from "../utils/repoRoot.js";

export type UserPreferences = {
  defaultPrompt: string;
  branchTypes: string[];
  useWorktreeByDefault: boolean;
};

const PREFERENCES_PATH = path.join(REPO_ROOT, "userPreferences.json");

const DEFAULT_PREFERENCES: UserPreferences = {
  defaultPrompt: "",
  branchTypes: ["feature", "fix", "hotfix", "env"],
  useWorktreeByDefault: true,
};

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
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export async function saveUserPreferences(preferences: UserPreferences): Promise<void> {
  await writeFile(PREFERENCES_PATH, `${JSON.stringify(preferences, null, 2)}\n`, "utf-8");
}
