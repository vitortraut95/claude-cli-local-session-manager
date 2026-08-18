import { Router } from "express";
import {
  getUserPreferences,
  saveUserPreferences,
  type UserPreferences,
} from "../services/preferencesService.js";
import {
  createTaskWorktree,
  getKnownProjectFolders,
  getRepoInfo,
  launchTaskTerminal,
  resolveBaseBranch,
} from "../services/taskService.js";
import { extractBooleanField, extractStringField } from "../utils/httpBody.js";
import { AppError, errorCode } from "../utils/httpError.js";

export const tasksRouter = Router();

function isValidPreferences(body: unknown): body is UserPreferences {
  if (typeof body !== "object" || body === null) return false;
  const candidate = body as Record<string, unknown>;
  return (
    typeof candidate.defaultPrompt === "string" &&
    Array.isArray(candidate.branchTypes) &&
    candidate.branchTypes.every((item) => typeof item === "string") &&
    typeof candidate.useWorktreeByDefault === "boolean" &&
    typeof candidate.useAutoPermissionModeByDefault === "boolean" &&
    (candidate.language === null ||
      candidate.language === "en" ||
      candidate.language === "pt" ||
      candidate.language === "es") &&
    typeof candidate.hasSeenOnboarding === "boolean"
  );
}

tasksRouter.get("/projects", async (_req, res) => {
  try {
    const projects = await getKnownProjectFolders();
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
        "Malformed preferences payload — expected { defaultPrompt: string, branchTypes: string[], " +
          "useWorktreeByDefault: boolean, useAutoPermissionModeByDefault: boolean, " +
          "language: \"en\"|\"pt\"|\"es\"|null, hasSeenOnboarding: boolean }.",
      );
    }
    await saveUserPreferences(req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
      code: errorCode(err),
    });
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
