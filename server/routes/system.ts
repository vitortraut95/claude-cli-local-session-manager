import { execFileSync } from "node:child_process";
import { Router } from "express";
import {
  getUpdateJobStatus,
  getUpdateStatus,
  startUpdate,
  UpdateBlockedError,
} from "../services/updateService.js";

export const systemRouter = Router();

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

/**
 * Node has no `process.getpgid`. `ps -o pgid=` reports it directly and, unlike reading
 * /proc/[pid]/stat, works on both Linux and macOS (macOS has no /proc). Windows has no
 * process-group signal model at all, so this whole shutdown approach doesn't apply there yet.
 */
function getProcessGroupId(pid: number): number {
  const output = execFileSync("ps", ["-o", "pgid=", "-p", String(pid)], { encoding: "utf8" });
  return Number(output.trim());
}

/**
 * Kills the whole process group this server belongs to — `npm run dev` spawns
 * concurrently → vite/tsx as regular (non-detached) children, so they all share the
 * same group as this process, and a group-wide SIGTERM takes down frontend and backend
 * together. Waits for the response to actually flush before killing anything.
 */
systemRouter.post("/shutdown", (_req, res) => {
  res.json({ success: true });
  res.on("finish", () => {
    setImmediate(() => {
      try {
        process.kill(-getProcessGroupId(process.pid), "SIGTERM");
      } catch {
        process.exit(0);
      }
    });
  });
});
