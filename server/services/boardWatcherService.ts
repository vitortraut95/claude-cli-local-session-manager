import { localRepoPaths, sprintRepos } from "./boardWatcher/sprintRepos.js";
import { appendFile, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  BoardWatcherStatus,
  DailyPreview,
  HomologCandidate,
  WatcherCalls,
  WatcherDecision,
} from "../../shared/boardWatcher.js";
import { takeCallCounts } from "./boardWatcher/http.js";
import { backupWatcherFiles, restoreMissingWatcherFiles } from "./boardWatcher/backup.js";
import { recordEvent } from "../utils/history.js";
import {
  getTaskStore,
  onStoreChange,
  setSessionStatus,
  updateQueueEntry,
  type StoreChange,
} from "../utils/taskStore.js";
import { tryGit } from "../utils/git.js";
import { getUserPreferences } from "./preferencesService.js";
import { getMaxUsagePercent } from "./usageService.js";
import { findRemoteSessionUrl } from "./session/remoteUrl.js";
import { REPO_ROOT } from "../utils/repoRoot.js";
import { BadRequestError, ConflictError, NotFoundError } from "../utils/httpError.js";
import { buildResult, HomologPatchError, replayToHomolog } from "./boardWatcher/homologReplay.js";
import {
  isBusinessDay,
  isBusinessTime,
  localDay,
  localMinutes,
  nextBusinessStart,
  toMinutes,
} from "./boardWatcher/businessTime.js";
import {
  buildDailyCard,
  draftDailyText,
  gatherDailyFacts,
  sections,
} from "./boardWatcher/dailySummary.js";
import {
  buildPageUrl,
  diagnoseBuild,
  rebuildJob,
  type BuildDiagnosis,
  type RebuildOutcome,
} from "./boardWatcher/buildDiagnosis.js";
import { loadBoardWatcherConfig, type BoardWatcherConfig } from "./boardWatcher/config.js";
import type { Decision } from "./boardWatcher/decide.js";
import { buildActionsDigest } from "./boardWatcher/digest.js";
import { getLessons, getScoreboard } from "./boardWatcher/feedback.js";
import {
  bitbucketCredentialsFromEnv,
  branchBuild,
  findPullRequestsForKey,
  hasAiReviewComment,
  pullRequestNews,
} from "./boardWatcher/bitbucket.js";
import { parseReviewOutput } from "./boardWatcher/claudeReviewer.js";
import {
  commentsUpToPlan,
  findTestRepos,
  runClaudeTest,
  TESTS_DIR,
  type TestOutput,
} from "./boardWatcher/claudeTester.js";
import {
  ACTIONS_FILE,
  createBoardDeps,
  readActions,
  recordAction,
  type ActionEntry,
} from "./boardWatcher/boardDeps.js";
import { draftPoQuestions } from "./boardWatcher/poQuestions.js";
import { postTeamsCard, reasonPtBr } from "./boardWatcher/teamsCards.js";
import {
  issueUrl,
  noticeJobFailed,
  noticeLiveAction,
  noticeQueueError,
  noticeWaitingForYou,
  noticeTestsNeedNetwork,
  noticeWeakDescription,
  noticeReviewBlocked,
  noticeHomologDone,
  noticeInfraIncident,
  noticeNewsOnMyPr,
  noticePreviewFailed,
  noticeTestDone,
  noticeWatcherError,
  prUrl,
} from "./boardWatcher/instantNotices.js";
import { ARCHIVE_FILE, rotateActions } from "./boardWatcher/history.js";
import { networkProblem, remindOnDesktop } from "./boardWatcher/network.js";
import { isTestReport, testPlanStatus } from "./boardWatcher/testPlan.js";
import { applyReview, runTick } from "./boardWatcher/tick.js";
import {
  addReviewEntryIfAbsent,
  addTestEntryIfAbsent,
  requeueTestEntry,
} from "./taskQueueService.js";
import { findOpenPullRequest, reviewBoardSetup, reviewRepoPath } from "./taskReviewService.js";
import {
  automationSignal,
  automationsOn,
  automationsStopped,
  guardDeps,
  rearmAutomations,
  stopAutomations,
} from "./boardWatcher/beta.js";
import { onPreferencesSaved } from "./preferencesService.js";
import { noteActivity, startActivity } from "./boardWatcher/activity.js";
import {
  byPriority,
  emptyWatcherState,
  prSubject,
  type AiReviewOutcome,
  type BoardIssue,
  type PullRequest,
  type WatcherState,
} from "./boardWatcher/types.js";

/**
 * Runs the board watcher inside the server: a look at the board every 10 minutes in business
 * hours (60 outside), the digest to Teams at the start and end of the day, and an alert when a
 * look fails. Off unless `boardWatcher.json` has `"enabled": true`; each automation on does its
 * writes (queue a task, move a card, comment, approve) for real (`boardWatcher/boardDeps.ts`).
 * PRs due for review go to the task queue as review entries (`taskReviewService.ts`), whose
 * findings come back through `submitReviewResult` and go through the same rules. State between looks lives in the gitignored
 * `boardWatcher-state.json`; every read-modify-write of it goes through `serial`.
 */

const STATE_FILE = path.join(REPO_ROOT, "boardWatcher-state.json");
/** The actions only simulated back when there was a simulation mode, out of the history. */
const SIMULATED_FILE = path.join(REPO_ROOT, "boardWatcher-actions-simulated.jsonl");
const BUSINESS_INTERVAL_MS = 10 * 60_000;
const OFF_HOURS_INTERVAL_MS = 60 * 60_000;
/** Local times the digest goes out, on business days. */
/** When the digest goes out: at the start of business hours and DIGEST_BEFORE_END_MIN before
 *  they end (nothing is sent once they're over). */
const DIGEST_BEFORE_END_MIN = 10;

function digestTimes(config: BoardWatcherConfig): string[] {
  const { start, end } = config.businessHours;
  const evening = Math.max(toMinutes(start), toMinutes(end) - DIGEST_BEFORE_END_MIN);
  const hhmm = `${String(Math.floor(evening / 60)).padStart(2, "0")}:${String(evening % 60).padStart(2, "0")}`;
  return [start, hhmm];
}
/** The same failure is alerted at most this often. */
const ERROR_ALERT_EVERY_MS = 2 * 60 * 60_000;

type PersistedState = WatcherState & {
  lastTickAt: string | null;
  lastDigestAt: string | null;
  /** The day ("YYYY-MM-DD") the last daily summary went out. */
  lastDailyDay?: string;
  lastError: { message: string; at: string; alertedAt: string | null } | null;
  /** Marks in `handled` from before simulated ones carried `sim:` were checked once. */
  simMarksMigrated?: boolean;
  /** What the simulation mode left behind was cleared once (`dropSimulation`). */
  simulationDropped?: boolean;
};

let timer: NodeJS.Timeout | null = null;
let nextLookAt: string | null = null;
let running = false;
let lastDecisions: Decision[] = [];
/** Titles of the last look's tickets and PRs, for the Board. */
let lastTitles = new Map<string, string>();
/** Per look: when, how long and the API calls since the previous one (for the last hour's sum). */
const looks: { at: number; ms: number; calls: WatcherCalls["lastLook"]; retries: number }[] = [];
const HOUR_MS = 60 * 60_000;

