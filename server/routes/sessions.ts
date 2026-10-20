import express, { Router } from "express";
import {
  applyWorktreeCopyToRoot,
  continueSession,
  createSessionWorktree,
  deleteSession,
  deleteSessionBranch,
  deleteSessionWorktree,
  getSessionPrUrl,
  getSessionPrompts,
  invalidSessionIdError,
  isSafeSessionId,
  getRootStatus,
  getScanProgress,
  getWorktreeToRootPreview,
  listSessions,
  openInCursor,
  openInVSCode,
  openMissingWorktreeRootInVSCode,
  openWorktreeRootInVSCode,
  removeWorktreeAndCheckoutRoot,
  resetRootWorkingTree,
  resumeOpenTasks,
  getSessionHistory,
  focusSessionInGrid,
  setSessionNickname,
  setSessionWorkStatus,
  setSessionBranches,
  startFreshSessionAtMissingWorktreeRoot,
  stopSiblingAndResume,
} from "../services/sessionService.js";
import {
  exportSession,
  importSessionBundle,
  inspectSessionBundle,
} from "../services/sessionTransferService.js";
import { getSessionTask, setSessionTask } from "../services/taskGroupService.js";
import { extractBooleanField, extractStringField, parseWorkStatus } from "../utils/httpBody.js";
import { sendErrorResponse } from "../utils/httpError.js";

export const sessionsRouter = Router();

/** Every `/:id` route: an id that isn't UUID-shaped (could be a path segment) is a 400. */
sessionsRouter.param("id", (_req, res, next, id: string) => {
  if (isSafeSessionId(id)) {
    next();
    return;
  }
  sendErrorResponse(res, invalidSessionIdError(id));
});

sessionsRouter.get("/", async (_req, res) => {
  const sessions = await listSessions();
  res.json(sessions);
});

/** Polled by the frontend while the initial `GET /sessions` call is in flight. */
sessionsRouter.get("/scan-progress", (_req, res) => {
  res.json(getScanProgress());
});

/** Raw gzipped bytes, not JSON: the global `express.json()` (100kb limit) must not see them —
 *  a transcript is easily tens of MB. */
const rawBundleBody = express.raw({ type: "application/octet-stream", limit: "1gb" });

function bundleFromBody(body: unknown): Buffer {
  return Buffer.isBuffer(body) ? body : Buffer.alloc(0);
}

/** Resumes the latest session of every in-progress / waiting task with nothing running. */
sessionsRouter.post("/resume-open", async (_req, res) => {
  res.json(await resumeOpenTasks());
});

sessionsRouter.post("/import/inspect", rawBundleBody, async (req, res) => {
  const preview = await inspectSessionBundle(bundleFromBody(req.body));
  res.json({ preview });
});

sessionsRouter.post("/import", rawBundleBody, async (req, res) => {
  const result = await importSessionBundle(bundleFromBody(req.body), {
    targetDir: typeof req.query.targetDir === "string" ? req.query.targetDir : "",
    checkoutBranch: req.query.checkoutBranch === "true",
    onConflict:
      req.query.onConflict === "overwrite" || req.query.onConflict === "copy"
        ? req.query.onConflict
        : null,
  });
  res.json({ success: true, ...result });
});

sessionsRouter.get("/:id/export", async (req, res) => {
  const { fileName, data } = await exportSession(req.params.id);
  res.setHeader("Content-Type", "application/gzip");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.send(data);
});

sessionsRouter.delete("/:id", async (req, res) => {
  await deleteSession(req.params.id);
  res.json({ success: true });
});

sessionsRouter.delete("/:id/branch", async (req, res) => {
  const branch = typeof req.query.branch === "string" ? req.query.branch : "";
  await deleteSessionBranch(req.params.id, branch);
  res.json({ success: true });
});

sessionsRouter.patch("/:id/nickname", async (req, res) => {
  await setSessionNickname(req.params.id, extractStringField(req.body, "nickname"));
  res.json({ success: true });
});

