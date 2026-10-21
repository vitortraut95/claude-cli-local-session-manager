import { Router } from "express";
import { getUpdateJobStatus, getUpdateStatus, startUpdate } from "../services/updateService.js";
import { getClaudeUsageStatus } from "../services/usageService.js";
import { resumeOpenTasks } from "../services/sessionService.js";
import {
  closeIdleGridPanes,
  getGridStatus,
  isLimuxAvailable,
  presentLimuxGrid,
} from "../services/limuxGridService.js";
import { getUserPreferences } from "../services/preferencesService.js";
import {
  removePreviewById,
  startPreviewById,
  stopPreviewById,
} from "../services/previewService.js";
import { AppError, NotFoundError } from "../utils/httpError.js";

export const systemRouter = Router();

systemRouter.get("/usage-limits", async (req, res) => {
  const status = await getClaudeUsageStatus(req.query.refresh === "1");
  res.json(status);
});

/** The Limux grid Claude sessions open in when `terminalLayout` is "limux-grid". */
systemRouter.get("/terminal-grid", async (_req, res) => {
  res.json(await getGridStatus());
});

/** "Open grid": brings Limux up (starting it if needed) and resumes into it every task still in
 *  progress or waiting on the user that has nothing running. */
systemRouter.post("/terminal-grid/open", async (_req, res) => {
  if (!(await isLimuxAvailable())) {
    throw new AppError("LIMUX_NOT_INSTALLED", "Limux isn't installed (github.com/am-will/limux).");
  }
  await presentLimuxGrid();
  const result = await resumeOpenTasks();
  // Panes Limux restored empty and no session took: only clutter now.
  await closeIdleGridPanes().catch(() => 0);
  res.json(result);
});

/** The card's stop button on a task worktree's preview (container stopped / process ended). */
systemRouter.post("/previews/:id/stop", async (req, res) => {
  if (!(await stopPreviewById(req.params.id))) {
    throw new NotFoundError(
      "PREVIEW_NOT_FOUND",
      "No running preview of a task worktree by that id.",
    );
  }
  res.json({ success: true });
});

/** The card's remove button on a task worktree's preview container (running or stopped). */
systemRouter.post("/previews/:id/remove", async (req, res) => {
  if (!(await removePreviewById(req.params.id))) {
    throw new NotFoundError("PREVIEW_NOT_FOUND", "No preview of a task worktree by that id.");
  }
  res.json({ success: true });
});

/** The card's restart button on a task worktree's stopped preview container. */
systemRouter.post("/previews/:id/start", async (req, res) => {
  const { orchestrator } = await getUserPreferences();
  await startPreviewById(req.params.id, orchestrator.previewSlots);
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
