import { Router } from "express";
import {
  applyWorktreeCopyToRoot,
  continueSession,
  createSessionWorktree,
  deleteSession,
  deleteSessionBranch,
  deleteSessionWorktree,
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
  startFreshSessionAtMissingWorktreeRoot,
  stopSiblingAndResume,
} from "../services/sessionService.js";
import { extractStringField } from "../utils/httpBody.js";

export const sessionsRouter = Router();

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
    if (err instanceof SessionNotFoundError) {
      res.status(404).json({ success: false, error: err.message });
      return;
    }
    if (err instanceof SessionActiveError) {
      res.status(409).json({ success: false, error: err.message });
      return;
    }
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

sessionsRouter.delete("/:id/branch", async (req, res) => {
  try {
    const branch = typeof req.query.branch === "string" ? req.query.branch : "";
    await deleteSessionBranch(req.params.id, branch);
    res.json({ success: true });
  } catch (err) {
    if (err instanceof SessionNotFoundError) {
      res.status(404).json({ success: false, error: err.message });
      return;
    }
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

sessionsRouter.patch("/:id/nickname", async (req, res) => {
  try {
    await setSessionNickname(req.params.id, extractStringField(req.body, "nickname"));
    res.json({ success: true });
  } catch (err) {
    if (err instanceof SessionActiveError) {
      res.status(409).json({ success: false, error: err.message });
      return;
    }
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

sessionsRouter.get("/:id/prompts", async (req, res) => {
  try {
    const prompts = await getSessionPrompts(req.params.id);
    res.json({ prompts });
  } catch (err) {
    if (err instanceof SessionNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

sessionsRouter.get("/:id/subagents", async (req, res) => {
  try {
    const subagents = await getSessionSubagents(req.params.id);
    res.json({ subagents });
  } catch (err) {
    if (err instanceof SessionNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

sessionsRouter.get("/:id/insights", async (req, res) => {
  try {
    const insights = await getSessionRepoInsights(req.params.id);
    res.json({ insights });
  } catch (err) {
    if (err instanceof SessionNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

sessionsRouter.get("/:id/pr-url", async (req, res) => {
  try {
    const branch = typeof req.query.branch === "string" ? req.query.branch : "";
    const url = await getSessionPrUrl(req.params.id, branch);
    if (!url) {
      res.status(404).json({ error: "No PR link could be built for this session." });
      return;
    }
    res.json({ url });
  } catch (err) {
    if (err instanceof SessionNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

sessionsRouter.post("/:id/continue", async (req, res) => {
  try {
    await continueSession(req.params.id);
    res.json({ success: true });
  } catch (err) {
    if (err instanceof SessionActiveError) {
      res.status(409).json({ success: false, error: err.message });
      return;
    }
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

sessionsRouter.post("/:id/worktree", async (req, res) => {
  try {
    await createSessionWorktree(req.params.id, extractStringField(req.body, "name"));
    res.json({ success: true });
  } catch (err) {
    if (err instanceof SessionNotFoundError) {
      res.status(404).json({ success: false, error: err.message });
      return;
    }
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

sessionsRouter.delete("/:id/worktree", async (req, res) => {
  try {
    await deleteSessionWorktree(req.params.id);
    res.json({ success: true });
  } catch (err) {
    if (err instanceof SessionNotFoundError) {
      res.status(404).json({ success: false, error: err.message });
      return;
    }
    if (err instanceof SessionActiveError) {
      res.status(409).json({ success: false, error: err.message });
      return;
    }
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
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
    if (err instanceof SessionNotFoundError) {
      res.status(404).json({ success: false, error: err.message });
      return;
    }
    if (err instanceof SessionActiveError) {
      res.status(409).json({ success: false, error: err.message });
      return;
    }
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

sessionsRouter.get("/:id/worktree-to-root-preview", async (req, res) => {
  try {
    const preview = await getWorktreeToRootPreview(req.params.id);
    res.json({ preview });
  } catch (err) {
    if (err instanceof SessionNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

sessionsRouter.get("/:id/worktree-to-root/root-status", async (req, res) => {
  try {
    const status = await getRootStatus(req.params.id);
    res.json({ status });
  } catch (err) {
    if (err instanceof SessionNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

sessionsRouter.post("/:id/worktree-to-root/reset-root", async (req, res) => {
  try {
    const stashRef = await resetRootWorkingTree(req.params.id);
    res.json({ success: true, stashRef });
  } catch (err) {
    if (err instanceof SessionNotFoundError) {
      res.status(404).json({ success: false, error: err.message });
      return;
    }
    if (err instanceof SessionActiveError) {
      res.status(409).json({ success: false, error: err.message });
      return;
    }
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

sessionsRouter.post("/:id/worktree-to-root/copy", async (req, res) => {
  try {
    await applyWorktreeCopyToRoot(req.params.id);
    res.json({ success: true });
  } catch (err) {
    if (err instanceof SessionNotFoundError) {
      res.status(404).json({ success: false, error: err.message });
      return;
    }
    if (err instanceof SessionActiveError) {
      res.status(409).json({ success: false, error: err.message });
      return;
    }
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

sessionsRouter.post("/:id/worktree-to-root/remove-and-checkout", async (req, res) => {
  try {
    const { previousRootBranch, newBranch } = await removeWorktreeAndCheckoutRoot(req.params.id);
    res.json({ success: true, previousRootBranch, newBranch });
  } catch (err) {
    if (err instanceof SessionNotFoundError) {
      res.status(404).json({ success: false, error: err.message });
      return;
    }
    if (err instanceof SessionActiveError) {
      res.status(409).json({ success: false, error: err.message });
      return;
    }
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

sessionsRouter.post("/:id/vscode", async (req, res) => {
  try {
    await openInVSCode(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

sessionsRouter.post("/:id/worktree-to-root/vscode-root", async (req, res) => {
  try {
    await openWorktreeRootInVSCode(req.params.id);
    res.json({ success: true });
  } catch (err) {
    if (err instanceof SessionNotFoundError) {
      res.status(404).json({ success: false, error: err.message });
      return;
    }
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

sessionsRouter.post("/:id/missing-worktree-root/vscode", async (req, res) => {
  try {
    await openMissingWorktreeRootInVSCode(req.params.id);
    res.json({ success: true });
  } catch (err) {
    if (err instanceof SessionNotFoundError) {
      res.status(404).json({ success: false, error: err.message });
      return;
    }
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

sessionsRouter.post("/:id/missing-worktree-root/resume", async (req, res) => {
  try {
    await startFreshSessionAtMissingWorktreeRoot(req.params.id);
    res.json({ success: true });
  } catch (err) {
    if (err instanceof SessionNotFoundError) {
      res.status(404).json({ success: false, error: err.message });
      return;
    }
    if (err instanceof SessionActiveError) {
      res.status(409).json({ success: false, error: err.message });
      return;
    }
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});
