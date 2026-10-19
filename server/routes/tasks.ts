import { Router, type Response } from "express";
import {
  getPreferencesPath,
  getUserPreferences,
  isEnvPreviews,
  isSkillsHubPreferences,
  replaceUserPreferences,
  updateUserPreferences,
  type UserPreferences,
} from "../services/preferencesService.js";
import { openFileInVSCode } from "../services/sessionService.js";
import { inspectWorkspaceDirs, suggestWorkspaceDirs } from "../services/workspaceService.js";
import {
  cloneSkillsHub,
  detectHubRepoUrl,
  getSkillDetails,
  getSkillsHubStatus,
  openSkillsFolder,
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
  launchTaskTest,
  resolveBaseBranch,
} from "../services/taskService.js";
import { extractBooleanField, extractStringField } from "../utils/httpBody.js";
import { BadRequestError, errorCode } from "../utils/httpError.js";
import { normalizeTaskKey } from "../utils/taskKeys.js";
import {
  addRepoToTask,
  getTaskDetails,
  getTaskRepoPrUrl,
  parseTaskKeyParam,
  setTaskLink,
  TaskStepError,
  unlinkRepoFromTask,
} from "../services/taskGroupService.js";

export const tasksRouter = Router();

type LateFields =
  | "defaultSessionPrompt"
  | "workspaceDirs"
  | "skillsHub"
  | "jenkinsBaseUrl"
  | "envPreviews"
  | "taskTestSkill"
  | "taskTestPermissionModeAuto";

/** Optional fields: an older frontend bundle sends the object without them, and the PUT handler
 *  keeps the stored value instead of rejecting or wiping it. */
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
    (candidate.envPreviews === undefined || isEnvPreviews(candidate.envPreviews)) &&
    (candidate.taskTestSkill === undefined || typeof candidate.taskTestSkill === "string") &&
    (candidate.taskTestPermissionModeAuto === undefined ||
      typeof candidate.taskTestPermissionModeAuto === "boolean")
  );
}

tasksRouter.get("/projects", async (_req, res) => {
  try {
    const projects = await getRecentProjectFolders();
    res.json({ projects });
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : String(err), code: errorCode(err) });
  }
});

tasksRouter.get("/preferences", async (_req, res) => {
  try {
    const preferences = await getUserPreferences();
    res.json(preferences);
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : String(err), code: errorCode(err) });
  }
});

tasksRouter.put("/preferences", async (req, res) => {
  try {
    if (!isValidPreferences(req.body)) {
      throw new BadRequestError(
        "MALFORMED_PREFERENCES",
        "Malformed preferences payload — expected { defaultPrompt: string, " +
          "defaultSessionPrompt?: string, branchTypes: string[], " +
          "useWorktreeByDefault: boolean, useAutoPermissionModeByDefault: boolean, " +
          'language: "en"|"pt"|"es"|null, ' +
          "recentProjectPaths: string[], keepRecentSessionsPerProject: number, " +
          "workspaceDirs?: string[] | null, skillsHub?: { repoUrl?, path, catalogs, skills?, " +
          "autoUpdateOnStart? }, jenkinsBaseUrl?: string | null, envPreviews?: { [project]: " +
          "{ label, url }[] }, taskTestSkill?: string, taskTestPermissionModeAuto?: boolean }.",
      );
    }
    const body = req.body;
    // Merged one level deep: an older bundle's skillsHub lacks `repoUrl`, which must survive.
    await updateUserPreferences((stored) => ({
      ...stored,
      ...body,
      skillsHub: { ...stored.skillsHub, ...body.skillsHub },
    }));
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
      code: errorCode(err),
    });
  }
});

/** Replaces the whole file (Settings → Import), then links the imported hub selection if the hub
 *  is already cloned here (best-effort). */
tasksRouter.post("/preferences/import", async (req, res) => {
  try {
    await replaceUserPreferences(req.body);
    await syncSkillsHub().catch(() => undefined);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
      code: errorCode(err),
    });
  }
});

/** Opens the raw file, writing the defaults out first if it was never saved. */
tasksRouter.post("/preferences/open-in-editor", async (_req, res) => {
  try {
    await updateUserPreferences((stored) => stored);
    await openFileInVSCode(getPreferencesPath());
    res.json({ success: true });
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : String(err), code: errorCode(err) });
  }
});

