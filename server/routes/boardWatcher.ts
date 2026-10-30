import { Router } from "express";
import {
  getBoardWatcherStatus,
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
