import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { recordEvent } from "../utils/history.js";
import { REPO_ROOT } from "../utils/repoRoot.js";
import { isBusinessTime, localDay } from "./boardWatcher/businessTime.js";
import { loadBoardWatcherConfig, type BoardWatcherConfig } from "./boardWatcher/config.js";
import type { Decision } from "./boardWatcher/decide.js";
import { buildActionsDigest } from "./boardWatcher/digest.js";
import { bitbucketCredentialsFromEnv, listOpenPullRequests } from "./boardWatcher/bitbucket.js";
import { runClaudeReview } from "./boardWatcher/claudeReviewer.js";
import { createSimulationDeps, readActions, recordAction } from "./boardWatcher/simulation.js";
import { buildUrgentCard, postTeamsCard } from "./boardWatcher/teamsCards.js";
import { applyReview, runTick } from "./boardWatcher/tick.js";
import { emptyWatcherState, prSubject, type WatcherState } from "./boardWatcher/types.js";

/**
 * Runs the board watcher inside the server: a look at the board every 10 minutes in business
 * hours (60 outside), the digest to Teams at the start and end of the day, and an alert when a
 * look fails. Off unless `boardWatcher.json` has `"enabled": true`; only simulation mode exists
 * so far (`boardWatcher/simulation.ts`). With `review.enabled`, PRs due for review get a real
 * review session (`claudeReviewer.ts`), one at a time after the look, whose findings go through
 * the same rules but are only recorded. State between looks lives in the gitignored
 * `boardWatcher-state.json`; every read-modify-write of it goes through `serial`.
 */

const STATE_FILE = path.join(REPO_ROOT, "boardWatcher-state.json");
const BUSINESS_INTERVAL_MS = 10 * 60_000;
const OFF_HOURS_INTERVAL_MS = 60 * 60_000;
/** Local times the digest goes out, on business days. */
const DIGEST_TIMES = ["09:00", "18:00"];
/** The same failure is alerted at most this often. */
const ERROR_ALERT_EVERY_MS = 2 * 60 * 60_000;

type PersistedState = WatcherState & {
  lastTickAt: string | null;
  lastDigestAt: string | null;
  lastError: { message: string; at: string; alertedAt: string | null } | null;
};

export type BoardWatcherStatus = {
  enabled: boolean;
  mode: string | null;
  running: boolean;
  lastTickAt: string | null;
  lastDigestAt: string | null;
  lastError: PersistedState["lastError"];
  pausedReason: string | null;
  reviewing: boolean;
  pendingReviews: string[];
  lastDecisions: Decision[];
};

let timer: NodeJS.Timeout | null = null;
let running = false;
let lastDecisions: Decision[] = [];
let lastConfig: BoardWatcherConfig | null = null;
let reviewing = false;
let stateChain: Promise<unknown> = Promise.resolve();

/** Runs `fn` after every earlier state change has finished, so looks and reviews don't overwrite
 *  each other's state. */
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = stateChain.then(fn, fn);
  stateChain = next.catch(() => undefined);
  return next;
}

async function loadState(): Promise<PersistedState> {
  const raw = await readFile(STATE_FILE, "utf8").catch(() => null);
  const base = { ...emptyWatcherState(), lastTickAt: null, lastDigestAt: null, lastError: null };
  return raw ? { ...base, ...(JSON.parse(raw) as Partial<PersistedState>) } : base;
}

