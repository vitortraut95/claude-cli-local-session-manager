import { Router } from "express";
import {
  executeCleanupFinding,
  scanForCleanupFindings,
  type CleanupFinding,
} from "../services/cleanupService.js";

export const cleanupRouter = Router();

cleanupRouter.get("/findings", async (_req, res) => {
  try {
    const findings = await scanForCleanupFindings();
    res.json({ findings });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

/** The request body is the exact finding the client got from `GET /findings` — `executeCleanupFinding`
 *  re-validates its conditions from scratch rather than trusting it, so a stale/tampered body just
 *  fails safely instead of acting on outdated state. */
cleanupRouter.post("/findings/execute", async (req, res) => {
  try {
    const finding = req.body as CleanupFinding;
    if (
      typeof finding !== "object" ||
      finding === null ||
      (finding.kind !== "prune-worktrees" && finding.kind !== "remove-merged-worktree") ||
      typeof finding.repoRoot !== "string"
    ) {
      throw new Error("Malformed cleanup finding.");
    }
    await executeCleanupFinding(finding);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});