function callStats(): WatcherCalls | null {
  const last = looks.at(-1);
  if (!last) return null;
  const recent = looks.filter((l) => Date.now() - l.at < HOUR_MS);
  const sum = (service: keyof WatcherCalls["lastLook"]) =>
    recent.reduce((total, l) => total + l.calls[service], 0);
  return {
    lastLook: last.calls,
    lastLookMs: last.ms,
    retries: last.retries,
    lastHour: { jira: sum("jira"), bitbucket: sum("bitbucket"), jenkins: sum("jenkins") },
  };
}
let lastConfig: BoardWatcherConfig | null = null;
let reviewing = false;
/** Why pending reviews/tests aren't starting, shown in the app; null while they can. */
let jobsBlockedBy: string | null = null;
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
  const base: PersistedState = {
    ...emptyWatcherState(),
    lastTickAt: null,
    lastDigestAt: null,
    lastError: null,
  };
  const state: PersistedState = raw
    ? { ...base, ...(JSON.parse(raw) as Partial<PersistedState>) }
    : base;
  if (!state.simulationDropped) {
    if (!state.simMarksMigrated) await markSimulatedHandled(state);
    await dropSimulation(state);
    await saveState(state);
  }
  return state;
}

const SIM = "sim:";
/** Old actions that only had `live` set when done for real (the rest was simulated). */
const LIVE_FLAGGED: ActionEntry["action"][] = [
  "enqueue-dev",
  "claim-test",
  "start-progress",
  "comment",
  "approve",
];
type LegacyEntry = ActionEntry & { live?: boolean };

/**
 * There's no simulation mode anymore: simulated marks are dropped (so the automation, once on,
 * picks those tickets and PRs up), a PR reviewed for real counts as its one AI review, and the
 * actions that were only simulated move out of the history into SIMULATED_FILE.
 */
async function dropSimulation(state: PersistedState): Promise<void> {
  for (const [key, value] of Object.entries(state.handled)) {
    if (value.startsWith(SIM)) delete state.handled[key];
    else if (key.startsWith("review:")) state.handled[`ai-reviewed:${key.slice(7)}`] = value;
  }
  const legacy = state as PersistedState & { reviewRounds?: unknown; reviewedCommits?: unknown };
  delete legacy.reviewRounds;
  delete legacy.reviewedCommits;
  delete state.simMarksMigrated;
  for (const file of [ARCHIVE_FILE, ACTIONS_FILE]) {
    const raw = await readFile(file, "utf8").catch(() => null);
    if (raw === null) continue;
    const kept: string[] = [];
    const simulated: string[] = [];
    for (const line of raw.split("\n").filter(Boolean)) {
      const entry = JSON.parse(line) as LegacyEntry;
      if (LIVE_FLAGGED.includes(entry.action) && !entry.live) {
        simulated.push(line);
        continue;
      }
      delete entry.live;
      kept.push(JSON.stringify(entry));
    }
    if (simulated.length > 0) {
      await appendFile(SIMULATED_FILE, `${simulated.join("\n")}\n`, "utf8");
    }
    await writeFile(`${file}.tmp`, kept.length ? `${kept.join("\n")}\n` : "", "utf8");
    await rename(`${file}.tmp`, file);
  }
  state.simulationDropped = true;
}

/** The action kinds behind each mark that, logged with `live`, mean it was done for real. */
const MARK_ACTIONS: Record<string, string[]> = {
  dev: ["enqueue-dev"],
  test: ["claim-test"],
  review: ["comment", "approve"],
};

/** Older marks don't say whether they were simulated: the actions log does. A mark with no real
 *  action behind it gets `sim:`, so turning that automation on picks it up again. */