tasksRouter.get("/workspace-dirs/suggestions", async (_req, res) => {
  try {
    res.json({ suggestions: await suggestWorkspaceDirs() });
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : String(err), code: errorCode(err) });
  }
});

tasksRouter.post("/workspace-dirs/inspect", async (req, res) => {
  try {
    const raw: unknown = (req.body as { dirs?: unknown } | null)?.dirs;
    const dirs = Array.isArray(raw) ? raw.filter((d): d is string => typeof d === "string") : [];
    res.json({ dirs: await inspectWorkspaceDirs(dirs) });
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : String(err), code: errorCode(err) });
  }
});

tasksRouter.get("/repo-info", async (req, res) => {
  try {
    const folderPath = typeof req.query.folderPath === "string" ? req.query.folderPath : "";
    const info = await getRepoInfo(folderPath);
    res.json(info);
  } catch (err) {
    res
      .status(400)
      .json({ error: err instanceof Error ? err.message : String(err), code: errorCode(err) });
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
    res
      .status(400)
      .json({ error: err instanceof Error ? err.message : String(err), code: errorCode(err) });
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
      normalizeTaskKey(extractStringField(req.body, "taskKey")),
      extractStringField(req.body, "taskLink") || null,
    );
    res.json(result);
  } catch (err) {
    res
      .status(400)
      .json({ error: err instanceof Error ? err.message : String(err), code: errorCode(err) });
  }
});

tasksRouter.post("/launch", async (req, res) => {
  try {
    const { sessionId } = await launchTaskTerminal({
      worktreePath: extractStringField(req.body, "worktreePath"),
      prompt: extractStringField(req.body, "prompt"),
      permissionModeAuto: extractBooleanField(req.body, "permissionModeAuto", false),
      repoRoot: extractStringField(req.body, "repoRoot"),
      nickname: extractStringField(req.body, "nickname"),
      originBranch: extractStringField(req.body, "originBranch"),
      destinationBranch: extractStringField(req.body, "destinationBranch"),
      taskKey: normalizeTaskKey(extractStringField(req.body, "taskKey")),
      addDirs: extractStringArray(req.body, "addDirs"),
    });
    res.json({ success: true, sessionId });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
      code: errorCode(err),
    });
  }
});

