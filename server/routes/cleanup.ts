import { Router } from "express";
import {
  executeCleanupFinding,
  scanForCleanupFindings,
  type CleanupFinding,
} from "../services/cleanupService.js";
import { BadRequestError } from "../utils/httpError.js";

export const cleanupRouter = Router();

cleanupRouter.get("/findings", async (_req, res) => {
  const findings = await scanForCleanupFindings();
  res.json({ findings });
});

/** The body is a finding from `GET /findings`; `executeCleanupFinding` re-validates it, so a
 *  stale/tampered body fails safely. */
cleanupRouter.post("/findings/execute", async (req, res) => {
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
});
