import { Router } from "express";
import {
  getPreferencesPath,
  getUserPreferences,
  isEnvPreviews,
  isSkillsHubPreferences,
  saveUserPreferences,
  type UserPreferences,
} from "../services/preferencesService.js";
import { openFileInVSCode } from "../services/sessionService.js";
import { inspectWorkspaceDirs, suggestWorkspaceDirs } from "../services/workspaceService.js";
import {
  cloneSkillsHub,
  detectHubRepoUrl,
  getSkillDetails,
  getSkillsHubStatus,
  setSkillsHubFlags,
  setSkillsHubPath,
  setSkillsHubRepoUrl,
  setSkillsHubSelection,
  syncSkillsHub,
} from "../services/skillsHubService.js";
import {
  createTaskWorktree,
  getRecentProjectFolders,
  getRepoInfo,
  launchTaskTerminal,
  resolveBaseBranch,
} from "../services/taskService.js";
import { extractBooleanField, extractStringField } from "../utils/httpBody.js";
import { AppError, errorCode } from "../utils/httpError.js";

export const tasksRouter = Router();

type LateFields =
  | "defaultSessionPrompt"
  | "workspaceDirs"
  | "skillsHub"
  | "jenkinsBaseUrl"
  | "envPreviews";

/** The fields added after the file's first release are optional on purpose: a browser tab still
 *  running an older frontend bundle (see CLAUDE.md's update-safety policy) sends the full object
 *  without them — the PUT handler below keeps the stored value instead of rejecting or wiping it. */
function isValidPreferences(
  body: unknown,
): body is Omit<UserPreferences, LateFields> & Partial<Pick<UserPreferences, LateFields>> {
  if (typeof body !== "object" || body === null) return false;
  const candidate = body as Record<string, unknown>;
  return (
    typeof candidate.defaultPrompt === "string" &&
    (candidate.defaultSessionPrompt === undefined ||
      typeof candidate.defaultSessionPrompt === "string") &&
    Array.isArray(candidate.branchTypes) &&
    candidate.branchTypes.every((item) => typeof item === "string") &&
    typeof candidate.useWorktreeByDefault === "boolean" &&
    typeof candidate.useAutoPermissionModeByDefault === "boolean" &&
    (candidate.language === null ||
      candidate.language === "en" ||
      candidate.language === "pt" ||
      candidate.language === "es") &&
    typeof candidate.hasSeenOnboarding === "boolean" &&
    Array.isArray(candidate.recentProjectPaths) &&
    candidate.recentProjectPaths.every((item) => typeof item === "string") &&
    typeof candidate.keepRecentSessionsPerProject === "number" &&
    Number.isInteger(candidate.keepRecentSessionsPerProject) &&
    candidate.keepRecentSessionsPerProject >= 0 &&
    (candidate.workspaceDirs === undefined ||
      candidate.workspaceDirs === null ||
      (Array.isArray(candidate.workspaceDirs) &&
        candidate.workspaceDirs.every((item) => typeof item === "string"))) &&
    (candidate.skillsHub === undefined || isSkillsHubPreferences(candidate.skillsHub)) &&
    (candidate.jenkinsBaseUrl === undefined ||
      candidate.jenkinsBaseUrl === null ||
      typeof candidate.jenkinsBaseUrl === "string") &&
    (candidate.envPreviews === undefined || isEnvPreviews(candidate.envPreviews))
  );
}

tasksRouter.get("/projects", async (_req, res) => {
  try {
    const projects = await getRecentProjectFolders();
    res.json({ projects });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err), code: errorCode(err) });
  }
});

tasksRouter.get("/preferences", async (_req, res) => {
  try {
    const preferences = await getUserPreferences();
    res.json(preferences);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err), code: errorCode(err) });
  }
});

tasksRouter.put("/preferences", async (req, res) => {
  try {
    if (!isValidPreferences(req.body)) {
      throw new AppError(
        "MALFORMED_PREFERENCES",
        "Malformed preferences payload — expected { defaultPrompt: string, " +
          "defaultSessionPrompt?: string, branchTypes: string[], " +
          "useWorktreeByDefault: boolean, useAutoPermissionModeByDefault: boolean, " +
          "language: \"en\"|\"pt\"|\"es\"|null, hasSeenOnboarding: boolean, " +
          "recentProjectPaths: string[], keepRecentSessionsPerProject: number, " +
          "workspaceDirs?: string[] | null, skillsHub?: { repoUrl?, path, catalogs, skills?, " +
          "inviteDismissed }, jenkinsBaseUrl?: string | null, envPreviews?: { [project]: " +
          "{ label, url }[] } }.",
      );
    }
    const stored = await getUserPreferences();
    // skillsHub merged one level deep: an older bundle's skillsHub lacks `repoUrl`, which must
    // survive its save.
    await saveUserPreferences({
      ...stored,
      ...req.body,
      skillsHub: { ...stored.skillsHub, ...req.body.skillsHub },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
      code: errorCode(err),
    });
  }
});

