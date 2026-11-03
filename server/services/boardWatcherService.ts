import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BoardWatcherStatus } from "../../shared/boardWatcher.js";
import { recordEvent } from "../utils/history.js";
import { getTaskStore, onStoreChange, type StoreChange } from "../utils/taskStore.js";
import { getUserPreferences } from "./preferencesService.js";
import { getMaxUsagePercent } from "./usageService.js";
import { findRemoteSessionUrl } from "./session/remoteUrl.js";
import { REPO_ROOT } from "../utils/repoRoot.js";
import { isBusinessTime, localDay, nextBusinessStart } from "./boardWatcher/businessTime.js";
import { loadBoardWatcherConfig, type BoardWatcherConfig } from "./boardWatcher/config.js";
import type { Decision } from "./boardWatcher/decide.js";
import { buildActionsDigest } from "./boardWatcher/digest.js";
import { getLessons, getScoreboard } from "./boardWatcher/feedback.js";
import {
  bitbucketCredentialsFromEnv,
  branchBuild,
  findPullRequestsForKey,
  listOpenPullRequests,
  pullRequestHead,
  pullRequestNews,
  sameCommit,
} from "./boardWatcher/bitbucket.js";
import { runClaudeReview } from "./boardWatcher/claudeReviewer.js";
import {
  commentsUpToPlan,
  findTestRepos,
  runClaudeTest,
  TESTS_DIR,
  type TestOutput,
} from "./boardWatcher/claudeTester.js";
import { createBoardDeps, readActions, recordAction } from "./boardWatcher/simulation.js";
import { draftPoQuestions } from "./boardWatcher/poQuestions.js";
import { postTeamsCard, reasonPtBr } from "./boardWatcher/teamsCards.js";
import {
  issueUrl,
  noticeJobFailed,
  noticeQueueError,
  noticeWaitingForYou,
  noticeTestsNeedNetwork,
  noticeWeakDescription,
  noticeReviewBlocked,
  noticeNewsOnMyPr,
  noticePreviewFailed,
  noticeTestDone,
  noticeUnwatchedPullRequests,
  noticeWatcherError,
  prUrl,
} from "./boardWatcher/instantNotices.js";
import { rotateActions } from "./boardWatcher/history.js";
import { LIVE_KEYS } from "./boardWatcher/settings.js";
import { networkProblem, remindOnDesktop } from "./boardWatcher/network.js";
import { isTestReport, testPlanStatus } from "./boardWatcher/testPlan.js";
import { applyReview, runTick } from "./boardWatcher/tick.js";
import { addTestEntryIfAbsent, requeueTestEntry } from "./taskQueueService.js";
import {
  emptyWatcherState,
  prSubject,
  type BoardIssue,
  type PullRequest,
  type WatcherState,
} from "./boardWatcher/types.js";
import { jiraCredentialsFromEnv, linkedPullRequests } from "./boardWatcher/jira.js";

