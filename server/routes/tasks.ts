import { Router } from "express";
import {
  getUserPreferences,
  saveUserPreferences,
  type UserPreferences,
} from "../services/preferencesService.js";
import {
  createTaskWorktree,
  getJiraMcpStatus,
  getKnownProjectFolders,
  getRepoInfo,
  launchTaskTerminal,
  resolveBaseBranch,
} from "../services/taskService.js";

export const tasksRouter = Router();

function extractStringField(body: unknown, key: string): string {
  if (typeof body === "object" && body !== null && key in body) {
    const value = (body as Record<string, unknown>)[key];
    if (typeof value === "string") return value;
  }
  return "";
}

function extractBooleanField(body: unknown, key: string, defaultValue: boolean): boolean {
  if (typeof body === "object" && body !== null && key in body) {
    const value = (body as Record<string, unknown>)[key];
    if (typeof value === "boolean") return value;
  }
  return defaultValue;
}

function isValidPreferences(body: unknown): body is UserPreferences {
  if (typeof body !== "object" || body === null) return false;
  const candidate = body as Record<string, unknown>;
  return (
    typeof candidate.defaultPrompt === "string" &&
    Array.isArray(candidate.branchTypes) &&
    candidate.branchTypes.every((item) => typeof item === "string") &&
    typeof candidate.useWorktreeByDefault === "boolean" &&
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
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

tasksRouter.get("/preferences", async (_req, res) => {
  try {
    const preferences = await getUserPreferences();
    res.json(preferences);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

tasksRouter.put("/preferences", async (req, res) => {
  try {
    if (!isValidPreferences(req.body)) {
      throw new Error(
        "Malformed preferences payload — expected { defaultPrompt: string, branchTypes: string[], " +
          "useWorktreeByDefault: boolean, language: \"en\"|\"pt\"|\"es\"|null, hasSeenOnboarding: boolean }.",
      );
    }
    await saveUserPreferences(req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

tasksRouter.get("/jira-mcp-status", async (req, res) => {
  try {
    const status = await getJiraMcpStatus(req.query.refresh === "1");
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

tasksRouter.get("/repo-info", async (req, res) => {
  try {
    const folderPath = typeof req.query.folderPath === "string" ? req.query.folderPath : "";
    const info = await getRepoInfo(folderPath);
    res.json(info);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
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
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
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
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

tasksRouter.post("/launch", async (req, res) => {
  try {
    await launchTaskTerminal(
      extractStringField(req.body, "worktreePath"),
      extractStringField(req.body, "prompt"),
    );
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});
