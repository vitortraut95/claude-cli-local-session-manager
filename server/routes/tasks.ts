import { Router } from "express";
import {
  getPreferencesPath,
  getUserPreferences,
  isEnvPreviews,
  isOrchestratorPreferences,
  isWorktreeSetup,
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
import { getHeavyRunHookStatus, setHeavyRunHookInstalled } from "../services/heavyRunService.js";
import { stopPreviewsIn, taskWorktrees } from "../services/previewService.js";
import { getTaskQueue, saveTaskQueue } from "../services/taskQueueService.js";
import { getSchedulerStatus, runSchedulerNow } from "../services/taskSchedulerService.js";
import {
  extractBooleanField,
  extractLayoutField,
  extractStringField,
  parseWorkStatus,
} from "../utils/httpBody.js";
import { BadRequestError } from "../utils/httpError.js";
import { normalizeTaskKey } from "../utils/taskKeys.js";
import { setTaskStatus } from "../utils/taskStore.js";
import {
  addRepoToTask,
  getTaskDetails,
  getTaskRepoPrUrl,
  parseTaskKeyParam,
  setTaskLink,
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
  | "taskTestPermissionModeAuto"
  | "theme"
  | "orchestrator"
  | "worktreeSetup"
  | "terminalLayout";

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
      // "es": no longer offered, still accepted from older bundles (read back as null).
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
      typeof candidate.taskTestPermissionModeAuto === "boolean") &&
    (candidate.theme === undefined ||
      candidate.theme === null ||
      candidate.theme === "light" ||
      candidate.theme === "dark") &&
    (candidate.orchestrator === undefined || isOrchestratorPreferences(candidate.orchestrator)) &&
    (candidate.worktreeSetup === undefined || isWorktreeSetup(candidate.worktreeSetup)) &&
    (candidate.terminalLayout === undefined ||
      candidate.terminalLayout === "tabs" ||
      candidate.terminalLayout === "limux-grid")
  );
}

tasksRouter.get("/projects", async (_req, res) => {
  const projects = await getRecentProjectFolders();
  res.json({ projects });
});

tasksRouter.get("/preferences", async (_req, res) => {
  const preferences = await getUserPreferences();
  res.json(preferences);
});

tasksRouter.put("/preferences", async (req, res) => {
  if (!isValidPreferences(req.body)) {
    throw new BadRequestError(
      "MALFORMED_PREFERENCES",
      "Malformed preferences payload — expected { defaultPrompt: string, " +
        "defaultSessionPrompt?: string, branchTypes: string[], " +
        "useWorktreeByDefault: boolean, useAutoPermissionModeByDefault: boolean, " +
        'language: "en"|"pt"|null, ' +
        "recentProjectPaths: string[], keepRecentSessionsPerProject: number, " +
        "workspaceDirs?: string[] | null, skillsHub?: { repoUrl?, path, catalogs, skills?, " +
        "autoUpdateOnStart? }, jenkinsBaseUrl?: string | null, envPreviews?: { [project]: " +
        "{ label, url }[] }, taskTestSkill?: string, taskTestPermissionModeAuto?: boolean, " +
        'theme?: "light"|"dark"|null, orchestrator?: { enabled, maxSessions, ' +
        "minFreeMemoryPercent, maxUsagePercent }, worktreeSetup?: { [project]: " +
        '{ linkNodeModules, copyEnvFiles } }, terminalLayout?: "tabs"|"limux-grid" }.',
    );
  }
  const body = req.body;
  // Merged one level deep: an older bundle's skillsHub lacks `repoUrl`, which must survive.
  await updateUserPreferences((stored) => ({
    ...stored,
    ...body,
    skillsHub: { ...stored.skillsHub, ...body.skillsHub },
    orchestrator: { ...stored.orchestrator, ...body.orchestrator },
  }));
  res.json({ success: true });
});

/** Replaces the whole file (Settings → Import), then links the imported hub selection if the hub
 *  is already cloned here (best-effort). */