/**
 * Runs the board watcher inside the server: a look at the board every 10 minutes in business
 * hours (60 outside), the digest to Teams at the start and end of the day, and an alert when a
 * look fails. Off unless `boardWatcher.json` has `"enabled": true`. Each write (queue a task, move
 * a card, comment, approve) is only recorded unless its switch in `live` is on
 * (`boardWatcher/simulation.ts`). With `review.enabled`, PRs due for review get a real review
 * session (`claudeReviewer.ts`), one at a time after the look, whose findings go through the
 * same rules. State between looks lives in the gitignored
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

let timer: NodeJS.Timeout | null = null;
let nextLookAt: string | null = null;
let running = false;
let lastDecisions: Decision[] = [];
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
  const entries = await readActions(since);
  // Nothing happened since the last one: no card (the next one still covers from `since`).
  if (entries.length === 0) return;
  await postTeamsCard(webhook, buildActionsDigest(entries, config, since));
  state.lastDigestAt = now.toISOString();
  recordEvent("boardWatcher.digest", { entries: entries.length });
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
  try {
    if (!config?.enabled) return;
    const onReview = config.review?.enabled
      ? (pr: WatcherState["pendingReviews"][number]) => {
          if (!state.pendingReviews.some((p) => prSubject(p) === prSubject(pr))) {
            state.pendingReviews.push(pr);
          }
        }
      : undefined;
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
    const deps = createBoardDeps(
      config,
      () => new Date(),
      onReview,
      onTest,
      (issue, missing) => void sendWeakDescriptionQuestions(config, issue, missing),
    );
    let issues: BoardIssue[] = [];
    let prs: PullRequest[] = [];
    const { board, codeHost } = deps;
    deps.board = { ...board, listIssues: async () => (issues = await board.listIssues()) };
    deps.codeHost = {
      ...codeHost,
      listPullRequests: async () => (prs = await codeHost.listPullRequests()),
    };
    lastDecisions = await runTick(deps, state, config, now);
    await warnUnwatchedPullRequests(config, issues, state);
    await noticeNewsOnMyPullRequests(config, prs, state, now);
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
    alertError(state, message, now);
  } finally {
    if (config?.enabled) await saveState(state);
    running = false;
    schedule(config);
  }
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
    if (!since) continue;
    try {
      const news = await pullRequestNews(credentials, pr, since, config.me);
      if (news.comments.length === 0 && news.changesRequested.length === 0) continue;
      noticeNewsOnMyPr(config, pr, news);
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

/** Once per arrival in Code Review, tells the user about the ticket's PRs (open or merged) in
 *  repos missing from `bitbucket.repos`, which no review looks at. Not for the user's own
 *  tickets. Best-effort. */
