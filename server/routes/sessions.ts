import { Router } from "express";
import {
  applyWorktreeCopyToRoot,
  continueSession,
  createSessionWorktree,
  deleteSession,
  deleteSessionBranch,
  deleteSessionWorktree,
  getCompactionDraft,
  getSessionPrUrl,
  getSessionPrompts,
  getSessionRepoInsights,
  getRootStatus,
  getSessionSubagents,
  getWorktreeToRootPreview,
  listSessions,
  openInVSCode,
  openMissingWorktreeRootInVSCode,
  openWorktreeRootInVSCode,
  removeWorktreeAndCheckoutRoot,
  resetRootWorkingTree,
  setSessionNickname,
  SessionActiveError,
  SessionNotFoundError,
  startCompactedContinuation,
  startFreshSessionAtMissingWorktreeRoot,
  stopSiblingAndResume,
} from "../services/sessionService.js";
import { extractStringField } from "../utils/httpBody.js";
import { AppError, sendErrorResponse } from "../utils/httpError.js";

export const sessionsRouter = Router();

/** `statusFor` shared by every route below that can fail with either error — a session id that
 *  doesn't resolve to a file (404) or one that's currently open in another terminal (409). Most
 *  routes only ever throw one of the two, but mapping both unconditionally is harmless (the one
 *  that never actually happens for a given route just never matches). */
function notFoundOrActive(err: AppError): number | null {
  if (err instanceof SessionNotFoundError) return 404;
  if (err instanceof SessionActiveError) return 409;
  return null;
}

