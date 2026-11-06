import { businessMinutesBetween, isBusinessTime, localDay } from "./businessTime.js";
import type { DecisionContext, WatcherWork } from "../../../shared/boardWatcher.js";
import type { BoardWatcherConfig } from "./config.js";
import { gradeDescription } from "./descriptionGate.js";
import {
  isFailedTestReport,
  isTestReport,
  testabilityProblem,
  testPlanStatus,
} from "./testPlan.js";
import {
  byPriority,
  prSubject,
  type BoardIssue,
  type PullRequest,
  type WatcherState,
} from "./types.js";

/**
 * Pure decisions for one look at the board: what to queue, claim or review, and why the rest is
 * skipped or waiting. No I/O here; `tick.ts` carries them out. Issues the user has no part in
 * (unassigned, someone else's) and PRs off the board get no decision at all. Every PR of someone
 * else is the user's to review, whoever is listed as a reviewer.
 */

export type DecisionAction =
  | "enqueue-dev"
  | "weak-description"
  | "claim-test"
  | "retest"
  | "start-progress"
  | "review"
  | "skip"
  | "wait";

export type Decision = {
  subject: string;
  action: DecisionAction;
  reason: string;
  work?: WatcherWork;
  /** What the action is about, kept in `state.handled`: the test plan comment id, the
   *  description fingerprint. */
  ref?: string;
  context?: DecisionContext;
  /** A wait the user can skip with "Start now" (`state.forced`). */
  canStart?: boolean;
  /** The build that failed, for a "CI failed". */
  failedBuild?: { url: string; name: string };
};

const BY_HAND = "started by hand";

/** A wait the user can skip with "Start now". */
function startable(subject: string, reason: string): Decision {
  return { subject, action: "wait", reason, canStart: true };
}

