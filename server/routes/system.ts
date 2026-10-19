import { Router } from "express";
import { getUpdateJobStatus, getUpdateStatus, startUpdate } from "../services/updateService.js";
import { getClaudeUsageStatus } from "../services/usageService.js";

export const systemRouter = Router();

systemRouter.get("/usage-limits", async (req, res) => {
  const status = await getClaudeUsageStatus(req.query.refresh === "1");
  res.json(status);
});

systemRouter.get("/update-status", async (_req, res) => {
  const status = await getUpdateStatus();
  res.json(status);
});

systemRouter.post("/update", async (_req, res) => {
  await startUpdate();
  res.json({ success: true, started: true });
});

systemRouter.get("/update-job", async (_req, res) => {
  const job = await getUpdateJobStatus();
  res.json(job);
});
