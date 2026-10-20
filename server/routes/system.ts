import { Router } from "express";
import { getUpdateJobStatus, getUpdateStatus, startUpdate } from "../services/updateService.js";
import { getClaudeUsageStatus } from "../services/usageService.js";
import { openTerminalWindow } from "../services/sessionService.js";
import {
  GRID_ATTACH_COMMAND,
  getGridStatus,
  gridSessionExists,
} from "../services/tmuxGridService.js";
import { NotFoundError } from "../utils/httpError.js";

export const systemRouter = Router();

systemRouter.get("/usage-limits", async (req, res) => {
  const status = await getClaudeUsageStatus(req.query.refresh === "1");
  res.json(status);
});

/** The tmux grid Claude sessions open in when `terminalLayout` is "tmux-grid". */
systemRouter.get("/terminal-grid", async (_req, res) => {
  res.json(await getGridStatus());
});

/** Opens a terminal attached to the grid (another view of it, if one is already open). */
systemRouter.post("/terminal-grid/open", async (_req, res) => {
  if (!(await gridSessionExists())) {
    throw new NotFoundError("GRID_NOT_RUNNING", "No session is in the grid yet.");
  }
  await openTerminalWindow(GRID_ATTACH_COMMAND);
  res.json({ success: true });
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
