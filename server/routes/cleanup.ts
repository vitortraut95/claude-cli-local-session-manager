import { Router } from "express";
import {
  executeCleanupFinding,
  getWorktreeCleanupForSession,
  scanForCleanupFindings,
  type CleanupFinding,
} from "../services/cleanupService.js";
import { recordEvent } from "../utils/history.js";
import { BadRequestError, errorMessage } from "../utils/httpError.js";

export const cleanupRouter = Router();

cleanupRouter.get("/findings", async (_req, res) => {
  const findings = await scanForCleanupFindings();
  res.json({ findings });
});

/** A session card's "remove worktree": the finding its worktree qualifies for, or why none. */
cleanupRouter.get("/worktree-for-session/:id", async (req, res) => {
  res.json({ result: await getWorktreeCleanupForSession(req.params.id) });
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
      finding.kind !== "remove-done-task-worktree" &&
      finding.kind !== "prune-old-sessions") ||
    typeof finding.repoRoot !== "string"
  ) {
    throw new BadRequestError("MALFORMED_CLEANUP_FINDING", "Malformed cleanup finding.");
  }
  const target = {
    kind: finding.kind,
    repoRoot: finding.repoRoot,
    worktreePath: finding.worktreePath,
    branch: finding.branch,
  };
  try {
    await executeCleanupFinding(finding);
  } catch (err) {
    recordEvent("cleanup.failed", { ...target, error: errorMessage(err) });
    throw err;
  }
  recordEvent("cleanup.executed", target);
  res.json({ success: true });
});