export function decideIssues(
  issues: BoardIssue[],
  state: WatcherState,
  config: BoardWatcherConfig,
  now: Date,
): Decision[] {
  const decisions: Decision[] = [];
  // A claimed test holds its slot until the ticket leaves Wait Test/Testing (e.g. to PO
  // Validation): it may never reach Testing when the claim doesn't move it on the board.
  const stillTesting = new Set(
    issues
      .filter(
        (i) =>
          config.columns.testing.includes(i.statusId) ||
          config.columns.waitTest.includes(i.statusId),
      )
      .map((i) => i.key),
  );
  let claimed = state.claimedTests.filter((key) => stillTesting.has(key)).length;
  const businessTime = isBusinessTime(now, config.businessHours);
  const waitingTests: BoardIssue[] = [];
  // My tasks it queued whose ticket is still being developed hold the dev slots.
  const developing = new Set([...config.columns.todo, ...(config.columns.inProgress ?? [])]);
  const forced = new Set(state.forced);
  let devTasks = issues.filter(
    (i) =>
      i.assigneeId === config.me &&
      developing.has(i.statusId) &&
      state.handled[`dev:${i.key}`] !== undefined,
  ).length;

  // Board order (Jira rank), with the ones the user prioritized on the Board first.
  for (const issue of byPriority(issues, (i) => i.key, state.priority)) {
    const subject = issue.key;
    if (config.columns.todo.includes(issue.statusId)) {
      if (config.todo?.enabled === false) continue;
      if (issue.assigneeId !== config.me) continue;
      if (state.handled[`dev:${subject}`] !== undefined) continue;
      const verdict = gradeDescription(issue, config.descriptionMinScore);
      if (!verdict.passed) {
        decisions.push({
          subject,
          action: "weak-description",
          reason: `description scored ${verdict.score}/5: ${verdict.missing.join(", ")}`,
          ref: fingerprint(issue.description),
        });
      } else if (!forced.has(subject) && !businessTime) {
        decisions.push(startable(subject, "outside business hours"));
      } else if (!forced.has(subject) && devTasks >= config.maxDevTasks) {
        decisions.push(startable(subject, `${devTasks} of my tasks already in development`));
      } else {
        devTasks += 1;
        decisions.push({
          subject,
          action: "enqueue-dev",
          reason: forced.has(subject) ? BY_HAND : `description scored ${verdict.score}/5`,
        });
      }
      continue;
    }

    if (
      config.columns.waitTest.includes(issue.statusId) &&
      config.test?.enabled !== false &&
      config.testingStatusId
    ) {
      waitingTests.push(issue);
    }
  }

  // Everything so far is about developing the user's To Do tasks; the rest, about testing.
  const devDecisions = decisions.length;
  // Oldest in Wait Test first; the ones people pick up quickly stay with them (grace period).
  waitingTests.sort((a, b) => Date.parse(a.statusSince) - Date.parse(b.statusSince));
  const testsInOrder = byPriority(waitingTests, (i) => i.key, state.priority);
  const today = localDay(now, config.businessHours);
  let claimedToday = state.testClaims.day === today ? state.testClaims.count : 0;
  for (const issue of testsInOrder) {
    const subject = issue.key;
    if (issue.assigneeId === config.me) {
      decisions.push({ subject, action: "skip", reason: "the user developed it" });
      continue;
    }
    const plan = testPlanStatus(issue.comments);
    if (plan.state === "none") {
      decisions.push({ subject, action: "skip", reason: "no test plan in the comments" });
      continue;
    }
    if (plan.state === "tested") {
      decisions.push({ subject, action: "skip", reason: "already tested since the last plan" });
      continue;
    }
    if (state.handled[`test:${subject}`] === plan.plan.id) continue;
    const problem = testabilityProblem(issue, plan.plan);
    if (problem) {
      decisions.push({ subject, action: "skip", reason: `left for a person: ${problem}` });
      continue;
    }
    const wait = forced.has(subject) ? null : testWait(issue, now, config, claimed, claimedToday);
    if (wait) {
      decisions.push(startable(subject, wait));
      continue;
    }
    claimed += 1;
    claimedToday += 1;
    decisions.push({
      subject,
      action: "claim-test",
      reason: forced.has(subject) ? BY_HAND : `test plan in comment ${plan.plan.id}`,
      ref: plan.plan.id,
    });
  }
  return decisions.map((d, index) => ({
    ...d,
    work: index < devDecisions ? "dev" : "test",
  }));
}

/** Why a Wait Test ticket isn't claimed yet, or null when it can be. */
function testWait(
  issue: BoardIssue,
  now: Date,
  config: BoardWatcherConfig,
  claimed: number,
  claimedToday: number,
): string | null {
  if (!isBusinessTime(now, config.businessHours)) return "outside business hours";
  const waited = businessMinutesBetween(
    new Date(issue.statusSince),
    now,
    config.businessHours,
    config.waitTestGraceMinutes,
  );
  if (waited < config.waitTestGraceMinutes) {
    return `leaving it to people first (${waited} of ${config.waitTestGraceMinutes} business minutes)`;
  }
  if (claimed >= config.maxClaimedTests) return `${claimed} tests already claimed`;
  if (claimedToday >= config.maxClaimsPerDay) return `${claimedToday} tests claimed today`;
  return null;
}

/**
 * A ticket stays in Testing while its PR gets fixed: when the user's latest test report on it
 * failed and one of its PRs got a push after that report, it's tested again (once per push), in
 * business hours and within the daily claim limit.
 */
