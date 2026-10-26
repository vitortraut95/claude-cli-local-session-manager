export type Language = "en" | "pt";

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
  /** Sync the hub in the background on server start. Optional: older files lack it (default on). */
  autoUpdateOnStart: boolean;
};

/** The task queue's scheduler (`taskSchedulerService`). Optional: older files lack it. */
export type OrchestratorPreferences = {
  /** Launch queued tasks on its own; false = queue paused. */
  enabled: boolean;
  /** Most `claude` sessions running at once (every live session counts, not only queued ones). */
  maxSessions: number;
  /** Nothing new starts while less than this % of RAM is available. */
  minFreeMemoryPercent: number;
  /** Nothing new starts while any Claude plan limit is at or above this %. */
  maxUsagePercent: number;
  /** `scripts/heavy-run`: test runs at once across every session, and each one's RAM (GB) and CPU
   *  (%, 100 = one core) cap. */
  testSlots: number;
  testMemoryMaxGb: number;
  testCpuPercent: number;
  /** `heavy-run --preview`: dev-server containers running at once across every session, and each
   *  one's RAM cap (GB). */
  previewSlots: number;
  previewMemoryMaxGb: number;
  /** Minutes between two launches, so a session's memory shows up before the next one starts
   *  (0 = no spacing). */
  launchSpacingMinutes: number;
};

export type TerminalLayout = "tabs" | "limux-grid";

/** What a new task worktree gets from the repo's main checkout (things git doesn't check out). */
export type WorktreeSetupOptions = {
  /** Symlink each `node_modules` (root and workspaces) instead of installing per worktree. */
  linkNodeModules: boolean;
  /** Copy the gitignored `.env*` files, so each task can change its own. */
  copyEnvFiles: boolean;
};

/** Per repo folder name, like `envPreviews`; a repo not listed gets nothing. */
export type WorktreeSetup = Record<string, WorktreeSetupOptions>;

export type EnvPreviewTemplate = { label: string; url: string };

export type EnvPreviews = Record<string, EnvPreviewTemplate[]>;

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
  /** Base URL of the team's Jenkins. Null = never set (asked on startup); "" = not used. */
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
  /** UI theme; null = follow the system. Optional: older files lack it. */
  theme: "light" | "dark" | null;
  orchestrator: OrchestratorPreferences;
  /** Optional: older files lack it. */
  worktreeSetup: WorktreeSetup;
  /** Where Claude sessions open: a terminal tab each, or panes of one Limux grid. Optional: older
   *  files lack it. */
  terminalLayout: TerminalLayout;
};

export type WorkspaceDirStatus = { dir: string; exists: boolean; repoCount: number };

export type WorkspaceDirSuggestion = {
  dir: string;
  /** Repos found inside it right now. */
  repoCount: number;
  /** How many repos you've already used with Claude (sessions / "New task") live directly in it. */
  knownRepoCount: number;
  /** Preselected in the UI — see `suggestWorkspaceDirs`. */
  recommended: boolean;
};