sessionsRouter.get("/", async (_req, res) => {
  try {
    const sessions = await listSessions();
    res.json(sessions);
  } catch (err) {
    res.status(500).json({
      error: "Failed to load sessions",
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

sessionsRouter.delete("/:id", async (req, res) => {
  try {
    await deleteSession(req.params.id);
    res.json({ success: true });
  } catch (err) {
    sendErrorResponse(res, err, notFoundOrActive);
  }
});

sessionsRouter.delete("/:id/branch", async (req, res) => {
  try {
    const branch = typeof req.query.branch === "string" ? req.query.branch : "";
    await deleteSessionBranch(req.params.id, branch);
    res.json({ success: true });
  } catch (err) {
    sendErrorResponse(res, err, notFoundOrActive);
  }
});

sessionsRouter.patch("/:id/nickname", async (req, res) => {
  try {
    await setSessionNickname(req.params.id, extractStringField(req.body, "nickname"));
    res.json({ success: true });
  } catch (err) {
    sendErrorResponse(res, err, notFoundOrActive);
  }
});

sessionsRouter.get("/:id/prompts", async (req, res) => {
  try {
    const prompts = await getSessionPrompts(req.params.id);
    res.json({ prompts });
  } catch (err) {
    sendErrorResponse(res, err, notFoundOrActive);
  }
});

sessionsRouter.get("/:id/subagents", async (req, res) => {
  try {
    const subagents = await getSessionSubagents(req.params.id);
    res.json({ subagents });
  } catch (err) {
    sendErrorResponse(res, err, notFoundOrActive);
  }
});

sessionsRouter.get("/:id/insights", async (req, res) => {
  try {
    const insights = await getSessionRepoInsights(req.params.id);
    res.json({ insights });
  } catch (err) {
    sendErrorResponse(res, err, notFoundOrActive);
  }
});

sessionsRouter.get("/:id/pr-url", async (req, res) => {
  try {
    const branch = typeof req.query.branch === "string" ? req.query.branch : "";
    const base = typeof req.query.base === "string" ? req.query.base : undefined;
    const url = await getSessionPrUrl(req.params.id, branch, base);
    if (!url) {
      res
        .status(404)
        .json({ error: "No PR link could be built for this session.", code: "NO_PR_LINK" });
      return;
    }
    res.json({ url });
  } catch (err) {
    sendErrorResponse(res, err, notFoundOrActive);
  }
});

sessionsRouter.post("/:id/continue", async (req, res) => {
  try {
    await continueSession(req.params.id);
    res.json({ success: true });
  } catch (err) {
    sendErrorResponse(res, err, notFoundOrActive);
  }
});

sessionsRouter.post("/:id/compact-summary", async (req, res) => {
  try {
    const draft = await getCompactionDraft(req.params.id);
    res.json({ draft });
  } catch (err) {
    sendErrorResponse(res, err, notFoundOrActive);
  }
});

sessionsRouter.post("/:id/compact-continue", async (req, res) => {
  try {
    const { newSessionId } = await startCompactedContinuation(
      req.params.id,
      extractStringField(req.body, "summary"),
    );
    res.json({ success: true, newSessionId });
  } catch (err) {
    sendErrorResponse(res, err, notFoundOrActive);
  }
});

sessionsRouter.post("/:id/worktree", async (req, res) => {
  try {
    await createSessionWorktree(req.params.id, extractStringField(req.body, "name"));
    res.json({ success: true });
  } catch (err) {
    sendErrorResponse(res, err, notFoundOrActive);
  }
});

sessionsRouter.delete("/:id/worktree", async (req, res) => {
  try {
    await deleteSessionWorktree(req.params.id);
    res.json({ success: true });
  } catch (err) {
    sendErrorResponse(res, err, notFoundOrActive);
  }
});

sessionsRouter.post("/:id/checkout-and-resume", async (req, res) => {
  try {
    await stopSiblingAndResume(
      req.params.id,
      extractStringField(req.body, "siblingSessionId"),
      extractStringField(req.body, "branch"),
    );
    res.json({ success: true });
  } catch (err) {
    sendErrorResponse(res, err, notFoundOrActive);
  }
});

sessionsRouter.get("/:id/worktree-to-root-preview", async (req, res) => {
  try {
    const preview = await getWorktreeToRootPreview(req.params.id);
    res.json({ preview });
  } catch (err) {
    sendErrorResponse(res, err, notFoundOrActive);
  }
});

sessionsRouter.get("/:id/worktree-to-root/root-status", async (req, res) => {
  try {
    const status = await getRootStatus(req.params.id);
    res.json({ status });
  } catch (err) {
    sendErrorResponse(res, err, notFoundOrActive);
  }
});

sessionsRouter.post("/:id/worktree-to-root/reset-root", async (req, res) => {
  try {
    const stashRef = await resetRootWorkingTree(req.params.id);
    res.json({ success: true, stashRef });
  } catch (err) {
    sendErrorResponse(res, err, notFoundOrActive);
  }
});

sessionsRouter.post("/:id/worktree-to-root/copy", async (req, res) => {
  try {
    await applyWorktreeCopyToRoot(req.params.id);
    res.json({ success: true });
  } catch (err) {
    sendErrorResponse(res, err, notFoundOrActive);
  }
});

sessionsRouter.post("/:id/worktree-to-root/remove-and-checkout", async (req, res) => {
  try {
    const { previousRootBranch, newBranch } = await removeWorktreeAndCheckoutRoot(req.params.id);
    res.json({ success: true, previousRootBranch, newBranch });
  } catch (err) {
    sendErrorResponse(res, err, notFoundOrActive);
  }
});

sessionsRouter.post("/:id/vscode", async (req, res) => {
  try {
    await openInVSCode(req.params.id);
    res.json({ success: true });
  } catch (err) {
    sendErrorResponse(res, err, notFoundOrActive);
  }
});

sessionsRouter.post("/:id/worktree-to-root/vscode-root", async (req, res) => {
  try {
    await openWorktreeRootInVSCode(req.params.id);
    res.json({ success: true });
  } catch (err) {
    sendErrorResponse(res, err, notFoundOrActive);
  }
});

sessionsRouter.post("/:id/missing-worktree-root/vscode", async (req, res) => {
  try {
    await openMissingWorktreeRootInVSCode(req.params.id);
    res.json({ success: true });
  } catch (err) {
    sendErrorResponse(res, err, notFoundOrActive);
  }
});

sessionsRouter.post("/:id/missing-worktree-root/resume", async (req, res) => {
  try {
    await startFreshSessionAtMissingWorktreeRoot(req.params.id);
    res.json({ success: true });
  } catch (err) {
    sendErrorResponse(res, err, notFoundOrActive);
  }
});