export function decideRetests(
  issues: BoardIssue[],
  prs: PullRequest[],
  state: WatcherState,
  config: BoardWatcherConfig,
  now: Date,
  /** Claims already decided in this look (`decideIssues`), which count toward the daily limit. */
  claimedThisLook = 0,
): Decision[] {
  if (config.test?.enabled === false) return [];
  const decisions: Decision[] = [];
  const businessTime = isBusinessTime(now, config.businessHours);
  const today = localDay(now, config.businessHours);
  let claimedToday =
    (state.testClaims.day === today ? state.testClaims.count : 0) + claimedThisLook;
  for (const issue of issues) {
    if (!config.columns.testing.includes(issue.statusId)) continue;
    const report = issue.comments
      .filter((c) => isTestReport(c.body))
      .sort((a, b) => Date.parse(a.created) - Date.parse(b.created))
      .at(-1);
    if (report?.authorId !== config.me || !isFailedTestReport(report.body)) continue;
    const fixPush = prs
      .filter((pr) => ticketKeysOf(pr).includes(issue.key))
      .map((pr) => pr.lastPushAt)
      .filter((at) => Date.parse(at) > Date.parse(report.created))
      .sort()
      .at(-1);
    const subject = issue.key;
    if (!fixPush) {
      decisions.push({ subject, action: "wait", reason: "test failed; waiting for a fix push" });
      continue;
    }
    if (state.handled[`retest:${subject}`] === fixPush) continue;
    const byHand = state.forced.includes(subject);
    if (!byHand && !businessTime) {
      decisions.push(startable(subject, "outside business hours"));
      continue;
    }
    if (!byHand && claimedToday >= config.maxClaimsPerDay) {
      decisions.push(startable(subject, `${claimedToday} tests claimed today`));
      continue;
    }
    claimedToday += 1;
    decisions.push({
      subject,
      action: "retest",
      reason: byHand ? BY_HAND : `fix pushed after the failed test (${report.id})`,
      ref: fixPush,
    });
  }
  return decisions;
}

/**
 * Only one of the user's tasks is In Progress on the board at a time, for the board's sake: more
 * can be worked on (their sessions started), but they stay in To Do. When none of the user's is
 * In Progress, the first started task still in To Do is moved there, in business hours.
 */
export function decideProgress(
  issues: BoardIssue[],
  startedDevKeys: string[],
  config: BoardWatcherConfig,
  now: Date,
  /** Started by hand: moved even with another task In Progress or outside business hours. */
  forced: string[] = [],
): Decision[] {
  const inProgress = config.columns.inProgress;
  // Part of the dev queue: off with it.
  if (config.todo?.enabled === false) return [];
  if (!config.inProgressStatusId || !inProgress?.length) return [];
  const mine = issues.filter((i) => i.assigneeId === config.me);
  const current = mine.find((i) => inProgress.includes(i.statusId));
  const byKey = new Map(mine.map((i) => [i.key, i]));
  const next = startedDevKeys
    .map((key) => byKey.get(key))
    .find((i) => i && config.columns.todo.includes(i.statusId));
  if (!next) return [];
  const byHand = forced.includes(next.key);
  if (!byHand && current) return [startable(next.key, `${current.key} is In Progress`)];
  if (!byHand && !isBusinessTime(now, config.businessHours)) {
    return [startable(next.key, "outside business hours")];
  }
  return [
    {
      subject: next.key,
      action: "start-progress",
      reason: byHand ? BY_HAND : "started, and none of yours is In Progress",
    },
  ];
}

const TICKET_KEYS = /\b[A-Z][A-Z0-9]+-\d+\b/g;

/** Tickets named in the PR's title or branch (a PR may bundle more than one). */
function ticketKeysOf(pr: PullRequest): string[] {
  return [...new Set(`${pr.title} ${pr.sourceBranch ?? ""}`.match(TICKET_KEYS) ?? [])];
}

/**
 * Each PR of someone else gets one AI review, for the whole team: the first automation to review
 * it posts a comment that marks it (`hasAiReview`, checked by the tick before queueing), and new
 * pushes aren't reviewed again. With `columns.codeReview` set, a PR is only reviewed once one of
 * its tickets is in that column (people open PRs while still working); it's reviewed right
 * away then, ahead of the human review.
 */
