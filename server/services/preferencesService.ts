import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { REPO_ROOT } from "../utils/repoRoot.js";

export type Language = "en" | "pt" | "es";

/** The team-skills integration (`skillsHubService.ts`). Added after the file's first release — an
 *  older file lacks it entirely, and every sub-field falls back individually. */
export type SkillsHubPreferences = {
  /** The team's skills repo (clone URL, e.g. `git@host:owner/skills-repo.git`). Per-machine on
   *  purpose — this app's own repo is public and must not name any team's private repo. Null =
   *  never set (the startup prompt asks; until then the `origin` of an existing clone is used,
   *  see `skillsHubService.ts`'s `detectHubRepoUrl`); "" = explicitly not used. */
  repoUrl: string | null;
  /** Explicit clone location; null = auto-detect among the workspace repos by `origin`. */
  path: string | null;
  /** Catalogs whose skills are kept linked; null = never chosen (the selection is then inferred
   *  from whatever is already linked, so nothing set up by hand gets undone). */
  catalogs: string[] | null;
  /** Individually picked skills (`<catalog>/<skill>`) on top of the whole `catalogs` — only
   *  meaningful once `catalogs` is non-null (an explicit choice was made). */
  skills: string[];
  /** "Not now" on the New Task modal's invite to install the hub. */
  inviteDismissed: boolean;
};

export type UserPreferences = {
  defaultPrompt: string;
  /** The "New session" modal's own pre-filled prompt — separate from `defaultPrompt` (the "New
   *  task" one), since a free-form session has no Jira link/branch to frame. Added after the
   *  file's first release, so an older file simply lacks it (falls back to ""). */
  defaultSessionPrompt: string;
  branchTypes: string[];
  /** Fallback only — used before a project folder is chosen/resolved, or if the "is there already
   *  an active session in this repo's root?" check (`taskService.ts`'s `getRepoInfo`,
   *  `RepoInfo.hasActiveSessionInRoot`) fails. Once that check resolves, the modal's "no worktree"
   *  checkbox follows *it* instead: suggest a worktree only when the root is actually busy,
   *  default to no worktree otherwise — see NewTaskModal.tsx. Kept as a normal, user-overridable
   *  preference (via the "Use as default" link) for whichever of those inconclusive cases comes up. */
  useWorktreeByDefault: boolean;
  /** Mirrors the "new task" modal's own "--permission-mode auto" checkbox — remembered
   *  automatically as whatever it was last left at (no separate "save as default" step, unlike
   *  defaultPrompt/useWorktreeByDefault), since there's no meaningfully different "draft" value
   *  to preserve across an accidental close the way a half-written prompt is. */
  useAutoPermissionModeByDefault: boolean;
  /** Null means "never explicitly chosen" — the frontend falls back to the browser's own
   *  language in that case rather than this ever defaulting to a fixed language server-side. */
  language: Language | null;
  /** Repo roots used via the "new task" modal, most-recently-used first — see
   *  `taskService.ts`'s `recordUsedProjectPath`. Lets `getKnownProjectFolders()` offer a project
   *  folder before it has any session/`.jsonl` of its own yet, and (once cached listing lands)
   *  without needing the full session scan at all. Editable from the header's settings modal. */
  recentProjectPaths: string[];
  /** How many of a project's most-recently-updated sessions the "Cleanup" modal's
   *  `prune-old-sessions` finding always keeps — the rest become deletion candidates (see
   *  `cleanupService.ts`). Editable from the header's settings modal. */
  keepRecentSessionsPerProject: number;
  /** Folders holding the user's repos (e.g. `~/git`), each scanned one level deep for git repos
   *  (see `workspaceService.ts`). Null means "never set" — the frontend asks for it on startup
   *  until it is (an explicit empty list is a valid, saved answer too, but the prompt treats it
   *  the same). Added after the file's first release, so an older file simply lacks it. */
  workspaceDirs: string[] | null;
  skillsHub: SkillsHubPreferences;
  /** Base URL of the team's Jenkins (the session card's Jenkins button). Null = never set — the
   *  startup prompt asks, prefilled from the legacy `VITE_JENKINS_BASE_URL` in `.env`, which also
   *  stays the fallback until then; "" = explicitly not used (button hidden). */
  jenkinsBaseUrl: string | null;
  /** Static preview sites an `env/*` branch's pipeline deploys, per project folder name — each a
   *  label plus a URL template where `{env}` becomes the branch slug (`env/PROJ-1` → `env-proj-1`).
   *  Shown in the Jenkins modal. Per-machine config for the same reason as `jenkinsBaseUrl`. */
  envPreviews: EnvPreviews;
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
  keepRecentSessionsPerProject: 5,
  workspaceDirs: null,
  skillsHub: { repoUrl: null, path: null, catalogs: null, skills: [], inviteDismissed: false },
  jenkinsBaseUrl: null,
  envPreviews: {},
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
  };
}

export function isSkillsHubPreferences(value: unknown): value is SkillsHubPreferences {
  if (typeof value !== "object" || value === null) return false;
  const raw = value as Record<string, unknown>;
  return (
    // Optional: a frontend bundle from before the repo URL moved here doesn't send it.
    (raw.repoUrl === undefined || raw.repoUrl === null || typeof raw.repoUrl === "string") &&
    (raw.path === null || typeof raw.path === "string") &&
    (raw.catalogs === null || isStringArray(raw.catalogs)) &&
    // Optional: a frontend bundle from before per-skill picks existed doesn't send it.
    (raw.skills === undefined || isStringArray(raw.skills)) &&
    typeof raw.inviteDismissed === "boolean"
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
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function getPreferencesPath(): string {
  return PREFERENCES_PATH;
}

export async function saveUserPreferences(preferences: UserPreferences): Promise<void> {
  await writeFile(PREFERENCES_PATH, `${JSON.stringify(preferences, null, 2)}\n`, "utf-8");
}
