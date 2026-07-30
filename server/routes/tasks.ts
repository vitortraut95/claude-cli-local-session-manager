import { Router } from "express";
import {
  createTaskWorktree,
  getDefaultPrompt,
  getJiraMcpStatus,
  getKnownProjectFolders,
  getRepoInfo,
  launchTaskTerminal,
  resolveBaseBranch,
  saveDefaultPrompt,
} from "../services/taskService.js";

export const tasksRouter = Router();

function extractStringField(body: unknown, key: string): string {
  if (typeof body === "object" && body !== null && key in body) {
    const value = (body as Record<string, unknown>)[key];
    if (typeof value === "string") return value;
  }
  return "";
}

tasksRouter.get("/projects", async (_req, res) => {
  try {
    const projects = await getKnownProjectFolders();
    res.json({ projects });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

tasksRouter.get("/default-prompt", async (_req, res) => {
  try {
    const content = await getDefaultPrompt();
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

tasksRouter.put("/default-prompt", async (req, res) => {
  try {
    await saveDefaultPrompt(extractStringField(req.body, "content"));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

tasksRouter.get("/jira-mcp-status", async (_req, res) => {
  try {
    const status = await getJiraMcpStatus();
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
