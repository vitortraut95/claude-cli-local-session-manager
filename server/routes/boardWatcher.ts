import { Router } from "express";
import path from "node:path";
import { TESTS_DIR } from "../services/boardWatcher/claudeTester.js";
import {
  getAutomationSettings,
  saveAutomationSettings,
} from "../services/boardWatcher/settings.js";
import { listFeedback, saveFeedback } from "../services/boardWatcher/feedback.js";
import { readActions } from "../services/boardWatcher/simulation.js";
import { historyPage } from "../services/boardWatcher/history.js";
import { HISTORY_FILTERS } from "../../shared/boardWatcher.js";
import { BadRequestError, NotFoundError } from "../utils/httpError.js";
import {
  getBoardWatcherStatus,
  pauseBoardWatcher,
  resumeBoardWatcher,
  runBoardWatcherNow,
  sendBoardWatcherDigestNow,
} from "../services/boardWatcherService.js";

export const boardWatcherRouter = Router();

boardWatcherRouter.get("/status", async (_req, res) => {
  res.json(await getBoardWatcherStatus());
});

/** A look at the board now, instead of waiting for the next one. */
boardWatcherRouter.post("/run", async (_req, res) => {
  res.json(await runBoardWatcherNow());
});

/** Clears a pause (e.g. the daily approval cap). */
boardWatcherRouter.post("/resume", async (_req, res) => {
  res.json(await resumeBoardWatcher());
});

/** The digest now, from the actions since the last one (doesn't move the next one). */
boardWatcherRouter.post("/digest", async (_req, res) => {
  await sendBoardWatcherDigestNow();
  res.status(204).end();
});

boardWatcherRouter.post("/pause", async (_req, res) => {
  res.json(await pauseBoardWatcher());
});

/** The "Automation" modal: on/off of each piece and the limits. */
boardWatcherRouter.get("/settings", async (_req, res) => {
  res.json(await getAutomationSettings());
});

boardWatcherRouter.put("/settings", async (req, res) => {
  res.json(await saveAutomationSettings(req.body));
});

/** The latest recorded actions, newest first (`?limit=`, default 200, at most 1000). */
boardWatcherRouter.get("/actions", async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 1000);
  const actions = await readActions(new Date(0));
  res.json(actions.slice(-limit).reverse());
});

/** The history grouped per ticket/PR, a page at a time (`?filter=&q=&cursor=&limit=`). */
boardWatcherRouter.get("/history", async (req, res) => {
  const filter = HISTORY_FILTERS.find((f) => f === req.query.filter) ?? "all";
  res.json(
    await historyPage({
      filter,
      query: typeof req.query.q === "string" ? req.query.q.slice(0, 100) : "",
      cursor: typeof req.query.cursor === "string" ? req.query.cursor : null,
      limit: Math.min(Math.max(Number(req.query.limit) || 30, 1), 100),
    }),
  );
});

/** A test's screenshot, by its path under `boardWatcher-tests/` (as recorded in an action). */
boardWatcherRouter.get("/evidence", (req, res) => {
  const requested = typeof req.query.path === "string" ? req.query.path : "";
  const resolved = path.resolve(TESTS_DIR, requested);
  if (!requested || !resolved.startsWith(`${TESTS_DIR}${path.sep}`)) {
    throw new BadRequestError("BAD_EVIDENCE_PATH", "Not a test evidence file.");
  }
  if (!/\.(png|jpe?g|webp|gif)$/i.test(resolved)) {
    throw new NotFoundError("EVIDENCE_NOT_FOUND", "Only screenshots are served.");
  }
  res.sendFile(resolved, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: "Evidence not found." });
  });
});

/** The user's 👍/👎 per history entry (`entryKey` → latest verdict). */
boardWatcherRouter.get("/feedback", async (_req, res) => {
  res.json(await listFeedback());
});

boardWatcherRouter.post("/feedback", async (req, res) => {
  res.json(await saveFeedback(req.body));
});