export function decidePullRequests(
  prs: PullRequest[],
  state: WatcherState,
  config: BoardWatcherConfig,
  now: Date,
  issues: BoardIssue[] = [],
): Decision[] {
  const decisions: Decision[] = [];
  if (config.codeReview?.enabled === false) return decisions;
  const businessTime = isBusinessTime(now, config.businessHours);
  const codeReviewColumn = config.columns.codeReview;
  const inCodeReview = new Set(
    issues.filter((i) => codeReviewColumn?.includes(i.statusId)).map((i) => i.key),
  );
  // Opt-in: a ticket past Code Review whose PR nobody approved goes to review before it merges.
  const deploying = new Set(
    config.codeReview?.unapprovedDeploying
      ? issues.filter((i) => config.columns.deploying?.includes(i.statusId)).map((i) => i.key)
      : [],
  );
  const beforeCodeReview = new Set(
    issues
      .filter(
        (i) =>
          config.columns.todo.includes(i.statusId) ||
          config.columns.inProgress?.includes(i.statusId),
      )
      .map((i) => i.key),
  );
  const queued = new Set(state.pendingReviews.map(prSubject));

  for (const pr of prs) {
    const subject = prSubject(pr);
    if (pr.authorId === config.me) continue;
    // Reviewed by AI already (here or, per its comment, by a teammate's automation): done.
    if (state.handled[`ai-reviewed:${subject}`] !== undefined) continue;
    if (pr.reviewers.some((r) => r.id === config.me && r.state === "approved")) continue;
    // Queued, or its session failed on this push: a new push tries again.
    if (queued.has(subject) || state.handled[`review:${subject}`] === pr.lastPushAt) continue;

    const keys = ticketKeysOf(pr);
    const unapprovedDeploying =
      !pr.reviewers.some((r) => r.state === "approved") && keys.some((key) => deploying.has(key));
    const pastCodeReview = unapprovedDeploying && !keys.some((key) => inCodeReview.has(key));
    const extra: Partial<Decision> = pastCodeReview
      ? { context: { kind: "unapproved-deploying", keys, lastPushAt: pr.lastPushAt } }
      : {};
    const skip = (reason: string, more: Partial<Decision> = {}) =>
      decisions.push({ subject, action: "skip", reason, ...extra, ...more });
    const byHand = state.forced.includes(subject);
    // Started by hand: what it waits for is skipped (a skip, e.g. a draft, still holds).
    const wait = (reason: string) =>
      byHand
        ? decisions.push({ subject, action: "review", reason: BY_HAND, ...extra })
        : decisions.push({ subject, action: "wait", reason, canStart: true, ...extra });
    const reachedCodeReview = keys.some((key) => inCodeReview.has(key)) || unapprovedDeploying;
    // No ticket in the title or branch = off the board: not the user's to review, not listed.
    if (codeReviewColumn && keys.length === 0) continue;
    if (codeReviewColumn && !reachedCodeReview) {
      // Past Code Review (tested, deploying: the PR merges at the deploy) or off the board: not
      // the user's to review, so not listed either.
      if (keys.some((key) => beforeCodeReview.has(key))) {
        wait(`ticket ${keys.join(", ")} isn't in Code Review yet`);
      }
    } else if (pr.draft) skip("draft");
    else if (pr.hasConflicts) skip("has conflicts");
    else if (pr.ci === "failed")
      skip("CI failed", pr.failedBuild ? { failedBuild: pr.failedBuild } : {});
    else if (pr.reviewers.some((r) => r.id !== config.me && r.state === "changes_requested")) {
      skip("another reviewer requested changes");
    } else if (pr.ci === "running") wait("CI running");
    else if (!businessTime) wait("outside business hours");
    else {
      decisions.push({
        subject,
        action: "review",
        ...extra,
        reason: pastCodeReview ? "past Code Review without any approval" : "ready for review",
      });
    }
  }
  return decisions;
}

/** Short, stable id of a text, to tell whether it changed since it was last reported. */
function fingerprint(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(36);
}
