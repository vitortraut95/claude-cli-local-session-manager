import { readFileSync } from "node:fs";
import { Router } from "express";
import { getUpdateStatus, runUpdate, UpdateBlockedError } from "../services/updateService.js";

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
    const result = await runUpdate();
    res.json({ success: true, ...result });
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

/**
 * Node has no `process.getpgid`; on Linux the process group id is the 5th field of
 * /proc/[pid]/stat (after the "(comm)" part, which may itself contain spaces/parens).
 */
function getProcessGroupId(pid: number): number {
  const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
  const afterComm = stat.slice(stat.lastIndexOf(")") + 2);
  const [, , pgrp] = afterComm.split(" ");
  return Number(pgrp);
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