function extractStringArray(body: unknown, key: string): string[] {
  const value: unknown = (body as Record<string, unknown> | undefined)?.[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

// Tasks spanning several repos. `:key` may also be a ticket URL.

function sendTaskError(res: Response, err: unknown): void {
  res.status(400).json({
    success: false,
    error: err instanceof Error ? err.message : String(err),
    code: errorCode(err),
    ...(err instanceof TaskStepError
      ? { failedStep: err.step, completedSteps: err.completedSteps }
      : {}),
  });
}

tasksRouter.get("/by-key/:key", async (req, res) => {
  try {
    res.json(await getTaskDetails(parseTaskKeyParam(req.params.key)));
  } catch (err) {
    sendTaskError(res, err);
  }
});

tasksRouter.get("/by-key/:key/pr-url", async (req, res) => {
  try {
    const query = (name: string) => (typeof req.query[name] === "string" ? req.query[name] : "");
    const url = await getTaskRepoPrUrl(
      parseTaskKeyParam(req.params.key),
      query("repoRoot"),
      query("branch"),
      query("base"),
    );
    if (!url) {
      res
        .status(404)
        .json({ error: "No PR link could be built for this repo.", code: "NO_PR_LINK" });
      return;
    }
    res.json({ url });
  } catch (err) {
    sendTaskError(res, err);
  }
});

tasksRouter.put("/by-key/:key", async (req, res) => {
  try {
    await setTaskLink(parseTaskKeyParam(req.params.key), extractStringField(req.body, "link"));
    res.json({ success: true });
  } catch (err) {
    sendTaskError(res, err);
  }
});

tasksRouter.post("/by-key/:key/repos", async (req, res) => {
  try {
    const body: unknown = req.body;
    const useWorktree: unknown = (body as { useWorktree?: unknown } | undefined)?.useWorktree;
    const result = await addRepoToTask(parseTaskKeyParam(req.params.key), {
      folderPath: extractStringField(body, "folderPath"),
      branchName: extractStringField(body, "branchName"),
      baseBranch: extractStringField(body, "baseBranch"),
      useLocalBranch: extractBooleanField(body, "useLocalBranch", false),
      useWorktree: typeof useWorktree === "boolean" ? useWorktree : null,
      taskLink: extractStringField(body, "taskLink") || null,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    sendTaskError(res, err);
  }
});

tasksRouter.delete("/by-key/:key/repos", async (req, res) => {
  try {
    await unlinkRepoFromTask(
      parseTaskKeyParam(req.params.key),
      extractStringField(req.body, "repoRoot"),
      extractStringField(req.body, "branch"),
    );
    res.json({ success: true });
  } catch (err) {
    sendTaskError(res, err);
  }
});

tasksRouter.post("/test-task", async (req, res) => {
  try {
    await launchTaskTest(
      extractStringField(req.body, "ticketLink"),
      extractBooleanField(req.body, "permissionModeAuto", true),
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

// Team skills hub.

tasksRouter.get("/skills-hub/status", async (_req, res) => {
  try {
    res.json(await getSkillsHubStatus());
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : String(err), code: errorCode(err) });
  }
});

tasksRouter.get("/skills-hub/skill", async (req, res) => {
  try {
    const catalog = typeof req.query.catalog === "string" ? req.query.catalog : "";
    const name = typeof req.query.name === "string" ? req.query.name : "";
    res.json(await getSkillDetails(catalog, name));
  } catch (err) {
    res
      .status(404)
      .json({ error: err instanceof Error ? err.message : String(err), code: errorCode(err) });
  }
});

tasksRouter.post("/skills-hub/sync", async (_req, res) => {
  try {
    res.json(await syncSkillsHub());
  } catch (err) {
    res
      .status(400)
      .json({ error: err instanceof Error ? err.message : String(err), code: errorCode(err) });
  }
});

tasksRouter.post("/skills-hub/clone", async (req, res) => {
  try {
    const hubPath = await cloneSkillsHub(extractStringField(req.body, "parentDir"));
    res.json({ path: hubPath });
  } catch (err) {
    res
      .status(400)
      .json({ error: err instanceof Error ? err.message : String(err), code: errorCode(err) });
  }
});

tasksRouter.put("/skills-hub/selection", async (req, res) => {
  try {
    const body = (req.body ?? {}) as { catalogs?: unknown; skills?: unknown };
    const strings = (raw: unknown) =>
      Array.isArray(raw) ? raw.filter((c): c is string => typeof c === "string") : [];
    res.json(
      await setSkillsHubSelection({
        catalogs: strings(body.catalogs),
        skills: strings(body.skills),
      }),
    );
  } catch (err) {
    res
      .status(400)
      .json({ error: err instanceof Error ? err.message : String(err), code: errorCode(err) });
  }
});

/** The startup prompt's prefill: the `origin` of an existing hub clone, while no URL is saved. */
tasksRouter.get("/skills-hub/detected-repo-url", async (_req, res) => {
  try {
    res.json({ repoUrl: await detectHubRepoUrl() });
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : String(err), code: errorCode(err) });
  }
});

tasksRouter.put("/skills-hub/repo-url", async (req, res) => {
  try {
    const raw: unknown = (req.body as { repoUrl?: unknown } | null)?.repoUrl;
    await setSkillsHubRepoUrl(typeof raw === "string" ? raw : "");
    res.json({ success: true });
  } catch (err) {
    res
      .status(400)
      .json({ error: err instanceof Error ? err.message : String(err), code: errorCode(err) });
  }
});

tasksRouter.put("/skills-hub/path", async (req, res) => {
  try {
    const raw: unknown = (req.body as { path?: unknown } | null)?.path;
    await setSkillsHubPath(typeof raw === "string" ? raw : null);
    res.json({ success: true });
  } catch (err) {
    res
      .status(400)
      .json({ error: err instanceof Error ? err.message : String(err), code: errorCode(err) });
  }
});

tasksRouter.post("/skills-hub/open-folder", async (req, res) => {
  try {
    const target: unknown = (req.body as { target?: unknown } | null)?.target;
    if (target !== "hub" && target !== "userSkills") {
      res.status(400).json({ error: 'target must be "hub" or "userSkills".' });
      return;
    }
    res.json({ path: await openSkillsFolder(target) });
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : String(err), code: errorCode(err) });
  }
});