/** Escape hatch from the settings modal — opens the raw file, writing the defaults out first if
 *  it was never saved (it's created lazily, see `saveUserPreferences`). */
tasksRouter.post("/preferences/open-in-editor", async (_req, res) => {
  try {
    await saveUserPreferences(await getUserPreferences());
    await openFileInVSCode(getPreferencesPath());
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err), code: errorCode(err) });
  }
});

tasksRouter.get("/workspace-dirs/suggestions", async (_req, res) => {
  try {
    res.json({ suggestions: await suggestWorkspaceDirs() });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err), code: errorCode(err) });
  }
});

tasksRouter.post("/workspace-dirs/inspect", async (req, res) => {
  try {
    const raw: unknown = (req.body as { dirs?: unknown } | null)?.dirs;
    const dirs = Array.isArray(raw) ? raw.filter((d): d is string => typeof d === "string") : [];
    res.json({ dirs: await inspectWorkspaceDirs(dirs) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err), code: errorCode(err) });
  }
});

tasksRouter.get("/repo-info", async (req, res) => {
  try {
    const folderPath = typeof req.query.folderPath === "string" ? req.query.folderPath : "";
    const info = await getRepoInfo(folderPath);
    res.json(info);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err), code: errorCode(err) });
  }
});

tasksRouter.post("/resolve-base-branch", async (req, res) => {
  try {
    const result = await resolveBaseBranch(
      extractStringField(req.body, "folderPath"),
      extractStringField(req.body, "baseBranch"),
      extractBooleanField(req.body, "useLocalBranch", false),
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err), code: errorCode(err) });
  }
});

tasksRouter.post("/worktree", async (req, res) => {
  try {
    const result = await createTaskWorktree(
      extractStringField(req.body, "folderPath"),
      extractStringField(req.body, "branchName"),
      extractStringField(req.body, "baseBranchRef"),
      extractStringField(req.body, "baseBranch"),
      extractBooleanField(req.body, "useWorktree", true),
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err), code: errorCode(err) });
  }
});

tasksRouter.post("/launch", async (req, res) => {
  try {
    await launchTaskTerminal(
      extractStringField(req.body, "worktreePath"),
      extractStringField(req.body, "prompt"),
      extractBooleanField(req.body, "permissionModeAuto", false),
      extractStringField(req.body, "repoRoot"),
      extractStringField(req.body, "nickname"),
    );
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
      code: errorCode(err),
    });
  }
});

// Team skills hub — see skillsHubService.ts. All optional: nothing here is ever run
// as part of creating a task.

tasksRouter.get("/skills-hub/status", async (_req, res) => {
  try {
    res.json(await getSkillsHubStatus());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err), code: errorCode(err) });
  }
});

tasksRouter.get("/skills-hub/skill", async (req, res) => {
  try {
    const catalog = typeof req.query.catalog === "string" ? req.query.catalog : "";
    const name = typeof req.query.name === "string" ? req.query.name : "";
    res.json(await getSkillDetails(catalog, name));
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : String(err), code: errorCode(err) });
  }
});

tasksRouter.post("/skills-hub/sync", async (_req, res) => {
  try {
    res.json(await syncSkillsHub());
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err), code: errorCode(err) });
  }
});

tasksRouter.post("/skills-hub/clone", async (req, res) => {
  try {
    const hubPath = await cloneSkillsHub(extractStringField(req.body, "parentDir"));
    res.json({ path: hubPath });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err), code: errorCode(err) });
  }
});

tasksRouter.put("/skills-hub/selection", async (req, res) => {
  try {
    const body = (req.body ?? {}) as { catalogs?: unknown; skills?: unknown };
    const strings = (raw: unknown) =>
      Array.isArray(raw) ? raw.filter((c): c is string => typeof c === "string") : [];
    res.json(await setSkillsHubSelection({ catalogs: strings(body.catalogs), skills: strings(body.skills) }));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err), code: errorCode(err) });
  }
});

/** The startup prompt's prefill: the `origin` of a hub clone set up before the URL was a preference. */
tasksRouter.get("/skills-hub/detected-repo-url", async (_req, res) => {
  try {
    res.json({ repoUrl: await detectHubRepoUrl() });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err), code: errorCode(err) });
  }
});

tasksRouter.put("/skills-hub/repo-url", async (req, res) => {
  try {
    const raw: unknown = (req.body as { repoUrl?: unknown } | null)?.repoUrl;
    await setSkillsHubRepoUrl(typeof raw === "string" ? raw : "");
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err), code: errorCode(err) });
  }
});

tasksRouter.put("/skills-hub/path", async (req, res) => {
  try {
    const raw: unknown = (req.body as { path?: unknown } | null)?.path;
    await setSkillsHubPath(typeof raw === "string" ? raw : null);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err), code: errorCode(err) });
  }
});

tasksRouter.put("/skills-hub/flags", async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    await setSkillsHubFlags(
      typeof body.inviteDismissed === "boolean" ? { inviteDismissed: body.inviteDismissed } : {},
    );
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err), code: errorCode(err) });
  }
});
