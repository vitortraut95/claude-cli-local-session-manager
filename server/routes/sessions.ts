import { Router } from "express";
import {
  continueSession,
  deleteSession,
  listSessions,
  setSessionNickname,
  SessionActiveError,
  SessionNotFoundError,
} from "../services/sessionService.js";

export const sessionsRouter = Router();

function extractNickname(body: unknown): string {
  if (typeof body === "object" && body !== null && "nickname" in body) {
    const { nickname } = body;
    if (typeof nickname === "string") return nickname;
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
    await setSessionNickname(req.params.id, extractNickname(req.body));
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
