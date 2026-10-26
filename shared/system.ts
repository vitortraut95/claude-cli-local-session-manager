export type UpdateStatus = {
  branch: string;
  tracking: string;
  ahead: number;
  behind: number;
  updateAvailable: boolean;
  /** Uncommitted or untracked files, or commits not on origin/main: the update would discard
   *  them, so it never runs on its own and needs `force`. Optional: older backend. */
  hasLocalChanges?: boolean;
  /** `git status --porcelain` lines (first `MAX_LISTED_FILES`). */
  changedFiles?: string[];
  changedFileCount?: number;
};

export type UpdateJobStatus =
  | { state: "idle" }
  | { state: "running"; startedAt: string }
  | { state: "success"; branch: string; pullSummary: string; finishedAt: string }
  | { state: "error"; message: string; code?: string; finishedAt: string };

export type ClaudeUsageLimit = {
  /** e.g. "session", "weekly_all", "weekly_opus" — whatever the usage API reports (not an enum). */
  kind: string;
  group: string;
  percent: number;
  severity: string;
  resetsAt: string | null;
  isActive: boolean;
};

export type ClaudeExtraUsage = {
  isEnabled: boolean;
  monthlyLimit: number;
  usedCredits: number;
  utilization: number | null;
  currency: string;
};

export type ClaudeUsageStatus = {
  limits: ClaudeUsageLimit[];
  extraUsage: ClaudeExtraUsage | null;
  /** When this reading was fetched. */
  fetchedAt: string;
  /** The endpoint is rate-limiting us: this is the last good reading, kept meanwhile. */
  stale: boolean;
};

export type LimuxStatus = {
  installed: boolean;
  version: string | null;
  /** Installed by this app (`~/.local/opt/limux`), not a system package. */
  managed: boolean;
  /** Newest version known: GitHub's latest release, or the bundled copy's when offline. */
  latest: string;
  minVersion: string;
  updateAvailable: boolean;
  running: boolean;
  /** System libraries the managed install can't find (empty for other installs). */
  missingLibs: string[];
  /** `sudo apt install …` for `missingLibs`; null when nothing is missing. */
  aptCommand: string | null;
};

export type LimuxInstallResult = LimuxStatus & { source: "github" | "bundled" };
