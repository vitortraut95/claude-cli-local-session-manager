import { Router } from "express";
import {
  executeCleanupFinding,
  scanForCleanupFindings,
  type CleanupFinding,
} from "../services/cleanupService.js";
import { BadRequestError, errorCode } from "../utils/httpError.js";

export const cleanupRouter = Router();

cleanupRouter.get("/findings", async (_req, res) => {
  try {
    const findings = await scanForCleanupFindings();
    res.json({ findings });
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : String(err), code: errorCode(err) });
  }
});

/** The body is a finding from `GET /findings`; `executeCleanupFinding` re-validates it, so a
 *  stale/tampered body fails safely. */
cleanupRouter.post("/findings/execute", async (req, res) => {
  try {
    const finding = req.body as CleanupFinding;
    if (
      typeof finding !== "object" ||
      finding === null ||
      (finding.kind !== "prune-worktrees" &&
        finding.kind !== "remove-merged-worktree" &&
        finding.kind !== "remove-abandoned-worktree" &&
        finding.kind !== "prune-old-sessions") ||
      typeof finding.repoRoot !== "string"
    ) {
      throw new BadRequestError("MALFORMED_CLEANUP_FINDING", "Malformed cleanup finding.");
    }
    await executeCleanupFinding(finding);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
      code: errorCode(err),
    });
  }
});
