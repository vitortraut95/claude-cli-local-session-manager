import { Router } from "express";
import {
  continueSession,
  createSessionWorktree,
  deleteSession,
  deleteSessionWorktree,
  getSessionPrompts,
  getSessionRepoInsights,
  getSessionSubagents,
  listSessions,
  openInVSCode,
  setSessionNickname,
  SessionActiveError,
  SessionNotFoundError,
  stopSiblingAndResume,
} from "../services/sessionService.js";

export const sessionsRouter = Router();

function extractStringField(body: unknown, key: string): string {
  if (typeof body === "object" && body !== null && key in body) {
    const value = (body as Record<string, unknown>)[key];
    if (typeof value === "string") return value;
  }
  return "";
}

sessionsRouter.get("/", async (_req, res) => {
  try {
    const sessions = await listSessions();
    res.json(sessions);
  } catch (err) {
    res.status(500).json({
      error: "Failed to load sessions",
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

sessionsRouter.delete("/:id", async (req, res) => {
  try {
    await deleteSession(req.params.id);
    res.json({ success: true });
  } catch (err) {
    if (err instanceof SessionNotFoundError) {
      res.status(404).json({ success: false, error: err.message });
      return;
    }
    if (err instanceof SessionActiveError) {
      res.status(409).json({ success: false, error: err.message });
      return;
    }
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

sessionsRouter.patch("/:id/nickname", async (req, res) => {
  try {
    await setSessionNickname(req.params.id, extractStringField(req.body, "nickname"));
    res.json({ success: true });
  } catch (err) {
    if (err instanceof SessionActiveError) {
      res.status(409).json({ success: false, error: err.message });
      return;
    }
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

sessionsRouter.get("/:id/prompts", async (req, res) => {
  try {
    const prompts = await getSessionPrompts(req.params.id);
    res.json({ prompts });
  } catch (err) {
    if (err instanceof SessionNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

sessionsRouter.get("/:id/subagents", async (req, res) => {
  try {
    const subagents = await getSessionSubagents(req.params.id);
    res.json({ subagents });
  } catch (err) {
    if (err instanceof SessionNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

sessionsRouter.get("/:id/insights", async (req, res) => {
  try {
    const insights = await getSessionRepoInsights(req.params.id);
    res.json({ insights });
  } catch (err) {
    if (err instanceof SessionNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

sessionsRouter.post("/:id/continue", async (req, res) => {
  try {
    await continueSession(req.params.id);
    res.json({ success: true });
  } catch (err) {
    if (err instanceof SessionActiveError) {
      res.status(409).json({ success: false, error: err.message });
      return;
    }
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

sessionsRouter.post("/:id/worktree", async (req, res) => {
  try {
    await createSessionWorktree(req.params.id, extractStringField(req.body, "name"));
    res.json({ success: true });
  } catch (err) {
    if (err instanceof SessionNotFoundError) {
      res.status(404).json({ success: false, error: err.message });
      return;
    }
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

sessionsRouter.delete("/:id/worktree", async (req, res) => {
  try {
    await deleteSessionWorktree(req.params.id);
    res.json({ success: true });
  } catch (err) {
    if (err instanceof SessionNotFoundError) {
      res.status(404).json({ success: false, error: err.message });
      return;
    }
    if (err instanceof SessionActiveError) {
      res.status(409).json({ success: false, error: err.message });
      return;
    }
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

sessionsRouter.post("/:id/checkout-and-resume", async (req, res) => {
  try {
    await stopSiblingAndResume(
      req.params.id,
      extractStringField(req.body, "siblingSessionId"),
      extractStringField(req.body, "branch"),
    );
    res.json({ success: true });
  } catch (err) {
    if (err instanceof SessionNotFoundError) {
      res.status(404).json({ success: false, error: err.message });
      return;
    }
    if (err instanceof SessionActiveError) {
      res.status(409).json({ success: false, error: err.message });
      return;
    }
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

sessionsRouter.post("/:id/vscode", async (req, res) => {
  try {
    await openInVSCode(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});