async function markSimulatedHandled(state: PersistedState): Promise<void> {
  const logs = await Promise.all(
    [ARCHIVE_FILE, ACTIONS_FILE].map((file) => readFile(file, "utf8").catch(() => "")),
  );
  const live = new Set<string>();
  for (const line of logs.join("\n").split("\n").filter(Boolean)) {
    const entry = JSON.parse(line) as ActionEntry;
    if (!(entry as LegacyEntry).live) continue;
    for (const [kind, actions] of Object.entries(MARK_ACTIONS)) {
      if (actions.includes(entry.action)) live.add(`${kind}:${entry.subject}`);
    }
  }
  for (const [key, value] of Object.entries(state.handled)) {
    const kind = key.split(":")[0] ?? "";
    if (!MARK_ACTIONS[kind] || value.startsWith("sim:") || live.has(key)) continue;
    state.handled[key] = `${SIM}${value}`;
  }
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
  for (const time of digestTimes(config)) {
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
  if (config.notifications?.digest === false) return;
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
  // Build failures and PR news went out as they happened; alone they make no digest.
  const entries = (await readActions(since)).filter(
    (e) => e.action !== "build-failed" && e.action !== "pr-news",
  );
  // Nothing happened since the last one: no card (the next one still covers from `since`).
  if (entries.length === 0) return;
  await postTeamsCard(webhook, buildActionsDigest(entries, config, since));
  state.lastDigestAt = now.toISOString();
  recordEvent("boardWatcher.digest", { entries: entries.length });
}

/** After the meeting this long, a missed summary isn't sent any more (it's for the meeting). */
const DAILY_LATE_MINUTES = 30;

/** The daily summary, once per business day, from `leadMinutes` before the meeting. Best-effort:
 *  a failure is logged and retried at the next look. */
async function sendDailyIfDue(
  state: PersistedState,
  config: BoardWatcherConfig,
  now: Date,
): Promise<void> {
  const webhook = process.env.TEAMS_WEBHOOK_URL;
  if (!config.daily || !webhook || !isBusinessDay(now, config.businessHours)) return;
  const today = localDay(now, config.businessHours);
  if (state.lastDailyDay === today) return;
  const meeting = toMinutes(config.daily.meetingAt);
  const minutes = localMinutes(now, config.businessHours);
  if (
    minutes < meeting - (config.daily.leadMinutes ?? 15) ||
    minutes > meeting + DAILY_LATE_MINUTES
  ) {
    return;
  }
  try {
    const facts = await gatherDailyFacts(config, now);
    await postTeamsCard(webhook, buildDailyCard(facts, await draftDailyText(facts)));
    state.lastDailyDay = today;
    recordEvent("boardWatcher.daily", {
      day: facts.day,
      items: facts.moved.length + facts.commits.length,
    });
  } catch (err) {
    console.warn("[board-watcher] Couldn't send the daily summary:", err);
  }
}

function alertError(state: PersistedState, message: string, now: Date): void {
  const previous = state.lastError;
  const alertedAt = previous?.message === message && previous.alertedAt ? previous.alertedAt : null;
  state.lastError = { message, at: now.toISOString(), alertedAt };
  if (alertedAt && now.getTime() - Date.parse(alertedAt) < ERROR_ALERT_EVERY_MS) return;
  if (!process.env.TEAMS_WEBHOOK_URL) return;
  noticeWatcherError(message);
  state.lastError.alertedAt = now.toISOString();
}

async function look(): Promise<void> {
  if (running) return;
  running = true;
  await serial(lookLocked);
  void drainJobs();
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
  const signal = automationSignal();
  let endLook: (() => void) | null = null;
  try {
    if (!config?.enabled || !(await automationsOn())) return;
    // Eye closed: nothing at all until business hours start again, unless the user started
    // something by hand.
    if (!isBusinessTime(now, config.businessHours) && state.forced.length === 0) return;
    endLook = startActivity("look");
    const onReview = (pr: WatcherState["pendingReviews"][number]) => {
      if (!state.pendingReviews.some((p) => prSubject(p) === prSubject(pr))) {
        state.pendingReviews.push(pr);
      }
    };
    const onTest =
      config.test?.enabled !== false
        ? (issue: WatcherState["pendingTests"][number]["issue"], retest: boolean) => {
            if (state.pendingTests.some((t) => t.issue.key === issue.key)) return;
            if (retest) {
              const report = issue.comments.filter((c) => isTestReport(c.body)).at(-1);
              state.pendingTests.push({ issue, planId: report?.id ?? "", retest: true });
              return;
            }
            const plan = testPlanStatus(issue.comments);
            if (plan.state === "pending") state.pendingTests.push({ issue, planId: plan.plan.id });
          }
        : undefined;
    await rotateActionsDaily(now);
    await backupDaily(now, config);
    const deps = guardDeps(
      createBoardDeps(
        config,
        () => new Date(),
        onReview,
        onTest,
        (issue, missing) => void sendWeakDescriptionQuestions(config, issue, missing),
      ),
      signal,
    );
    let issues: BoardIssue[] = [];
    let prs: PullRequest[] = [];
    const { board, codeHost } = deps;
    deps.board = {
      ...board,
      listIssues: async () => {
        issues = await board.listIssues();
        noteActivity("issues", undefined, String(issues.length));
        return issues;
      },
    };
    deps.codeHost = {
      ...codeHost,
      listPullRequests: async () => {
        prs = await codeHost.listPullRequests();
        noteActivity("prs", undefined, String(prs.length));
        return prs;
      },
    };
    lastDecisions = await runTick(deps, state, config, now);
    // Started by hand: done with this look, except a session still to run (`drainJobs`).
    state.forced = state.forced.filter(
      (subject) =>
        state.pendingReviews.some((p) => prSubject(p) === subject) ||
        state.pendingTests.some((t) => t.issue.key === subject),
    );
    lastTitles = new Map([
      ...issues.map((i) => [i.key, i.summary] as const),
      ...prs.map((p) => [prSubject(p), p.title] as const),
    ]);
    noteActivity(
      "decisions",
      undefined,
      String(lastDecisions.filter((d) => d.action !== "wait" && d.action !== "skip").length),
    );
    diagnoseDecisionBuilds(lastDecisions);
    await noticeNewsOnMyPullRequests(config, prs, state, now);
    await watchPreviewBuilds(config, issues, state);
    diagnoseOpenPrBuilds(prs, config);
    state.lastTickAt = now.toISOString();
    state.lastError = null;
    const { calls, retries } = takeCallCounts();
    looks.push({ at: Date.now(), ms: Date.now() - started, calls, retries });
    while (looks.length > 0 && Date.now() - (looks[0]?.at ?? 0) > HOUR_MS) looks.shift();
    recordEvent("boardWatcher.tick", {
      decisions: lastDecisions.length,
      durationMs: Date.now() - started,
    });
    await sendDigestIfDue(state, config, now);
    await sendDailyIfDue(state, config, now);
  } catch (err) {
    if (signal.aborted) {
      recordEvent("boardWatcher.stopped", { during: "look" });
      noteActivity("stopped", undefined, "look");
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[board-watcher] Look failed:", message);
    noteActivity("lookFailed", undefined, message);
    recordEvent("boardWatcher.error", { message });
    alertError(state, message, now);
  } finally {
    if (endLook) {
      endLook();
      if (state.lastTickAt === now.toISOString()) {
        noteActivity("lookDone", undefined, String(Math.round((Date.now() - started) / 1000)));
      }
    }
    if (config?.enabled) await saveState(state);
    running = false;
    schedule(config);
  }
}

/** The `env/` preview builds of the tickets the user cares about (theirs under way, the tests it
 *  claimed): a failure is told once per commit, with the cause read from the Jenkins log when
 *  the token is set. Best-effort. */
async function watchPreviewBuilds(
  config: BoardWatcherConfig,
  issues: BoardIssue[],
  state: WatcherState,
): Promise<void> {
  if (!config.bitbucket || config.notifications?.instant === false) return;
  const credentials = bitbucketCredentialsFromEnv(config.bitbucket.workspace);
  const watched = issues.filter(
    (i) =>
      state.claimedTests.includes(i.key) ||
      (i.assigneeId === config.me && !config.columns.todo.includes(i.statusId)),
  );
  for (const issue of watched) {
    const previews = (await ticketPullRequests(issue.key, config)).filter((pr) =>
      pr.branch.startsWith("env/"),
    );
    for (const { repo, branch } of previews) {
      const build = await branchBuild(credentials, repo, branch).catch(() => null);
      const url = build?.failedUrl;
      // Per build: a re-run that fails again on the same commit is told again.
      const key = `build:${url ?? `${repo}:${build?.hash ?? ""}`}`;
      if (build?.ci !== "failed" || state.handled[key]) continue;
      state.handled[key] = new Date().toISOString();
      void (url ? diagnoseOnce(url, issue.key) : Promise.resolve(null)).then(async (diagnosis) => {
        const rebuild =
          url && diagnosis && diagnosis.kind !== "code" && config.rebuild?.enabled !== false
            ? await rebuildOnce(`rebuild:${repo}:${build.hash}`, url)
            : null;
        noticePreviewFailed(
          config,
          issue,
          repo,
          branch,
          url ? buildPageUrl(url) : null,
          diagnosis,
          rebuild,
        );
        await recordAction({
          action: "build-failed",
          subject: issue.key,
          title: issue.summary,
          detail: [
            diagnosis
              ? `${repo} ${branch} · ${diagnosis.kind === "infra" ? "infra" : diagnosis.kind === "code" ? "código" : "?"} · ${diagnosis.stage}: ${diagnosis.cause} → ${diagnosis.fix}`
              : `${repo} ${branch}`,
            rebuild ? REBUILD_PT[rebuild] : "",
          ]
            .filter(Boolean)
            .join(" · "),
        });
        recordEvent("boardWatcher.buildFailed", {
          key: issue.key,
          repo,
          kind: diagnosis?.kind,
          rebuild,
        });
      });
    }
  }
}

const REBUILD_PT: Record<RebuildOutcome, string> = {
  done: "rodou o build de novo",
  again: "já tinha rodado de novo neste commit e falhou de novo",
  refused: "o Jenkins recusou rodar de novo",
};

/** A non-code failure's build runs again once per commit; a second failure on the same commit
 *  is left to the user. */
async function rebuildOnce(key: string, url: string): Promise<RebuildOutcome> {
  const already = (await loadState()).handled[key];
  if (already) return "again";
  const ok = await rebuildJob(url).catch(() => false);
  noteActivity("rebuild", key.replace(/^rebuild:/, ""), ok ? "done" : "failed");
  await serial(async () => {
    const state = await loadState();
    state.handled[key] = new Date().toISOString();
    await saveState(state);
  });
  return ok ? "done" : "refused";
}

/** Build diagnoses by the build's link, so each failed build's log is read once; `null` = tried
 *  and couldn't (no token, Jenkins down). */
const diagnoses = new Map<string, BuildDiagnosis | null>();
const diagnosing = new Set<string>();

function diagnoseOnce(url: string, subject: string): Promise<BuildDiagnosis | null> {
  if (diagnoses.has(url)) return Promise.resolve(diagnoses.get(url) ?? null);
  diagnosing.add(url);
  const endDiagnose = startActivity("diagnose", subject);
  return diagnoseBuild(url)
    .catch(() => null)
    .then((diagnosis) => {
      endDiagnose();
      noteActivity("diagnosed", subject, diagnosis?.kind ?? "unknown");
      if (diagnoses.size > 200) diagnoses.clear();
      diagnoses.set(url, diagnosis);
      diagnosing.delete(url);
      if (diagnosis?.incident) noteIncident(diagnosis.incident, buildPageUrl(url), subject);
      return diagnosis;
    });
}

/** Infra failures seen lately, by incident, to tell one incident once instead of per build. */
const INCIDENT_WINDOW_MS = 3 * 60 * 60_000;
const incidents = new Map<
  string,
  { builds: Map<string, { subject: string; at: number }>; noticedAt: number }
>();

function noteIncident(
  incident: NonNullable<BuildDiagnosis["incident"]>,
  url: string,
  subject: string,
): void {
  const now = Date.now();
  const seen = incidents.get(incident.signature) ?? {
    builds: new Map<string, { subject: string; at: number }>(),
    noticedAt: 0,
  };
  seen.builds.set(url, { subject, at: now });
  for (const [build, { at }] of seen.builds) {
    if (now - at > INCIDENT_WINDOW_MS) seen.builds.delete(build);
  }
  incidents.set(incident.signature, seen);
  if (seen.builds.size < 2 || now - seen.noticedAt < INCIDENT_WINDOW_MS) return;
  seen.noticedAt = now;
  const builds = [...seen.builds].map(([buildUrl, b]) => ({ subject: b.subject, url: buildUrl }));
  noticeInfraIncident(incident, builds);
  void recordAction({
    action: "notify",
    subject: `Infra: ${incident.agent}`,
    title: "",
    detail: `urgent: ${incident.problem} em ${builds.length} builds (${builds.map((b) => b.subject).join(", ")}) · ${incident.evidence}`,
  });
  recordEvent("boardWatcher.infraIncident", { agent: incident.agent, builds: builds.length });
}

/** Failed builds of the open PRs (anyone's) are read too, during business hours, so an infra
 *  incident shows across builds and not only the user's. Someone else's build only counts while
 *  it can still be part of an incident (failed within the incident window). */
function diagnoseOpenPrBuilds(prs: PullRequest[], config: BoardWatcherConfig): void {
  const now = Date.now();
  if (!isBusinessTime(new Date(now), config.businessHours)) return;
  for (const pr of prs) {
    const at = pr.failedBuild?.at ? Date.parse(pr.failedBuild.at) : NaN;
    const recent = now - at <= INCIDENT_WINDOW_MS;
    if (pr.authorId !== config.me && !recent) continue;
    const url = pr.failedBuild?.url;
    if (url && !diagnoses.has(url) && !diagnosing.has(url)) void diagnoseOnce(url, prSubject(pr));
  }
}

/** The "CI failed" decisions get their build's diagnosis in the background (the Board shows it
 *  once it's there). */
function diagnoseDecisionBuilds(decisions: Decision[]): void {
  for (const decision of decisions) {
    const url = decision.failedBuild?.url;
    if (url && !diagnoses.has(url) && !diagnosing.has(url))
      void diagnoseOnce(url, decision.subject);
  }
}

/** A decision as the Board shows it: links to the PR/ticket and the failed build's diagnosis. */
function decisionView(decision: Decision, config: BoardWatcherConfig | null): WatcherDecision {
  const { failedBuild, ...rest } = decision;
  const pr = /^(.+)#(\d+)$/.exec(decision.subject);
  const keys = pr ? (decision.context?.keys ?? []) : [decision.subject];
  const links: NonNullable<WatcherDecision["links"]> = [];
  if (config && pr) {
    const url = prUrl(config, { repo: pr[1] ?? "", id: pr[2] ?? "" } as PullRequest);
    if (url) links.push({ kind: "pr", url });
  }
  for (const key of keys) {
    const url = config ? issueUrl(config, key) : null;
    if (url) links.push({ kind: "issue", url });
  }
  return {
    ...rest,
    links,
    ...(failedBuild
      ? {
          build: {
            url: buildPageUrl(failedBuild.url),
            name: failedBuild.name,
            ...(diagnoses.has(failedBuild.url)
              ? { diagnosis: diagnoses.get(failedBuild.url) ?? null }
              : {}),
          },
        }
      : {}),
  };
}

/** Tells the user when others comment on, or ask for changes in, their open PRs. A PR seen for
 *  the first time only starts the count (what was said before isn't news). Best-effort. */
async function noticeNewsOnMyPullRequests(
  config: BoardWatcherConfig,
  prs: PullRequest[],
  state: WatcherState,
  now: Date,
): Promise<void> {
  if (!config.bitbucket || config.notifications?.instant === false) return;
  const credentials = bitbucketCredentialsFromEnv(config.bitbucket.workspace);
  for (const pr of prs.filter((p) => p.authorId === config.me)) {
    const key = `mine:${prSubject(pr)}`;
    const since = state.handled[key];
    state.handled[key] = now.toISOString();
    // Nothing happened on it since (a comment or a review bumps the PR's update time).
    if (!since || (pr.updatedAt && Date.parse(pr.updatedAt) <= Date.parse(since))) continue;
    try {
      const news = await pullRequestNews(credentials, pr, since, config.me);
      if (news.comments.length === 0 && news.changesRequested.length === 0) continue;
      noticeNewsOnMyPr(config, pr, news);
      await recordAction({
        action: "pr-news",
        subject: prSubject(pr),
        title: pr.title,
        detail: [
          ...news.changesRequested.map((who) => `${who} pediu mudanças`),
          ...news.comments.map(
            (c) =>
              `${c.author}: ${c.file ? `${c.file}${c.line ? `:${c.line}` : ""} — ` : ""}${c.body}`,
          ),
        ].join("\n"),
      });
      recordEvent("boardWatcher.myPrNews", {
        subject: prSubject(pr),
        comments: news.comments.length,
        changesRequested: news.changesRequested.length,
      });
    } catch (err) {
      state.handled[key] = since;
      console.warn(`[board-watcher] Couldn't read the news on ${prSubject(pr)}:`, err);
    }
  }
}

/** The questions to unblock a weak To Do description, drafted and sent to Teams (best-effort:
 *  without them, the notice still says what's missing). */
async function sendWeakDescriptionQuestions(
  config: BoardWatcherConfig,
  issue: WatcherState["pendingTests"][number]["issue"],
  missing: string,
): Promise<void> {
  if (config.notifications?.instant === false || !process.env.TEAMS_WEBHOOK_URL) return;
  const missingPt = reasonPtBr(missing);
  const messages = await draftPoQuestions(issue, missingPt, issueUrl(config, issue.key)).catch(
    (err: unknown) => {
      console.warn(`[board-watcher] Couldn't draft questions for ${issue.key}:`, err);
      return [];
    },
  );
  noticeWeakDescription(config, issue, missingPt, messages);
  recordEvent("boardWatcher.poQuestions", { key: issue.key, messages: messages.length });
}

let lastBackupDay = "";

/** Today's copy of the watcher's files, the first look of the day. */
async function backupDaily(now: Date, config: BoardWatcherConfig): Promise<void> {
  const day = localDay(now, config.businessHours);
  if (lastBackupDay === day) return;
  lastBackupDay = day;
  await backupWatcherFiles(day).catch((err: unknown) =>
    console.warn("[board-watcher] Couldn't back up the watcher's files:", err),
  );
}

let lastRotationDay = "";

/** Archives old history once a day, between review/test sessions (they append to the log). */
async function rotateActionsDaily(now: Date): Promise<void> {
  const day = now.toISOString().slice(0, 10);
  if (reviewing || lastRotationDay === day) return;
  lastRotationDay = day;
  const moved = await rotateActions(now).catch((err: unknown) => {
    console.warn("[board-watcher] Couldn't archive old history:", err);
    return 0;
  });
  if (moved) recordEvent("boardWatcher.archive", { entries: moved });
}

function schedule(config: BoardWatcherConfig | null): void {
  if (timer) clearTimeout(timer);
  const now = new Date();
  const businessTime = config ? isBusinessTime(now, config.businessHours) : false;
  let delay: number;
  if (businessTime) {
    // Every few minutes, so one look lands in the digest's slot before business hours end.
    delay = BUSINESS_INTERVAL_MS;
  } else {
    // Eye closed: nothing until business hours start again.
    const start = config ? nextBusinessStart(now, config.businessHours) : null;
    delay = start ? Math.max(60_000, start.getTime() - now.getTime()) : OFF_HOURS_INTERVAL_MS;
  }
  nextLookAt = new Date(Date.now() + delay).toISOString();
  timer = setTimeout(() => void look(), delay);
}

/** A session started by hand is no longer let through outside business hours once it runs. */
async function unforce(subject: string): Promise<void> {
  await serial(async () => {
    const state = await loadState();
    if (!state.forced.includes(subject)) return;
    state.forced = state.forced.filter((s) => s !== subject);
    await saveState(state);
  });
}

/** "Start now" on the Board: what the ticket or PR waits for is skipped, and a look runs now.
 *  A skip (draft, conflicts, no test plan…) still holds. */
export async function startBoardWatcherItemNow(subject: string): Promise<BoardWatcherStatus> {
  await serial(async () => {
    const state = await loadState();
    if (!state.forced.includes(subject)) state.forced.push(subject);
    await saveState(state);
  });
  recordEvent("boardWatcher.startNow", { subject });
  await look();
  return getBoardWatcherStatus();
}

/** The Board's queue in the order the user dragged it to. */
export async function prioritizeBoardWatcherItems(subjects: string[]): Promise<BoardWatcherStatus> {
  await serial(async () => {
    const state = await loadState();
    state.priority = [...new Set(subjects)];
    await saveState(state);
  });
  void drainJobs();
  return getBoardWatcherStatus();
}

/** A hold is told once in the live feed, not on every look while it lasts. */
let lastBlockedNoted: string | null = null;
function noteBlocked(reason: string): void {
  if (reason === lastBlockedNoted) return;
  lastBlockedNoted = reason;
  noteActivity("blocked", undefined, reason);
}

/** Hands the pending reviews and tests on, one at a time (reviews first): a review goes to the task
 *  queue (its result comes back through `submitReviewResult`), a test to the queue or to a
 *  headless session whose verdict and report are recorded with what would be done with them. */
async function drainJobs(): Promise<void> {
  if (reviewing) return;
  reviewing = true;
  try {
    for (;;) {
      const config = await loadBoardWatcherConfig().catch(() => null);
      const state = await loadState();
      if (!config?.enabled || !config.bitbucket || !(await automationsOn())) return;
      // Eye closed: no session starts (queued ones wait for the morning), except the ones the
      // user started by hand. In the order the user dragged them to on the Board.
      const open = isBusinessTime(new Date(), config.businessHours);
      const allowed = (subject: string) => open || state.forced.includes(subject);
      const reviews =
        config.codeReview?.enabled !== false
          ? byPriority(state.pendingReviews, prSubject, state.priority).filter((p) =>
              allowed(prSubject(p)),
            )
          : [];
      const tests =
        config.test?.enabled !== false
          ? byPriority(state.pendingTests, (t) => t.issue.key, state.priority).filter((t) =>
              allowed(t.issue.key),
            )
          : [];
      if (reviews.length === 0 && tests.length === 0) return;
      const signal = automationSignal();
      const pr = reviews[0];
      const test = tests[0];
      // A headless test is a Claude session of its own: same plan limit as the queue.
      const headlessTest = !pr && test && config.test?.runner === "headless";
      if (headlessTest) {
        const { maxUsagePercent } = (await getUserPreferences()).orchestrator;
        const usage = await getMaxUsagePercent(true);
        if (usage !== null && usage >= maxUsagePercent) {
          jobsBlockedBy = `plan usage at ${usage}% (limit ${maxUsagePercent}%)`;
          noteBlocked(jobsBlockedBy);
          return;
        }
      }
      jobsBlockedBy = null;
      if (!pr) {
        if (!test) return;
        const network = await networkProblem(config.test?.requires);
        if (network) {
          jobsBlockedBy = `tests waiting: ${network}`;
          noteBlocked(jobsBlockedBy);
          noticeNetworkBlocked(network);
          return;
        }
        // A test against a preview still building (or whose build failed) would check old code:
        // the first one whose previews are ready goes, the others wait their turn.
        const waits: string[] = [];
        let ready: typeof test | undefined;
        for (const candidate of tests) {
          const wait = await previewWait(candidate.issue, config);
          if (!wait) {
            ready = candidate;
            break;
          }
          waits.push(`${candidate.issue.key} ${wait}`);
        }
        if (!ready) {
          jobsBlockedBy = `tests waiting: ${waits.join("; ")}`;
          noteBlocked(jobsBlockedBy);
          return;
        }
        await unforce(ready.issue.key);
        await runTestJob(ready, config, signal);
        if (signal.aborted) return;
        continue;
      }
      // A review is a session of the task queue: queued here, launched by the scheduler, its
      // result posted by `submitReviewResult`.
      const subject = prSubject(pr);
      try {
        const repoPath = await reviewRepoPath(config, pr.repo);
        if (!repoPath) throw new Error(`No local clone of ${pr.repo} in the workspace folders.`);
        const added = await addReviewEntryIfAbsent({
          key: subject,
          link: prUrl(config, pr),
          repo: repoPath,
        });
        await unforce(subject);
        await serial(async () => {
          const state = await loadState();
          state.pendingReviews = state.pendingReviews.filter((p) => prSubject(p) !== subject);
          await saveState(state);
        });
        await recordAction({
          action: "queued-review",
          subject,
          title: pr.title,
          detail: added ? "na fila de tarefas" : "já estava na fila",
        });
        noteActivity("reviewDone", subject, added ? "queued" : "already queued");
      } catch (err) {
        const outcome = err instanceof Error ? err.message : String(err);
        console.warn(`[board-watcher] Couldn't queue the review of ${subject}:`, outcome);
        noteActivity("reviewFailed", subject, outcome);
        await serial(async () => {
          const state = await loadState();
          state.pendingReviews = state.pendingReviews.filter((p) => prSubject(p) !== subject);
          await saveState(state);
        });
        await recordAction({ action: "review-failed", subject, title: pr.title, detail: outcome });
        noticeJobFailed("review", subject, pr.title, outcome, prUrl(config, pr));
      }
    }
  } finally {
    reviewing = false;
  }
}

/**
 * The result a queued review session sent (`POST /sessions/:id/review-result`), posted on the PR
 * like any automated review (`applyReview`: the board's limits, approval and the AI review
 * comment) and the session marked done. The PR must still be open at the reviewed commit and
 * without an AI review; when it can't be posted, the error goes on the queue entry.
 */
export async function submitReviewResult(
  sessionId: string,
  body: unknown,
): Promise<{ outcome: AiReviewOutcome["kind"]; posted: number }> {
  const queued = (await getTaskStore()).sessions[sessionId]?.test;
  if (queued?.kind !== "review") {
    throw new NotFoundError("REVIEW_SESSION_NOT_FOUND", `${sessionId} isn't a review session.`);
  }
  const output = parseReviewOutput(body);
  const subject = queued.key;
  try {
    if (!(await automationsOn())) {
      throw new ConflictError(
        "REVIEW_AUTOMATIONS_OFF",
        "The board automations are off: turn them on to post the review.",
      );
    }
    const { config, credentials } = await reviewBoardSetup();
    const { pr } = await findOpenPullRequest(credentials, subject);
    // What was reviewed: a push since then makes posting fail (`assertUnchanged`).
    const reviewed = queued.worktrees[0]
      ? await tryGit(["rev-parse", "HEAD"], queued.worktrees[0])
      : null;
    if (reviewed) pr.sourceHash = reviewed;
    if (await hasAiReviewComment(credentials, pr)) {
      throw new ConflictError("REVIEW_ALREADY_DONE", `${subject} already has its AI review.`);
    }
    const applied = await serial(async () => {
      const state = await loadState();
      await recordAction({
        action: "reviewed",
        subject,
        title: pr.title,
        detail: `${output.summary} · Bate com a LED: ${output.ticketMatch} · Confiança: ${output.confidence}`,
      });
      const result = await applyReview(
        pr,
        output,
        createBoardDeps(config, () => new Date()),
        state,
        config,
      );
      await saveState(state);
      return result;
    });
    if (output.findings.some((f) => f.severity === "blocking" && f.topic !== "product")) {
      noticeReviewBlocked(config, pr, output.summary, output.findings);
    }
    noteActivity("reviewDone", subject, `${output.findings.length} finding(s), ${output.verdict}`);
    await setSessionStatus(sessionId, "done", "scheduler");
    recordEvent("boardWatcher.review", { subject, outcome: applied.outcome.kind });
    return { outcome: applied.outcome.kind, posted: applied.posted };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    noteActivity("reviewFailed", subject, message);
    await updateQueueEntry(subject, { error: message }).catch(() => undefined);
    await recordAction({ action: "review-failed", subject, title: "", detail: message }).catch(
      () => undefined,
    );
    throw err;
  }
}

const VERDICT_PT: Record<TestOutput["verdict"], string> = {
  approved: "aprovaria",
  "approved-with-notes": "aprovaria com ressalvas",
  failed: "reprovaria",
  blocked: "não conseguiu testar",
};

/** The ticket's PRs on Bitbucket; none when it can't be reached (the ticket's text still is). */
async function ticketPullRequests(
  key: string,
  config: BoardWatcherConfig,
): Promise<{ repo: string; branch: string }[]> {
  if (!config.bitbucket) return [];
  return findPullRequestsForKey(
    bitbucketCredentialsFromEnv(config.bitbucket.workspace),
    await sprintRepos(config),
    key,
  ).catch((err: unknown) => {
    console.warn(`[board-watcher] Couldn't look up ${key}'s PRs:`, err);
    return [];
  });
}

/** A preview build younger than this without any status yet is taken as not started. */
const BUILD_START_GRACE_MS = 45 * 60_000;

/** Why the ticket's `env/` previews aren't ready to test (building, failed, not started), or null.
 *  Branches without a preview job or gone after the merge don't hold it. Best-effort: when
 *  Bitbucket can't be read, the test goes ahead. */
async function previewWait(issue: BoardIssue, config: BoardWatcherConfig): Promise<string | null> {
  if (!config.bitbucket) return null;
  const credentials = bitbucketCredentialsFromEnv(config.bitbucket.workspace);
  const previews = (await ticketPullRequests(issue.key, config)).filter((pr) =>
    pr.branch.startsWith("env/"),
  );
  for (const { repo, branch } of previews) {
    const build = await branchBuild(credentials, repo, branch).catch(() => null);
    if (!build) continue;
    if (build.ci === "running") return `preview building (${repo} ${branch})`;
    // Told about (with why) by `watchPreviewBuilds`.
    if (build.ci === "failed") return `preview build failed (${repo} ${branch})`;
    if (build.ci === "none" && Date.now() - Date.parse(build.date) < BUILD_START_GRACE_MS) {
      return `preview build not started (${repo} ${branch})`;
    }
  }
  return null;
}

/** Adds a claimed ticket to the app's task queue as a test entry; the scheduler launches it
 *  like any queued test (its limits, its session, the user's test skill). */
async function queueTestJob(
  job: WatcherState["pendingTests"][number],
  config: BoardWatcherConfig,
): Promise<string> {
  const { issue, planId } = job;
  const plan = job.retest ? undefined : issue.comments.find((c) => c.id === planId);
  // A retest reads everything: the failed report and what the dev said about the fix.
  const comments = plan ? commentsUpToPlan(issue, plan) : issue.comments;
  const repos = await findTestRepos(
    issue,
    comments,
    await localRepoPaths(config, await sprintRepos(config)),
    await ticketPullRequests(issue.key, config),
  );
  const added = await (job.retest ? requeueTestEntry : addTestEntryIfAbsent)({
    key: issue.key,
    link: issueUrl(config, issue.key),
    repos: repos.map((r) => r.path),
    // One branch name for every repo: only safe to pin with a single repo.
    branch: repos.length === 1 ? (repos[0]?.branch ?? null) : null,
  });
  await recordAction({
    action: "queued-test",
    subject: issue.key,
    title: issue.summary,
    detail: added
      ? repos.length
        ? repos.map((r) => `${r.repo} (${r.branch ?? "branch a achar"})`).join(", ")
        : "sem repo identificado (sessão sem worktree)"
      : "já estava na fila",
  });
  return added ? "queued" : "already queued";
}

async function runTestJob(
  job: WatcherState["pendingTests"][number],
  config: BoardWatcherConfig,
  signal: AbortSignal,
): Promise<void> {
  const { issue, planId } = job;
  const started = Date.now();
  let outcome = "";
  const endTest = startActivity("test", issue.key);
  try {
    if ((config.test?.runner ?? "queue") === "queue") {
      outcome = await queueTestJob(job, config);
      noteActivity("testDone", issue.key, outcome);
      return;
    }
    const plan = issue.comments.find((c) => c.id === planId);
    if (!plan) throw new Error(`Plan comment ${planId} is gone.`);
    const output = await runClaudeTest(issue, plan, {
      localRepos: await localRepoPaths(config, await sprintRepos(config)),
      prBranches: await ticketPullRequests(issue.key, config),
      skill: config.test?.skill,
      model: config.test?.model,
      maxBudgetUsd: config.test?.maxBudgetUsd,
      lessons: await getLessons("test"),
      signal,
    });
    const next =
      output.verdict === "failed"
        ? "comentaria o relatório e te avisaria"
        : output.verdict === "blocked"
          ? `te avisaria: ${output.blockedBy ?? "sem motivo"}`
          : "comentaria o relatório e moveria para PO Validation";
    await recordAction({
      action: "tested",
      subject: issue.key,
      title: issue.summary,
      detail: `${VERDICT_PT[output.verdict]}, ${next}. ${output.evidence.length} prints em ${output.evidenceDir}\n${output.report}`,
      costUsd: output.costUsd,
      durationMs: output.durationMs ?? Date.now() - started,
      files: output.evidence
        .map((e) => path.relative(TESTS_DIR, e.file))
        .filter((f) => !f.startsWith("..") && !path.isAbsolute(f)),
    });
    noticeTestDone(config, issue, VERDICT_PT[output.verdict], next, output.report, {
      count: output.evidence.length,
      dir: output.evidenceDir,
    });
    outcome = output.verdict;
    noteActivity("testDone", issue.key, output.verdict);
  } catch (err) {
    // Switched off: the test stays queued for when it's back on, with no failure told.
    if (signal.aborted) {
      recordEvent("boardWatcher.stopped", { during: "test", key: issue.key });
      noteActivity("stopped", issue.key, "test");
      return;
    }
    outcome = err instanceof Error ? err.message : String(err);
    console.warn(`[board-watcher] Test of ${issue.key} failed:`, outcome);
    noteActivity("testFailed", issue.key, outcome);
    await recordAction({
      action: "test-failed",
      subject: issue.key,
      title: issue.summary,
      detail: outcome,
    });
    noticeJobFailed("test", issue.key, issue.summary, outcome, issueUrl(config, issue.key));
  } finally {
    endTest();
    if (!signal.aborted) await finishTestJob(issue.key, outcome, started);
  }
}

async function finishTestJob(key: string, outcome: string, started: number): Promise<void> {
  await serial(async () => {
    const state = await loadState();
    state.pendingTests = state.pendingTests.filter((t) => t.issue.key !== key);
    await saveState(state);
  });
  recordEvent("boardWatcher.test", { key, outcome, durationMs: Date.now() - started });
}

/** "Tests waiting for the network" goes out at most this often. */
const NETWORK_NOTICE_EVERY_MS = 2 * 60 * 60_000;
let lastNetworkNotice = 0;

function noticeNetworkBlocked(problem: string): void {
  if (Date.now() - lastNetworkNotice < NETWORK_NOTICE_EVERY_MS) return;
  lastNetworkNotice = Date.now();
  noticeTestsNeedNetwork(problem);
}

/** The same task's "waiting for you" isn't repeated within this window (statuses can flap). */
const WAITING_NOTICE_EVERY_MS = 30 * 60_000;
const lastWaitingNotice = new Map<string, number>();

/** Teams notices for the user's own sessions: one stopped to wait for them, or a queued task
 *  couldn't launch. Sent as the change happens, while the automation and instant notices are on. */
async function noticeStoreChange(change: StoreChange): Promise<void> {
  const config = await loadBoardWatcherConfig().catch(() => null);
  if (!config?.enabled || config.notifications?.instant === false) return;
  if (!(await automationsOn())) return;
  if (!isBusinessTime(new Date(), config.businessHours)) return;
  if (change.kind === "queue-error") {
    noticeQueueError(change.key, change.error);
    return;
  }
  if (change.to !== "waiting_user") return;
  const store = await getTaskStore();
  const session = change.sessionId ? store.sessions[change.sessionId] : undefined;
  const key = change.key ?? session?.taskKey ?? session?.test?.key ?? null;
  const name = session?.nickname ?? (key ? "" : (change.sessionId ?? ""));
  const id = key ?? change.sessionId ?? "";
  const last = lastWaitingNotice.get(id) ?? 0;
  if (Date.now() - last < WAITING_NOTICE_EVERY_MS) return;
  lastWaitingNotice.set(id, Date.now());
  const remoteUrl = await findRemoteSessionUrl(change.sessionId, key).catch(() => null);
  await noticeWaitingForYou(key, name, remoteUrl);
}

/** The beta switch (Settings): off stops the next look, kills a running review or test session
 *  and holds every notice; back on, a look runs right away. */
function onAutomationsSwitch(on: boolean): void {
  if (on) {
    rearmAutomations();
    noteActivity("switchOn");
    recordEvent("boardWatcher.switch", { on });
    void look();
    return;
  }
  stopAutomations();
  noteActivity("switchOff");
  if (timer) clearTimeout(timer);
  timer = null;
  nextLookAt = null;
  jobsBlockedBy = null;
  recordEvent("boardWatcher.switch", { on });
}

export function startBoardWatcher(): void {
  onPreferencesSaved((next, previous) => {
    const on = next.boardAutomations === true;
    if (on !== (previous.boardAutomations === true)) onAutomationsSwitch(on);
  });
  void automationsOn().then((on) => {
    if (!on) stopAutomations();
  });
  onStoreChange((change) => {
    void noticeStoreChange(change).catch((err: unknown) =>
      console.warn("[board-watcher] Couldn't send the notice:", err),
    );
  });
  // Files erased since the last run (a hard reset + clean of the clone) come back first.
  void restoreMissingWatcherFiles()
    .then((restored) => {
      if (restored.length === 0) return;
      const list = restored.map((r) => `${r.file} (${r.day})`).join(", ");
      console.warn(`[board-watcher] Restored from the backup: ${list}`);
      recordEvent("boardWatcher.restored", { files: restored.length });
      noticeLiveAction("Board watcher · arquivos restaurados do backup", list, null, "urgent");
    })
    .catch((err: unknown) => console.warn("[board-watcher] Couldn't restore the backup:", err))
    .finally(() => {
      void look();
      void remindNetworkAtStart();
    });
}

/** Tells the user on the desktop when the app starts (usually at login) without the network the
 *  tests need, instead of only once a test is held. */
async function remindNetworkAtStart(): Promise<void> {
  const config = await loadBoardWatcherConfig().catch(() => null);
  if (!config?.enabled || config.test?.enabled === false || !(await automationsOn())) return;
  if (!isBusinessTime(new Date(), config.businessHours)) return;
  const problem = await networkProblem(config.test?.requires);
  if (problem) remindOnDesktop(problem);
}

/** A look right now, instead of waiting for the next one. */
/** "Look now" (the Board); nothing outside business hours, like every other look. */
export async function runBoardWatcherNow(): Promise<BoardWatcherStatus> {
  await look();
  return getBoardWatcherStatus();
}

/** Stops every look until resumed (the app's "Pause" button). */
export async function pauseBoardWatcher(): Promise<BoardWatcherStatus> {
  await serial(async () => {
    const state = await loadState();
    state.pausedReason = "Paused from the app";
    await saveState(state);
  });
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

/** The review/test sessions run since local midnight, from the actions log. */
async function todaysSessions(
  config: BoardWatcherConfig | null,
): Promise<BoardWatcherStatus["today"]> {
  const now = new Date();
  const hours = config?.businessHours;
  const midnight = hours
    ? new Date(`${localDay(now, hours)}T00:00:00`)
    : new Date(now.toDateString());
  const sessions = (await readActions(midnight)).filter(
    (a) => a.action === "reviewed" || a.action === "tested",
  );
  return {
    reviews: sessions.filter((a) => a.action === "reviewed").length,
    tests: sessions.filter((a) => a.action === "tested").length,
    durationMs: sessions.reduce((sum, a) => sum + (a.durationMs ?? 0), 0),
    costUsd: sessions.reduce((sum, a) => sum + (a.costUsd ?? 0), 0),
  };
}

export async function getBoardWatcherStatus(): Promise<BoardWatcherStatus> {
  const config = lastConfig ?? (await loadBoardWatcherConfig().catch(() => null));
  const state = await loadState();
  const today = config ? localDay(new Date(), config.businessHours) : "";
  return {
    enabled: Boolean(config?.enabled),
    businessTime: config ? isBusinessTime(new Date(), config.businessHours) : true,
    nextBusinessStart:
      config && !isBusinessTime(new Date(), config.businessHours)
        ? (nextBusinessStart(new Date(), config.businessHours)?.toISOString() ?? null)
        : null,
    running,
    lastTickAt: state.lastTickAt,
    lastDigestAt: state.lastDigestAt,
    lastError: state.lastError,
    pausedReason: state.pausedReason,
    reviewing,
    pendingReviews: byPriority(state.pendingReviews, prSubject, state.priority).map(prSubject),
    pendingTests: byPriority(state.pendingTests, (t) => t.issue.key, state.priority).map(
      (t) => t.issue.key,
    ),
    priority: state.priority,
    nextLookAt: config?.enabled ? nextLookAt : null,
    approvalsToday: state.approvals.day === today ? state.approvals.count : 0,
    today: await todaysSessions(config),
    scoreboard: await getScoreboard(),
    jobsBlockedBy,
    calls: callStats(),
    testClaimsToday: state.testClaims.day === today ? state.testClaims.count : 0,
    lastDecisions: lastDecisions.map((d) => decisionView(d, config)),
    titles: Object.fromEntries([
      ...lastTitles,
      ...state.pendingReviews.map((p) => [prSubject(p), p.title] as const),
      ...state.pendingTests.map((t) => [t.issue.key, t.issue.summary] as const),
    ]),
    linkBases: {
      jira: config?.jira ? `https://${config.jira.site}/browse/` : null,
      bitbucket: config?.bitbucket ? `https://bitbucket.org/${config.bitbucket.workspace}/` : null,
    },
  };
}

/** The branches of a ticket's PRs that can go to homolog (in the repos set up for it). */
export async function homologCandidates(key: string): Promise<HomologCandidate[]> {
  const config = await loadBoardWatcherConfig();
  if (!config?.bitbucket || !config.homolog?.repos.length) {
    throw new ConflictError("HOMOLOG_NOT_CONFIGURED", "boardWatcher.json has no homolog repos.");
  }
  const prs = await findPullRequestsForKey(
    bitbucketCredentialsFromEnv(config.bitbucket.workspace),
    config.homolog.repos,
    key,
  );
  return [...new Map(prs.map((pr) => [`${pr.repo} ${pr.branch}`, pr])).values()];
}

/** Replays the branch's latest build with the Jenkinsfile pointed at homolog; the new build is
 *  followed and its end told in Teams. Only on the user's say-so (a confirmed button). */
export async function pointToHomolog(repo: string, branch: string): Promise<{ buildUrl: string }> {
  const config = await loadBoardWatcherConfig();
  if (!config?.bitbucket || !config.homolog?.repos.includes(repo)) {
    throw new BadRequestError("HOMOLOG_REPO", `${repo} isn't set up for homolog.`);
  }
  const build = await branchBuild(
    bitbucketCredentialsFromEnv(config.bitbucket.workspace),
    repo,
    branch,
  );
  if (!build?.url) {
    throw new ConflictError("HOMOLOG_NO_BUILD", `${branch} has no build in Jenkins yet.`);
  }
  let buildUrl: string;
  try {
    buildUrl = await replayToHomolog(build.url);
  } catch (err) {
    if (err instanceof HomologPatchError) {
      throw new ConflictError("HOMOLOG_PATCH", `The Jenkinsfile changed: ${err.message}`);
    }
    throw err;
  }
  const subject = /[A-Z][A-Z0-9]+-\d+/.exec(branch)?.[0] ?? branch;
  await recordAction({
    action: "homolog",
    subject,
    title: `${repo} ${branch}`,
    detail: buildUrl,
  });
  recordEvent("boardWatcher.homolog", { repo, branch });
  void followHomologBuild(config, repo, branch, buildUrl);
  return { buildUrl };
}

const HOMOLOG_POLL_MS = 60_000;
const HOMOLOG_MAX_POLLS = 90;

async function followHomologBuild(
  config: BoardWatcherConfig,
  repo: string,
  branch: string,
  buildUrl: string,
): Promise<void> {
  for (let i = 0; i < HOMOLOG_MAX_POLLS; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, HOMOLOG_POLL_MS));
    if (automationsStopped()) return;
    const result = await buildResult(buildUrl).catch(() => null);
    if (!result) continue;
    const diagnosis =
      result === "SUCCESS"
        ? null
        : await diagnoseBuild(`${buildUrl}display/redirect`).catch(() => null);
    noticeHomologDone(
      repo,
      branch,
      buildUrl,
      result,
      config.homolog?.urls?.[repo] ?? [],
      diagnosis,
    );
    return;
  }
}

/** The daily summary now, for the Board (nothing is sent). */
export async function previewDaily(): Promise<DailyPreview> {
  const config = await loadBoardWatcherConfig();
  if (!config?.jira || !config.bitbucket) {
    throw new ConflictError("BOARD_WATCHER_NOT_CONFIGURED", "The watcher isn't set up.");
  }
  const facts = await gatherDailyFacts(config, new Date());
  const parts = sections(facts);
  return { dayLabel: facts.dayLabel, ...parts, text: await draftDailyText(facts) };
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
  await postTeamsCard(webhook, buildActionsDigest(await readActions(since), config, since));
}