async function warnUnwatchedPullRequests(
  config: BoardWatcherConfig,
  issues: BoardIssue[],
  state: WatcherState,
): Promise<void> {
  if (!config.jira || !config.bitbucket) return;
  const credentials = jiraCredentialsFromEnv(config.jira.site);
  const watched = new Set(config.bitbucket.repos);
  const arrived = issues.filter(
    (i) =>
      config.columns.codeReview?.includes(i.statusId) &&
      i.assigneeId !== config.me &&
      state.handled[`unwatched:${i.key}`] !== i.statusSince,
  );
  for (const issue of arrived) {
    try {
      const prs = (await linkedPullRequests(credentials, issue.key)).filter(
        (pr) => pr.status !== "DECLINED" && !watched.has(pr.repo.split("/").at(-1) ?? ""),
      );
      state.handled[`unwatched:${issue.key}`] = issue.statusSince;
      if (prs.length === 0) continue;
      noticeUnwatchedPullRequests(config, issue.key, issue.summary, prs);
      recordEvent("boardWatcher.unwatchedPrs", { key: issue.key, prs: prs.length });
    } catch (err) {
      console.warn(`[board-watcher] Couldn't list the PRs of ${issue.key}:`, err);
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
  // Off hours, the first look of the day is right when business hours start.
  const start = config && !businessTime ? nextBusinessStart(now, config.businessHours) : null;
  const delay = businessTime
    ? BUSINESS_INTERVAL_MS
    : Math.min(OFF_HOURS_INTERVAL_MS, start ? start.getTime() - now.getTime() : Infinity);
  nextLookAt = new Date(Date.now() + delay).toISOString();
  timer = setTimeout(() => void look(), delay);
}

/** Runs the pending review and test sessions one at a time (reviews first: they're quick). A
 *  review's result goes through `applyReview`, so it's posted or only recorded per `live`; a
 *  test's verdict and report are recorded with what would be done with them. */
async function drainJobs(): Promise<void> {
  if (reviewing) return;
  reviewing = true;
  try {
    for (;;) {
      const config = await loadBoardWatcherConfig().catch(() => null);
      const state = await loadState();
      if (!config?.enabled || !config.bitbucket) return;
      // A review ends in a comment or an approval, which only happen in business hours: the
      // session waits for them (queued reviews start with the next look then).
      const pr =
        config.review?.enabled && isBusinessTime(new Date(), config.businessHours)
          ? state.pendingReviews[0]
          : undefined;
      const test = config.test?.enabled !== false ? state.pendingTests[0] : undefined;
      // A headless test or a review is a Claude session of its own: same plan limit as the queue.
      const headlessTest = test && config.test?.runner === "headless";
      if (pr || headlessTest) {
        const { maxUsagePercent } = (await getUserPreferences()).orchestrator;
        const usage = await getMaxUsagePercent(true);
        if (usage !== null && usage >= maxUsagePercent) {
          jobsBlockedBy = `plan usage at ${usage}% (limit ${maxUsagePercent}%)`;
          return;
        }
      }
      jobsBlockedBy = null;
      if (!pr) {
        if (!test) return;
        const network = await networkProblem(config.test?.requires);
        if (network) {
          jobsBlockedBy = `tests waiting: ${network}`;
          noticeNetworkBlocked(network);
          return;
        }
        // A test against a preview still building (or whose build failed) would check old code:
        // the first one whose previews are ready goes, the others wait their turn.
        const waits: string[] = [];
        let ready: typeof test | undefined;
        for (const candidate of state.pendingTests) {
          const wait = await previewWait(candidate.issue, config);
          if (!wait) {
            ready = candidate;
            break;
          }
          waits.push(`${candidate.issue.key} ${wait}`);
        }
        if (!ready) {
          jobsBlockedBy = `tests waiting: ${waits.join("; ")}`;
          return;
        }
        await runTestJob(ready, config);
        continue;
      }
      const subject = prSubject(pr);
      const started = Date.now();
      let outcome: string;
      try {
        const repoPath = config.bitbucket.localRepos?.[pr.repo];
        if (!repoPath) throw new Error(`No local clone of ${pr.repo} in bitbucket.localRepos.`);
        const credentials = bitbucketCredentialsFromEnv(config.bitbucket.workspace);
        // Merged, closed or pushed to while it waited: no session for it. A new push is queued
        // again by the next look, with the new commit.
        const head = await pullRequestHead(credentials, pr);
        if (head.state !== "OPEN" || !sameCommit(pr.sourceHash, head.hash)) {
          await serial(async () => {
            const state = await loadState();
            state.pendingReviews = state.pendingReviews.filter((p) => prSubject(p) !== subject);
            await saveState(state);
          });
          recordEvent("boardWatcher.reviewSkipped", {
            subject,
            reason: head.state !== "OPEN" ? head.state : "new push",
          });
          continue;
        }
        const openPrs = await listOpenPullRequests(credentials, [pr.repo]);
        const output = await runClaudeReview(pr, {
          repoPath,
          jiraSite: config.jira?.site,
          openPrs,
          model: config.review?.model,
          smallModel: config.review?.smallModel,
          smallPr: config.review?.smallPr,
          maxBudgetUsd: config.review?.maxBudgetUsd,
          lessons: await getLessons("review"),
          previous: pr.approvedCommit
            ? {
                hash: pr.approvedCommit,
                findings: state.reviewedCommits?.[subject]?.findings ?? [],
              }
            : state.reviewedCommits?.[subject],
        });
        await serial(async () => {
          const state = await loadState();
          state.pendingReviews = state.pendingReviews.filter((p) => prSubject(p) !== subject);
          await recordAction({
            action: "reviewed",
            subject,
            title: pr.title,
            detail: `${output.summary} · Bate com a LED: ${output.ticketMatch} · Confiança: ${output.confidence} · Modelo: ${output.model} (${output.size.files} arquivos, ${output.size.lines} linhas)`,
            costUsd: output.costUsd,
            durationMs: output.durationMs ?? Date.now() - started,
          });
          await applyReview(
            pr,
            output,
            createBoardDeps(config, () => new Date()),
            state,
            config,
          );
          if (pr.sourceHash) {
            const raised = output.findings
              .filter((f) => f.severity !== "minor" && f.topic !== "product")
              .map((f) => `${f.file ? `${f.file}${f.line ? `:${f.line}` : ""}: ` : ""}${f.body}`);
            const earlier = state.reviewedCommits[subject]?.findings ?? [];
            state.reviewedCommits[subject] = {
              hash: pr.sourceHash,
              findings: [...earlier, ...raised].slice(-20),
            };
          }
          await saveState(state);
        });
        if (output.findings.some((f) => f.severity === "blocking" && f.topic !== "product")) {
          noticeReviewBlocked(config, pr, output.summary, output.findings);
        }
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
        noticeJobFailed("review", subject, pr.title, outcome, prUrl(config, pr));
      }
      recordEvent("boardWatcher.review", { subject, outcome, durationMs: Date.now() - started });
    }
  } finally {
    reviewing = false;
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
    config.bitbucket.repos,
    key,
  ).catch((err: unknown) => {
    console.warn(`[board-watcher] Couldn't look up ${key}'s PRs:`, err);
    return [];
  });
}

/** A preview build younger than this without any status yet is taken as not started. */
const BUILD_START_GRACE_MS = 45 * 60_000;
/** Failed builds already told about, by commit, so each is said once. */
const failedBuildsNoticed = new Set<string>();

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
    if (build.ci === "failed") {
      if (!failedBuildsNoticed.has(build.hash)) {
        failedBuildsNoticed.add(build.hash);
        noticePreviewFailed(config, issue, repo, branch);
      }
      return `preview build failed (${repo} ${branch})`;
    }
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
    config.bitbucket?.localRepos ?? {},
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
): Promise<void> {
  const { issue, planId } = job;
  const started = Date.now();
  let outcome = "";
  try {
    if ((config.test?.runner ?? "queue") === "queue") {
      outcome = await queueTestJob(job, config);
      return;
    }
    const plan = issue.comments.find((c) => c.id === planId);
    if (!plan) throw new Error(`Plan comment ${planId} is gone.`);
    const output = await runClaudeTest(issue, plan, {
      localRepos: config.bitbucket?.localRepos ?? {},
      prBranches: await ticketPullRequests(issue.key, config),
      skill: config.test?.skill,
      model: config.test?.model,
      maxBudgetUsd: config.test?.maxBudgetUsd,
      lessons: await getLessons("test"),
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
  } catch (err) {
    outcome = err instanceof Error ? err.message : String(err);
    console.warn(`[board-watcher] Test of ${issue.key} failed:`, outcome);
    await recordAction({
      action: "test-failed",
      subject: issue.key,
      title: issue.summary,
      detail: outcome,
    });
    noticeJobFailed("test", issue.key, issue.summary, outcome, issueUrl(config, issue.key));
  } finally {
    await serial(async () => {
      const state = await loadState();
      state.pendingTests = state.pendingTests.filter((t) => t.issue.key !== issue.key);
      await saveState(state);
    });
    recordEvent("boardWatcher.test", { key: issue.key, outcome, durationMs: Date.now() - started });
  }
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

export function startBoardWatcher(): void {
  onStoreChange((change) => {
    void noticeStoreChange(change).catch((err: unknown) =>
      console.warn("[board-watcher] Couldn't send the notice:", err),
    );
  });
  void look();
  void remindNetworkAtStart();
}

/** Tells the user on the desktop when the app starts (usually at login) without the network the
 *  tests need, instead of only once a test is held. */
async function remindNetworkAtStart(): Promise<void> {
  const config = await loadBoardWatcherConfig().catch(() => null);
  if (!config?.enabled || config.test?.enabled === false) return;
  const problem = await networkProblem(config.test?.requires);
  if (problem) remindOnDesktop(problem);
}

/** A look right now, instead of waiting for the next one. */
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
    mode: config?.mode ?? null,
    businessTime: config ? isBusinessTime(new Date(), config.businessHours) : true,
    nextBusinessStart:
      config && !isBusinessTime(new Date(), config.businessHours)
        ? (nextBusinessStart(new Date(), config.businessHours)?.toISOString() ?? null)
        : null,
    live: config?.live ? LIVE_KEYS.filter((k) => config.live?.[k]) : [],
    running,
    lastTickAt: state.lastTickAt,
    lastDigestAt: state.lastDigestAt,
    lastError: state.lastError,
    pausedReason: state.pausedReason,
    reviewing,
    pendingReviews: state.pendingReviews.map(prSubject),
    pendingTests: state.pendingTests.map((t) => t.issue.key),
    nextLookAt: config?.enabled ? nextLookAt : null,
    approvalsToday: state.approvals.day === today ? state.approvals.count : 0,
    today: await todaysSessions(config),
    scoreboard: await getScoreboard(),
    jobsBlockedBy,
    testClaimsToday: state.testClaims.day === today ? state.testClaims.count : 0,
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
  await postTeamsCard(webhook, buildActionsDigest(await readActions(since), config, since));
}
