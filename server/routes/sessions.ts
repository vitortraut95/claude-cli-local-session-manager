import { Router } from "express";
import {
  continueSession,
  deleteSession,
  listSessions,
  SessionNotFoundError,
} from "../services/sessionService.js";

export const sessionsRouter = Router();

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