tasksRouter.post("/preferences/import", async (req, res) => {
  await replaceUserPreferences(req.body);
  await syncSkillsHub().catch(() => undefined);
  res.json({ success: true });
});

/** Opens the raw file, writing the defaults out first if it was never saved. */
tasksRouter.post("/preferences/open-in-editor", async (_req, res) => {
  await updateUserPreferences((stored) => stored);
  await openFileInVSCode(getPreferencesPath());
  res.json({ success: true });
});

tasksRouter.get("/workspace-dirs/suggestions", async (_req, res) => {
  res.json({ suggestions: await suggestWorkspaceDirs() });
});

tasksRouter.post("/workspace-dirs/inspect", async (req, res) => {
  const raw: unknown = (req.body as { dirs?: unknown } | null)?.dirs;
  const dirs = Array.isArray(raw) ? raw.filter((d): d is string => typeof d === "string") : [];
  res.json({ dirs: await inspectWorkspaceDirs(dirs) });
});

tasksRouter.get("/repo-info", async (req, res) => {
  const folderPath = typeof req.query.folderPath === "string" ? req.query.folderPath : "";
  const info = await getRepoInfo(folderPath);
  res.json(info);
});

tasksRouter.post("/resolve-base-branch", async (req, res) => {
  const result = await resolveBaseBranch(
    extractStringField(req.body, "folderPath"),
    extractStringField(req.body, "baseBranch"),
    extractBooleanField(req.body, "useLocalBranch", false),
  );
  res.json(result);
});

tasksRouter.post("/worktree", async (req, res) => {
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
});

tasksRouter.post("/launch", async (req, res) => {
  const { sessionId } = await launchTaskTerminal({
    worktreePath: extractStringField(req.body, "worktreePath"),
    prompt: extractStringField(req.body, "prompt"),
    permissionModeAuto: extractBooleanField(req.body, "permissionModeAuto", false),
    repoRoot: extractStringField(req.body, "repoRoot"),
    nickname: extractStringField(req.body, "nickname"),
    originBranch: extractStringField(req.body, "originBranch"),
    destinationBranch: extractStringField(req.body, "destinationBranch"),
    addDirs: extractStringArray(req.body, "addDirs"),
    layout: extractLayoutField(req.body),
  });
  res.json({ success: true, sessionId });
});