sessionsRouter.patch("/:id/status", async (req, res) => {
  await setSessionWorkStatus(req.params.id, parseWorkStatus(req.body));
  res.json({ success: true });
});

sessionsRouter.patch("/:id/branches", async (req, res) => {
  await setSessionBranches(
    req.params.id,
    extractStringField(req.body, "origin"),
    extractStringField(req.body, "destination"),
  );
  res.json({ success: true });
});

sessionsRouter.get("/:id/task", async (req, res) => {
  res.json(await getSessionTask(req.params.id));
});

/** `taskKey`: a key/ticket URL saves it; blank = back to inferring it from the branch. */
sessionsRouter.put("/:id/task", async (req, res) => {
  await setSessionTask(
    req.params.id,
    extractStringField(req.body, "taskKey"),
    extractStringField(req.body, "link") || null,
  );
  res.json({ success: true });
});

sessionsRouter.get("/:id/history", async (req, res) => {
  res.json(await getSessionHistory(req.params.id));
});

sessionsRouter.get("/:id/prompts", async (req, res) => {
  const prompts = await getSessionPrompts(req.params.id);
  res.json({ prompts });
});

sessionsRouter.get("/:id/pr-url", async (req, res) => {
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
});

sessionsRouter.post("/:id/continue", async (req, res) => {
  await continueSession(req.params.id);
  res.json({ success: true });
});

sessionsRouter.post("/:id/worktree", async (req, res) => {
  await createSessionWorktree(req.params.id, extractStringField(req.body, "name"));
  res.json({ success: true });
});

sessionsRouter.delete("/:id/worktree", async (req, res) => {
  await deleteSessionWorktree(req.params.id);
  res.json({ success: true });
});

sessionsRouter.post("/:id/checkout-and-resume", async (req, res) => {
  await stopSiblingAndResume(
    req.params.id,
    extractStringField(req.body, "siblingSessionId"),
    extractStringField(req.body, "branch"),
  );
  res.json({ success: true });
});

sessionsRouter.get("/:id/worktree-to-root-preview", async (req, res) => {
  const preview = await getWorktreeToRootPreview(req.params.id);
  res.json({ preview });
});

sessionsRouter.get("/:id/worktree-to-root/root-status", async (req, res) => {
  const status = await getRootStatus(req.params.id);
  res.json({ status });
});

sessionsRouter.post("/:id/worktree-to-root/reset-root", async (req, res) => {
  const stashRef = await resetRootWorkingTree(
    req.params.id,
    extractBooleanField(req.body, "force", false),
  );
  res.json({ success: true, stashRef });
});

sessionsRouter.post("/:id/worktree-to-root/copy", async (req, res) => {
  await applyWorktreeCopyToRoot(req.params.id);
  res.json({ success: true });
});

sessionsRouter.post("/:id/worktree-to-root/remove-and-checkout", async (req, res) => {
  const { previousRootBranch, newBranch } = await removeWorktreeAndCheckoutRoot(req.params.id);
  res.json({ success: true, previousRootBranch, newBranch });
});

/** Shows the grid pane running this session; `{ focused: false }` when there's none. */
sessionsRouter.post("/:id/grid-focus", async (req, res) => {
  res.json({ focused: await focusSessionInGrid(req.params.id) });
});

sessionsRouter.post("/:id/vscode", async (req, res) => {
  await openInVSCode(req.params.id);
  res.json({ success: true });
});

sessionsRouter.post("/:id/cursor", async (req, res) => {
  await openInCursor(req.params.id);
  res.json({ success: true });
});

sessionsRouter.post("/:id/worktree-to-root/vscode-root", async (req, res) => {
  await openWorktreeRootInVSCode(req.params.id);
  res.json({ success: true });
});

sessionsRouter.post("/:id/missing-worktree-root/vscode", async (req, res) => {
  await openMissingWorktreeRootInVSCode(req.params.id);
  res.json({ success: true });
});

sessionsRouter.post("/:id/missing-worktree-root/resume", async (req, res) => {
  await startFreshSessionAtMissingWorktreeRoot(req.params.id);
  res.json({ success: true });
});
