import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { BadRequestError } from "../utils/httpError.js";
import { REPO_ROOT } from "../utils/repoRoot.js";
import type {
  EnvPreviews,
  Language,
  OrchestratorPreferences,
  SkillsHubPreferences,
  UserPreferences,
  WorktreeSetup,
} from "../../shared/preferences.js";
export type {
  SkillsHubPreferences,
  TerminalLayout,
  UserPreferences,
} from "../../shared/preferences.js";

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
    autoUpdateOnStart: true,
  },
  jenkinsBaseUrl: null,
  envPreviews: {},
  taskTestSkill: "",
  taskTestPermissionModeAuto: true,
  theme: null,
  orchestrator: {
    enabled: true,
    maxSessions: 6,
    minFreeMemoryPercent: 20,
    maxUsagePercent: 90,
    testSlots: 1,
    testMemoryMaxGb: 6,
    testCpuPercent: 400,
    previewSlots: 5,
    previewMemoryMaxGb: 4,
    launchSpacingMinutes: 5,
    pauseSessionPercent: 90,
    pauseWeeklyPercent: 98,
  },
  worktreeSetup: {},
  terminalLayout: "tabs",
};

function isLanguage(value: unknown): value is Language {
  return value === "en" || value === "pt";
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

function isIntInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

/** Each field falls back on its own, so a hand-edited file with one bad value keeps the rest. */
function parseOrchestrator(value: unknown): OrchestratorPreferences {
  const fallback = DEFAULT_PREFERENCES.orchestrator;
  if (typeof value !== "object" || value === null) return fallback;
  const raw = value as Record<string, unknown>;
  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : fallback.enabled,
    maxSessions: isIntInRange(raw.maxSessions, 1, 50) ? raw.maxSessions : fallback.maxSessions,
    minFreeMemoryPercent: isIntInRange(raw.minFreeMemoryPercent, 0, 90)
      ? raw.minFreeMemoryPercent
      : fallback.minFreeMemoryPercent,
    maxUsagePercent: isIntInRange(raw.maxUsagePercent, 1, 100)
      ? raw.maxUsagePercent
      : fallback.maxUsagePercent,
    testSlots: isIntInRange(raw.testSlots, 1, 16) ? raw.testSlots : fallback.testSlots,
    testMemoryMaxGb: isIntInRange(raw.testMemoryMaxGb, 1, 256)
      ? raw.testMemoryMaxGb
      : fallback.testMemoryMaxGb,
    testCpuPercent: isIntInRange(raw.testCpuPercent, 50, 6400)
      ? raw.testCpuPercent
      : fallback.testCpuPercent,
    previewSlots: isIntInRange(raw.previewSlots, 1, 16) ? raw.previewSlots : fallback.previewSlots,
    previewMemoryMaxGb: isIntInRange(raw.previewMemoryMaxGb, 1, 64)
      ? raw.previewMemoryMaxGb
      : fallback.previewMemoryMaxGb,
    launchSpacingMinutes: isIntInRange(raw.launchSpacingMinutes, 0, 60)
      ? raw.launchSpacingMinutes
      : fallback.launchSpacingMinutes,
    pauseSessionPercent: isIntInRange(raw.pauseSessionPercent, 1, 100)
      ? raw.pauseSessionPercent
      : fallback.pauseSessionPercent,
    pauseWeeklyPercent: isIntInRange(raw.pauseWeeklyPercent, 1, 100)
      ? raw.pauseWeeklyPercent
      : fallback.pauseWeeklyPercent,
  };
}

export function isOrchestratorPreferences(value: unknown): value is OrchestratorPreferences {
  if (typeof value !== "object" || value === null) return false;
  const raw = value as Record<string, unknown>;
  return (
    typeof raw.enabled === "boolean" &&
    isIntInRange(raw.maxSessions, 1, 50) &&
    isIntInRange(raw.minFreeMemoryPercent, 0, 90) &&
    isIntInRange(raw.maxUsagePercent, 1, 100) &&
    // Optional: an older frontend bundle sends the object without them.
    (raw.testSlots === undefined || isIntInRange(raw.testSlots, 1, 16)) &&
    (raw.testMemoryMaxGb === undefined || isIntInRange(raw.testMemoryMaxGb, 1, 256)) &&
    (raw.testCpuPercent === undefined || isIntInRange(raw.testCpuPercent, 50, 6400)) &&
    (raw.previewSlots === undefined || isIntInRange(raw.previewSlots, 1, 16)) &&
    (raw.previewMemoryMaxGb === undefined || isIntInRange(raw.previewMemoryMaxGb, 1, 64)) &&
    (raw.launchSpacingMinutes === undefined || isIntInRange(raw.launchSpacingMinutes, 0, 60)) &&
    (raw.pauseSessionPercent === undefined || isIntInRange(raw.pauseSessionPercent, 1, 100)) &&
    (raw.pauseWeeklyPercent === undefined || isIntInRange(raw.pauseWeeklyPercent, 1, 100))
  );
}

export function isWorktreeSetup(value: unknown): value is WorktreeSetup {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every((options) => {
    if (typeof options !== "object" || options === null) return false;
    const raw = options as Record<string, unknown>;
    return typeof raw.linkNodeModules === "boolean" && typeof raw.copyEnvFiles === "boolean";
  });
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
    theme:
      parsed.theme === "light" || parsed.theme === "dark"
        ? parsed.theme
        : DEFAULT_PREFERENCES.theme,
    orchestrator: parseOrchestrator(parsed.orchestrator),
    worktreeSetup: isWorktreeSetup(parsed.worktreeSetup)
      ? parsed.worktreeSetup
      : DEFAULT_PREFERENCES.worktreeSetup,
    terminalLayout:
      parsed.terminalLayout === "tabs" || parsed.terminalLayout === "limux-grid"
        ? parsed.terminalLayout
        : // The grid used to be tmux's; it's Limux now.
          (parsed.terminalLayout as string | undefined) === "tmux-grid"
          ? "limux-grid"
          : DEFAULT_PREFERENCES.terminalLayout,
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