function extractStringArray(body: unknown, key: string): string[] {
  const value: unknown = (body as Record<string, unknown> | undefined)?.[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

// Task queue: tickets waiting to be worked on, each with its repos.

tasksRouter.get("/queue", async (_req, res) => {
  res.json({ entries: await getTaskQueue() });
});

tasksRouter.put("/queue", async (req, res) => {
  res.json({ entries: await saveTaskQueue(req.body) });
});

/** Room left for the scheduler (sessions, RAM, plan usage) and why it's waiting, if it is. */
tasksRouter.get("/queue/status", async (_req, res) => {
  res.json(await getSchedulerStatus());
});

tasksRouter.post("/queue/run", async (_req, res) => {
  res.json(await runSchedulerNow());
});

/** The PreToolUse hook that routes every session's test commands through `scripts/heavy-run`. */
tasksRouter.get("/heavy-run/hook", async (_req, res) => {
  res.json(await getHeavyRunHookStatus());
});

tasksRouter.put("/heavy-run/hook", async (req, res) => {
  res.json(await setHeavyRunHookInstalled(extractBooleanField(req.body, "installed", true)));
});

// Tasks spanning several repos. `:key` may also be a ticket URL.

tasksRouter.get("/by-key/:key", async (req, res) => {
  res.json(await getTaskDetails(parseTaskKeyParam(req.params.key)));
});

tasksRouter.get("/by-key/:key/pr-url", async (req, res) => {
  const query = (name: string) => (typeof req.query[name] === "string" ? req.query[name] : "");
  const url = await getTaskRepoPrUrl(
    parseTaskKeyParam(req.params.key),
    query("repoRoot"),
    query("branch"),
    query("base"),
  );
  if (!url) {
    res.status(404).json({ error: "No PR link could be built for this repo.", code: "NO_PR_LINK" });
    return;
  }
  res.json({ url });
});

tasksRouter.put("/by-key/:key", async (req, res) => {
  await setTaskLink(parseTaskKeyParam(req.params.key), extractStringField(req.body, "link"));
  res.json({ success: true });
});

tasksRouter.put("/by-key/:key/status", async (req, res) => {
  const key = parseTaskKeyParam(req.params.key);
  const status = parseWorkStatus(req.body);
  await setTaskStatus(key, status);
  if (status === "done") {
    // Done: its worktrees' preview servers only hold memory now (background, best-effort).
    void taskWorktrees(key)
      .then((worktrees) => stopPreviewsIn(worktrees, "done", key))
      .catch(() => undefined);
  }
  res.json({ success: true });
});

tasksRouter.post("/by-key/:key/repos", async (req, res) => {
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
});

tasksRouter.delete("/by-key/:key/repos", async (req, res) => {
  await unlinkRepoFromTask(
    parseTaskKeyParam(req.params.key),
    extractStringField(req.body, "repoRoot"),
    extractStringField(req.body, "branch"),
  );
  res.json({ success: true });
});

tasksRouter.post("/test-task", async (req, res) => {
  await launchTaskTest(
    extractStringField(req.body, "ticketLink"),
    extractBooleanField(req.body, "permissionModeAuto", true),
    extractStringField(req.body, "nickname"),
    extractLayoutField(req.body),
  );
  res.json({ success: true });
});

// Team skills hub.

tasksRouter.get("/skills-hub/status", async (_req, res) => {
  res.json(await getSkillsHubStatus());
});

tasksRouter.get("/skills-hub/skill", async (req, res) => {
  const catalog = typeof req.query.catalog === "string" ? req.query.catalog : "";
  const name = typeof req.query.name === "string" ? req.query.name : "";
  res.json(await getSkillDetails(catalog, name));
});

tasksRouter.post("/skills-hub/sync", async (_req, res) => {
  res.json(await syncSkillsHub());
});

tasksRouter.post("/skills-hub/clone", async (req, res) => {
  const hubPath = await cloneSkillsHub(extractStringField(req.body, "parentDir"));
  res.json({ path: hubPath });
});

tasksRouter.put("/skills-hub/selection", async (req, res) => {
  const body = (req.body ?? {}) as { catalogs?: unknown; skills?: unknown };
  const strings = (raw: unknown) =>
    Array.isArray(raw) ? raw.filter((c): c is string => typeof c === "string") : [];
  res.json(
    await setSkillsHubSelection({
      catalogs: strings(body.catalogs),
      skills: strings(body.skills),
    }),
  );
});

/** The startup prompt's prefill: the `origin` of an existing hub clone, while no URL is saved. */
tasksRouter.get("/skills-hub/detected-repo-url", async (_req, res) => {
  res.json({ repoUrl: await detectHubRepoUrl() });
});

tasksRouter.put("/skills-hub/repo-url", async (req, res) => {
  const raw: unknown = (req.body as { repoUrl?: unknown } | null)?.repoUrl;
  await setSkillsHubRepoUrl(typeof raw === "string" ? raw : "");
  res.json({ success: true });
});

tasksRouter.put("/skills-hub/path", async (req, res) => {
  const raw: unknown = (req.body as { path?: unknown } | null)?.path;
  await setSkillsHubPath(typeof raw === "string" ? raw : null);
  res.json({ success: true });
});

tasksRouter.post("/skills-hub/open-folder", async (req, res) => {
  const target: unknown = (req.body as { target?: unknown } | null)?.target;
  if (target !== "hub" && target !== "userSkills") {
    res.status(400).json({ error: 'target must be "hub" or "userSkills".' });
    return;
  }
  res.json({ path: await openSkillsFolder(target) });
});
