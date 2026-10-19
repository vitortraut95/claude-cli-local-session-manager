import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { BadRequestError } from "../utils/httpError.js";
import { REPO_ROOT } from "../utils/repoRoot.js";

export type Language = "en" | "pt" | "es";

/** The team-skills integration. Optional: older files lack it; each sub-field falls back. */
export type SkillsHubPreferences = {
  /** The team's skills repo clone URL. Per-machine: this repo is public. Null = never set (the
   *  `origin` of an existing clone is used, `detectHubRepoUrl`); "" = explicitly not used. */
  repoUrl: string | null;
  /** Explicit clone location; null = auto-detect among the workspace repos by `origin`. */
  path: string | null;
  /** Catalogs whose skills are kept linked; null = never chosen (inferred from what's linked). */
  catalogs: string[] | null;
  /** Individually picked skills (`<catalog>/<skill>`) on top of `catalogs`; only meaningful
   *  once `catalogs` is non-null. */
  skills: string[];
  /** Unused by the UI; kept so older files/bundles round-trip unchanged. */
  inviteDismissed: boolean;
  /** Sync the hub in the background on server start. Optional: older files lack it (default on). */
  autoUpdateOnStart: boolean;
};

export type UserPreferences = {
  defaultPrompt: string;
  /** The "New session" modal's pre-filled prompt. Optional: older files lack it (""). */
  defaultSessionPrompt: string;
  branchTypes: string[];
  /** Fallback only, before a folder is chosen or if `RepoInfo.hasActiveSessionInRoot` can't be
   *  resolved; otherwise the worktree checkbox follows that. */
  useWorktreeByDefault: boolean;
  /** The "New task" modal's "--permission-mode auto" checkbox, remembered as last left. */
  useAutoPermissionModeByDefault: boolean;
  /** Null = never chosen; the frontend falls back to the browser's language. */
  language: Language | null;
  /** Repo roots used via "New task", most-recent first — lets `getKnownProjectFolders()` offer a
   *  folder that has no session yet. */
  recentProjectPaths: string[];
  /** How many of a project's most recent sessions Cleanup's `prune-old-sessions` always keeps. */
  keepRecentSessionsPerProject: number;
  /** Folders holding the user's repos (e.g. `~/git`), scanned one level deep. Null = never set
   *  (the frontend asks on startup). Optional: older files lack it. */
  workspaceDirs: string[] | null;
  skillsHub: SkillsHubPreferences;
  /** Base URL of the team's Jenkins. Null = never set (the legacy `VITE_JENKINS_BASE_URL` in
   *  `.env` is the fallback); "" = explicitly not used (button hidden). */
  jenkinsBaseUrl: string | null;
  /** Preview sites an `env/*` branch deploys, per project folder name; `{env}` in a URL becomes
   *  the branch slug (`env/PROJ-1` → `env-proj-1`). */
  envPreviews: EnvPreviews;
  /** Installed skill the "Test task" button runs as `/<skill> <ticket link>`; "" = button hidden.
   *  Optional: older files lack it. */
  taskTestSkill: string;
  /** The "Test task" modal's "--permission-mode auto" checkbox, remembered as last left (default
   *  on). Optional: older files lack it. */
  taskTestPermissionModeAuto: boolean;
};

export type EnvPreviewTemplate = { label: string; url: string };
export type EnvPreviews = Record<string, EnvPreviewTemplate[]>;

const PREFERENCES_PATH = path.join(REPO_ROOT, "userPreferences.json");

const DEFAULT_PREFERENCES: UserPreferences = {
  defaultPrompt: "",
  defaultSessionPrompt: "",
  branchTypes: ["feature", "fix"],
  useWorktreeByDefault: false,
  useAutoPermissionModeByDefault: false,
  language: null,
  recentProjectPaths: [],
  keepRecentSessionsPerProject: 10,
  workspaceDirs: null,
  skillsHub: {
    repoUrl: null,
    path: null,
    catalogs: null,
    skills: [],
    inviteDismissed: false,
    autoUpdateOnStart: true,
  },
  jenkinsBaseUrl: null,
  envPreviews: {},
  taskTestSkill: "",
  taskTestPermissionModeAuto: true,
};

function isLanguage(value: unknown): value is Language {
  return value === "en" || value === "pt" || value === "es";
}

function parseSkillsHub(value: unknown): SkillsHubPreferences {
  const fallback = DEFAULT_PREFERENCES.skillsHub;
  if (typeof value !== "object" || value === null) return fallback;
  const raw = value as Record<string, unknown>;
  return {
    repoUrl: typeof raw.repoUrl === "string" ? raw.repoUrl.trim() : fallback.repoUrl,
    path: typeof raw.path === "string" && raw.path.trim() ? raw.path : fallback.path,
    catalogs: isStringArray(raw.catalogs) ? raw.catalogs : fallback.catalogs,
    skills: isStringArray(raw.skills) ? raw.skills : fallback.skills,
    inviteDismissed:
      typeof raw.inviteDismissed === "boolean" ? raw.inviteDismissed : fallback.inviteDismissed,
    autoUpdateOnStart:
      typeof raw.autoUpdateOnStart === "boolean"
        ? raw.autoUpdateOnStart
        : fallback.autoUpdateOnStart,
  };
}

