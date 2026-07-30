import { Router } from "express";
import {
  getUpdateJobStatus,
  getUpdateStatus,
  startUpdate,
  UpdateBlockedError,
} from "../services/updateService.js";
import { getClaudeUsageStatus } from "../services/usageService.js";

export const systemRouter = Router();

systemRouter.get("/usage-limits", async (req, res) => {
  try {
    const status = await getClaudeUsageStatus(req.query.refresh === "1");
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

systemRouter.get("/update-status", async (_req, res) => {
  try {
    const status = await getUpdateStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({
      error: "Failed to check for updates",
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

systemRouter.post("/update", async (_req, res) => {
  try {
    await startUpdate();
    res.json({ success: true, started: true });
  } catch (err) {
    if (err instanceof UpdateBlockedError) {
      res.status(409).json({ success: false, error: err.message });
      return;
    }
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

systemRouter.get("/update-job", async (_req, res) => {
  try {
    const job = await getUpdateJobStatus();
    res.json(job);
  } catch (err) {
    res.status(500).json({
      error: "Failed to check update job status",
      message: err instanceof Error ? err.message : String(err),
    });
  }
});