async function saveState(state: PersistedState): Promise<void> {
  const tmp = `${STATE_FILE}.tmp`;
  await writeFile(tmp, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await rename(tmp, STATE_FILE);
}

/** The latest digest time that has passed today (business days only), or null. */
function dueDigestSlot(now: Date, config: BoardWatcherConfig): Date | null {
  const { timezone, days } = config.businessHours;
  const local = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
  if (!days.includes(local.getDay())) return null;
  const offsetMs = local.getTime() - now.getTime();
  let due: Date | null = null;
  for (const time of DIGEST_TIMES) {
    const [h, m] = time.split(":").map(Number);
    const slotLocal = new Date(local);
    slotLocal.setHours(h ?? 0, m ?? 0, 0, 0);
    const slot = new Date(slotLocal.getTime() - offsetMs);
    if (slot.getTime() <= now.getTime()) due = slot;
  }
  return due;
}

async function sendDigestIfDue(
  state: PersistedState,
  config: BoardWatcherConfig,
  now: Date,
): Promise<void> {
  const slot = dueDigestSlot(now, config);
  if (!slot) return;
  if (state.lastDigestAt && Date.parse(state.lastDigestAt) >= slot.getTime()) return;
  const webhook = process.env.TEAMS_WEBHOOK_URL;
  if (!webhook) {
    console.warn("[board-watcher] TEAMS_WEBHOOK_URL isn't set; skipping the digest.");
    return;
  }
  const since = state.lastDigestAt
    ? new Date(state.lastDigestAt)
    : new Date(now.getTime() - 24 * 60 * 60_000);
  const entries = await readActions(since);
  await postTeamsCard(webhook, buildActionsDigest(entries, config, since, true));
  state.lastDigestAt = now.toISOString();
  recordEvent("boardWatcher.digest", { entries: entries.length });
}

async function alertError(state: PersistedState, message: string, now: Date): Promise<void> {
  const previous = state.lastError;
  const alertedAt = previous?.message === message && previous.alertedAt ? previous.alertedAt : null;
  state.lastError = { message, at: now.toISOString(), alertedAt };
  if (alertedAt && now.getTime() - Date.parse(alertedAt) < ERROR_ALERT_EVERY_MS) return;
  const webhook = process.env.TEAMS_WEBHOOK_URL;
  if (!webhook) return;
  await postTeamsCard(
    webhook,
    buildUrgentCard({
      title: "Board watcher não conseguiu olhar o board",
      text: `${message} Ele tenta de novo sozinho; se for token vencido ou VPN, precisa de você.`,
    }),
  ).catch((err: unknown) => console.warn("[board-watcher] Couldn't send the alert:", err));
  state.lastError.alertedAt = now.toISOString();
}

async function look(): Promise<void> {
  if (running) return;
  running = true;
  await serial(lookLocked);
  void drainReviews();
}

async function lookLocked(): Promise<void> {
  const started = Date.now();
  const now = new Date();
  const config = await loadBoardWatcherConfig().catch((err: unknown) => {
    console.warn("[board-watcher] Couldn't read boardWatcher.json:", err);
    return null;
  });
  lastConfig = config;
  const state = await loadState();
  try {
    if (!config?.enabled) return;
    if (config.mode !== "simulate") {
      throw new Error(`Mode "${String(config.mode)}" isn't supported yet; use "simulate".`);
    }
    const onReview = config.review?.enabled
      ? (pr: WatcherState["pendingReviews"][number]) => {
          if (!state.pendingReviews.some((p) => prSubject(p) === prSubject(pr))) {
            state.pendingReviews.push(pr);
          }
        }
      : undefined;
    lastDecisions = await runTick(
      createSimulationDeps(config, () => new Date(), onReview),
      state,
      config,
      now,
    );
    state.lastTickAt = now.toISOString();
    state.lastError = null;
    recordEvent("boardWatcher.tick", {
      mode: config.mode,
      decisions: lastDecisions.length,
      durationMs: Date.now() - started,
    });
    await sendDigestIfDue(state, config, now);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[board-watcher] Look failed:", message);
    recordEvent("boardWatcher.error", { message });
    await alertError(state, message, now);
  } finally {
    if (config?.enabled) await saveState(state);
    running = false;
    schedule(config);
  }
}

function schedule(config: BoardWatcherConfig | null): void {
  if (timer) clearTimeout(timer);
  const businessTime = config ? isBusinessTime(new Date(), config.businessHours) : false;
  timer = setTimeout(
    () => void look(),
    businessTime ? BUSINESS_INTERVAL_MS : OFF_HOURS_INTERVAL_MS,
  );
}

/** Runs the pending review sessions one at a time; each result goes through `applyReview`
 *  against the simulation providers, so it's recorded, not posted. */
async function drainReviews(): Promise<void> {
  if (reviewing) return;
  reviewing = true;
  try {
    for (;;) {
      const config = await loadBoardWatcherConfig().catch(() => null);
      const pr = (await loadState()).pendingReviews[0];
      if (!config?.enabled || !config.review?.enabled || !config.bitbucket || !pr) return;
      const subject = prSubject(pr);
      const started = Date.now();
      let outcome: string;
      try {
        const repoPath = config.bitbucket.localRepos?.[pr.repo];
        if (!repoPath) throw new Error(`No local clone of ${pr.repo} in bitbucket.localRepos.`);
        const openPrs = await listOpenPullRequests(
          bitbucketCredentialsFromEnv(config.bitbucket.workspace),
          [pr.repo],
        );
        const output = await runClaudeReview(pr, {
          repoPath,
          jiraSite: config.jira?.site,
          openPrs,
          model: config.review.model,
          maxBudgetUsd: config.review.maxBudgetUsd,
        });
        await serial(async () => {
          const state = await loadState();
          state.pendingReviews = state.pendingReviews.filter((p) => prSubject(p) !== subject);
          await recordAction({
            action: "reviewed",
            subject,
            title: pr.title,
            detail: `${output.summary} · Bate com a LED: ${output.ticketMatch} · Confiança: ${output.confidence}`,
          });
          await applyReview(
            pr,
            output,
            createSimulationDeps(config, () => new Date()),
            state,
            config,
          );
          await saveState(state);
        });
        outcome = `${output.findings.length} finding(s), ${output.verdict}`;
      } catch (err) {
        outcome = err instanceof Error ? err.message : String(err);
        console.warn(`[board-watcher] Review of ${subject} failed:`, outcome);
        await serial(async () => {
          const state = await loadState();
          state.pendingReviews = state.pendingReviews.filter((p) => prSubject(p) !== subject);
          await saveState(state);
        });
        await recordAction({ action: "review-failed", subject, title: pr.title, detail: outcome });
      }
      recordEvent("boardWatcher.review", { subject, outcome, durationMs: Date.now() - started });
    }
  } finally {
    reviewing = false;
  }
}

export function startBoardWatcher(): void {
  void look();
}

/** A look right now, instead of waiting for the next one. */
export async function runBoardWatcherNow(): Promise<BoardWatcherStatus> {
  await look();
  return getBoardWatcherStatus();
}

/** Clears a pause (e.g. the daily approval cap) so the next look runs. */
export async function resumeBoardWatcher(): Promise<BoardWatcherStatus> {
  await serial(async () => {
    const state = await loadState();
    state.pausedReason = null;
    await saveState(state);
  });
  return runBoardWatcherNow();
}

export async function getBoardWatcherStatus(): Promise<BoardWatcherStatus> {
  const config = lastConfig ?? (await loadBoardWatcherConfig().catch(() => null));
  const state = await loadState();
  return {
    enabled: Boolean(config?.enabled),
    mode: config?.mode ?? null,
    running,
    lastTickAt: state.lastTickAt,
    lastDigestAt: state.lastDigestAt,
    lastError: state.lastError,
    pausedReason: state.pausedReason,
    reviewing,
    pendingReviews: state.pendingReviews.map(prSubject),
    lastDecisions,
  };
}

/** For a digest on demand ("send it now"), from the actions since the last one. */
export async function sendBoardWatcherDigestNow(): Promise<void> {
  const config = await loadBoardWatcherConfig();
  const webhook = process.env.TEAMS_WEBHOOK_URL;
  if (!config?.enabled || !webhook) {
    throw new Error("The watcher is off or TEAMS_WEBHOOK_URL isn't set.");
  }
  const state = await loadState();
  const now = new Date();
  const since = state.lastDigestAt
    ? new Date(state.lastDigestAt)
    : new Date(`${localDay(now, config.businessHours)}T00:00:00`);
  await postTeamsCard(webhook, buildActionsDigest(await readActions(since), config, since, true));
}