export function isSkillsHubPreferences(value: unknown): value is SkillsHubPreferences {
  if (typeof value !== "object" || value === null) return false;
  const raw = value as Record<string, unknown>;
  return (
    // Optional fields below: older frontend bundles don't send them.
    (raw.repoUrl === undefined || raw.repoUrl === null || typeof raw.repoUrl === "string") &&
    (raw.path === null || typeof raw.path === "string") &&
    (raw.catalogs === null || isStringArray(raw.catalogs)) &&
    (raw.skills === undefined || isStringArray(raw.skills)) &&
    typeof raw.inviteDismissed === "boolean" &&
    (raw.autoUpdateOnStart === undefined || typeof raw.autoUpdateOnStart === "boolean")
  );
}

export function isEnvPreviews(value: unknown): value is EnvPreviews {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every(
    (templates) =>
      Array.isArray(templates) &&
      templates.every(
        (item) =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as Record<string, unknown>).label === "string" &&
          typeof (item as Record<string, unknown>).url === "string",
      ),
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/** Reads the per-machine preferences file; a missing file or each missing/malformed field falls
 *  back individually to `DEFAULT_PREFERENCES`. */
export async function getUserPreferences(): Promise<UserPreferences> {
  try {
    return normalizePreferences(JSON.parse(await readFile(PREFERENCES_PATH, "utf-8")));
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/** Any parsed JSON → a complete `UserPreferences`; missing/malformed fields get their default. */
function normalizePreferences(value: unknown): UserPreferences {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return DEFAULT_PREFERENCES;
  }
  const parsed = value as Partial<UserPreferences>;
  return {
    defaultPrompt:
      typeof parsed.defaultPrompt === "string"
        ? parsed.defaultPrompt
        : DEFAULT_PREFERENCES.defaultPrompt,
    defaultSessionPrompt:
      typeof parsed.defaultSessionPrompt === "string"
        ? parsed.defaultSessionPrompt
        : DEFAULT_PREFERENCES.defaultSessionPrompt,
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
    recentProjectPaths: isStringArray(parsed.recentProjectPaths)
      ? parsed.recentProjectPaths
      : DEFAULT_PREFERENCES.recentProjectPaths,
    keepRecentSessionsPerProject:
      typeof parsed.keepRecentSessionsPerProject === "number" &&
      Number.isInteger(parsed.keepRecentSessionsPerProject) &&
      parsed.keepRecentSessionsPerProject >= 0
        ? parsed.keepRecentSessionsPerProject
        : DEFAULT_PREFERENCES.keepRecentSessionsPerProject,
    workspaceDirs: isStringArray(parsed.workspaceDirs)
      ? parsed.workspaceDirs
      : DEFAULT_PREFERENCES.workspaceDirs,
    skillsHub: parseSkillsHub(parsed.skillsHub),
    jenkinsBaseUrl:
      typeof parsed.jenkinsBaseUrl === "string"
        ? parsed.jenkinsBaseUrl.trim()
        : DEFAULT_PREFERENCES.jenkinsBaseUrl,
    envPreviews: isEnvPreviews(parsed.envPreviews)
      ? parsed.envPreviews
      : DEFAULT_PREFERENCES.envPreviews,
    taskTestSkill:
      typeof parsed.taskTestSkill === "string"
        ? parsed.taskTestSkill.trim()
        : DEFAULT_PREFERENCES.taskTestSkill,
    taskTestPermissionModeAuto:
      typeof parsed.taskTestPermissionModeAuto === "boolean"
        ? parsed.taskTestPermissionModeAuto
        : DEFAULT_PREFERENCES.taskTestPermissionModeAuto,
  };
}

/** Replaces the whole file with an imported one (Settings → Import); missing fields = defaults. */
export async function replaceUserPreferences(value: unknown): Promise<void> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new BadRequestError("MALFORMED_PREFERENCES_FILE", "Not a preferences file.");
  }
  await updateUserPreferences(() => normalizePreferences(value));
}

export function getPreferencesPath(): string {
  return PREFERENCES_PATH;
}

let writeQueue: Promise<unknown> = Promise.resolve();

/** The only way to write the file: read → `mutate` → atomic temp-file + rename, serialized on one
 *  in-process queue so concurrent writers can't drop each other's changes. */
export function updateUserPreferences(
  mutate: (current: UserPreferences) => UserPreferences,
): Promise<void> {
  const run = writeQueue.then(async () => {
    const next = mutate(await getUserPreferences());
    const tmpPath = `${PREFERENCES_PATH}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(tmpPath, `${JSON.stringify(next, null, 2)}\n`, "utf-8");
    await rename(tmpPath, PREFERENCES_PATH);
  });
  // A failed write must not wedge every later one.
  writeQueue = run.catch(() => undefined);
  return run;
}
