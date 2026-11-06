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
import { BadRequestError, ConflictError, NotFoundError } from "../utils/httpError.js";
import { automationsOn } from "../services/boardWatcher/beta.js";
import { readActivity } from "../services/boardWatcher/activity.js";
import {
  finishSetup,
  getSetupStatus,
  listBitbucketRepos,
  readBoardColumns,
  saveBoardColumns,
  saveExtras,
  saveRepos,
  setupBitbucket,
  setupJira,
} from "../services/boardWatcher/setup.js";
import {
  getBoardWatcherStatus,
  pauseBoardWatcher,
  resumeBoardWatcher,
  runBoardWatcherNow,
  homologCandidates,
  pointToHomolog,
  previewDaily,
  sendBoardWatcherDigestNow,
} from "../services/boardWatcherService.js";

export const boardWatcherRouter = Router();

const body = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const text = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

// The setup panel answers even with the beta off: it's opened from Settings to turn it on.
boardWatcherRouter.get("/setup", async (_req, res) => {
  res.json(await getSetupStatus());
});

boardWatcherRouter.post("/setup/jira", async (req, res) => {
  const b = body(req.body);
  res.json(await setupJira({ site: text(b.site), email: text(b.email), token: text(b.token) }));
});

boardWatcherRouter.post("/setup/board/columns", async (req, res) => {
  res.json(await readBoardColumns(text(body(req.body).board) ?? ""));
});

boardWatcherRouter.post("/setup/board", async (req, res) => {
  const b = body(req.body);
  const mapping = body(b.mapping);
  await saveBoardColumns({
    board: text(b.board) ?? "",
    mapping: Object.fromEntries(
      Object.entries(mapping).map(([role, names]) => [
        role,
        Array.isArray(names) ? names.filter((n): n is string => typeof n === "string") : [],
      ]),
    ),
  });
  res.json(await getSetupStatus());
});

boardWatcherRouter.post("/setup/bitbucket", async (req, res) => {
  const b = body(req.body);
  res.json(
    await setupBitbucket({
      workspace: text(b.workspace),
      email: text(b.email),
      token: text(b.token),
    }),
  );
});

boardWatcherRouter.get("/setup/repos", async (_req, res) => {
  res.json(await listBitbucketRepos());
});

boardWatcherRouter.post("/setup/repos", async (req, res) => {
  const b = body(req.body);
  const repos = Array.isArray(b.repos)
    ? b.repos.filter((r): r is string => typeof r === "string")
    : [];
  const localRepos = Object.fromEntries(
    Object.entries(body(b.localRepos)).filter(
      (e): e is [string, string] => typeof e[1] === "string",
    ),
  );
  await saveRepos({ repos, localRepos });
  res.json(await getSetupStatus());
});

boardWatcherRouter.post("/setup/extras", async (req, res) => {
  const b = body(req.body);
  await saveExtras({
    teamsWebhook: text(b.teamsWebhook),
    jenkinsUser: text(b.jenkinsUser),
    jenkinsToken: text(b.jenkinsToken),
  });
  res.json(await getSetupStatus());
});

boardWatcherRouter.post("/setup/finish", async (req, res) => {
  const b = body(req.body);
  await finishSetup({ features: body(b.features), live: body(b.live) });
  // Turned on with the beta already on: the first look runs now.
  if (await automationsOn()) await runBoardWatcherNow();
  res.json(await getSetupStatus());
});

// The automations beta is off (Settings): nothing of the watcher answers, so nothing runs from here.
boardWatcherRouter.use(async (_req, _res, next) => {
  if (await automationsOn()) return next();
  next(new ConflictError("AUTOMATIONS_OFF", "The board automations beta is off in Settings."));
});

/** The live feed: the steps after `after` (a seq) and what's running now. */
boardWatcherRouter.get("/activity", (req, res) => {
  const after = Number(req.query.after);
  res.json(readActivity(Number.isFinite(after) ? after : 0));
});

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

/** A ticket's PR branches that can be pointed to homolog. */
boardWatcherRouter.get("/homolog/candidates", async (req, res) => {
  const key = typeof req.query.key === "string" ? req.query.key.trim().toUpperCase() : "";
  if (!/^[A-Z][A-Z0-9]+-\d+$/.test(key)) throw new BadRequestError("BAD_KEY", "key");
  res.json(await homologCandidates(key));
});

/** Points a branch to homolog (Jenkins Replay); the app asks the user to confirm first. */
boardWatcherRouter.post("/homolog", async (req, res) => {
  const { repo, branch } = (req.body ?? {}) as { repo?: unknown; branch?: unknown };
  if (typeof repo !== "string" || typeof branch !== "string" || !branch) {
    throw new BadRequestError("BAD_HOMOLOG", "repo and branch");
  }
  res.json(await pointToHomolog(repo, branch));
});

/** The daily summary right now, to read in the Board (nothing goes to Teams). */
boardWatcherRouter.get("/daily", async (_req, res) => {
  res.json(await previewDaily());
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
