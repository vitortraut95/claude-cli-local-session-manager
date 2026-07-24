import { Router } from "express";
import {
  continueSession,
  deleteSession,
  listSessions,
  renameSession,
  SessionActiveError,
  SessionNotFoundError,
} from "../services/sessionService.js";

export const sessionsRouter = Router();

function extractTitle(body: unknown): string {
  if (typeof body === "object" && body !== null && "title" in body) {
    const { title } = body;
    if (typeof title === "string") return title;
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
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

sessionsRouter.patch("/:id/title", async (req, res) => {
  try {
    await renameSession(req.params.id, extractTitle(req.body));
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

sessionsRouter.post("/:id/continue", async (req, res) => {
  try {
    await continueSession(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});
