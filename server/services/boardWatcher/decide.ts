import { businessMinutesBetween, isBusinessTime, localDay } from "./businessTime.js";
import type { BoardWatcherConfig } from "./config.js";
import { gradeDescription } from "./descriptionGate.js";
import {
  isFailedTestReport,
  isTestReport,
  testabilityProblem,
  testPlanStatus,
} from "./testPlan.js";
import { prSubject, type BoardIssue, type PullRequest, type WatcherState } from "./types.js";

/**
 * Pure decisions for one look at the board: what to queue, claim or review, and why the rest is
 * skipped or waiting. No I/O here; `tick.ts` carries them out. Issues and PRs the user has no
 * part in (unassigned, someone else's, not a reviewer) get no decision at all.
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
  /** What the action is about, kept in `state.handled`: the test plan comment id, the
   *  description fingerprint. */
  ref?: string;
};

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

  for (const issue of issues) {
    const subject = issue.key;
    if (config.columns.todo.includes(issue.statusId)) {
      if (config.todo?.enabled === false) continue;
      if (issue.assigneeId !== config.me || state.handled[`dev:${subject}`]) continue;
      const verdict = gradeDescription(issue, config.descriptionMinScore);
      decisions.push(
        verdict.passed
          ? { subject, action: "enqueue-dev", reason: `description scored ${verdict.score}/5` }
          : {
              subject,
              action: "weak-description",
              reason: `description scored ${verdict.score}/5: ${verdict.missing.join(", ")}`,
              ref: fingerprint(issue.description),
            },
      );
      continue;
    }

    if (config.columns.waitTest.includes(issue.statusId) && config.test?.enabled !== false) {
      waitingTests.push(issue);
    }
  }

  // Oldest in Wait Test first; the ones people pick up quickly stay with them (grace period).
  waitingTests.sort((a, b) => Date.parse(a.statusSince) - Date.parse(b.statusSince));
  const today = localDay(now, config.businessHours);
  let claimedToday = state.testClaims.day === today ? state.testClaims.count : 0;
  for (const issue of waitingTests) {
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
    if (!businessTime) {
      decisions.push({ subject, action: "wait", reason: "outside business hours" });
      continue;
    }
    const waited = businessMinutesBetween(
      new Date(issue.statusSince),
      now,
      config.businessHours,
      config.waitTestGraceMinutes,
    );
    if (waited < config.waitTestGraceMinutes) {
      decisions.push({
        subject,
        action: "wait",
        reason: `leaving it to people first (${waited} of ${config.waitTestGraceMinutes} business minutes)`,
      });
      continue;
    }
    if (claimed >= config.maxClaimedTests) {
      decisions.push({ subject, action: "wait", reason: `${claimed} tests already claimed` });
      continue;
    }
    if (claimedToday >= config.maxClaimsPerDay) {
      decisions.push({ subject, action: "wait", reason: `${claimedToday} tests claimed today` });
      continue;
    }
    claimed += 1;
    claimedToday += 1;
    decisions.push({
      subject,
      action: "claim-test",
      reason: `test plan in comment ${plan.plan.id}`,
      ref: plan.plan.id,
    });
  }
  return decisions;
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
    if (!businessTime) {
      decisions.push({ subject, action: "wait", reason: "outside business hours" });
      continue;
    }
    if (claimedToday >= config.maxClaimsPerDay) {
      decisions.push({ subject, action: "wait", reason: `${claimedToday} tests claimed today` });
      continue;
    }
    claimedToday += 1;
    decisions.push({
      subject,
      action: "retest",
      reason: `fix pushed after the failed test (${report.id})`,
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
): Decision[] {
  const inProgress = config.columns.inProgress;
  if (!config.inProgressStatusId || !inProgress?.length) return [];
  const mine = issues.filter((i) => i.assigneeId === config.me);
  const current = mine.find((i) => inProgress.includes(i.statusId));
  const byKey = new Map(mine.map((i) => [i.key, i]));
  const next = startedDevKeys
    .map((key) => byKey.get(key))
    .find((i) => i && config.columns.todo.includes(i.statusId));
  if (!next) return [];
  if (current) {
    return [{ subject: next.key, action: "wait", reason: `${current.key} is In Progress` }];
  }
  if (!isBusinessTime(now, config.businessHours)) {
    return [{ subject: next.key, action: "wait", reason: "outside business hours" }];
  }
  return [
    {
      subject: next.key,
      action: "start-progress",
      reason: "started, and none of yours is In Progress",
    },
  ];
}

const TICKET_KEYS = /\b[A-Z][A-Z0-9]+-\d+\b/g;

/** Tickets named in the PR's title or branch (a PR may bundle more than one). */
function ticketKeysOf(pr: PullRequest): string[] {
  return [...new Set(`${pr.title} ${pr.sourceBranch ?? ""}`.match(TICKET_KEYS) ?? [])];
}

/**
 * With `columns.codeReview` set, a PR is only reviewed once one of its tickets is in that column:
 * people open PRs while still working. `issues` are the board's issues; the wait before approving
 * then counts from the later of the last push and the ticket reaching Code Review.
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
  const delayMinutes = config.approveDelayHours * 60;
  const codeReviewColumn = config.columns.codeReview;
  const inCodeReview = new Map(
    issues.filter((i) => codeReviewColumn?.includes(i.statusId)).map((i) => [i.key, i.statusSince]),
  );
  // Opt-in: a ticket past Code Review whose PR nobody approved goes to review before it merges.
  const deploying = new Map(
    config.codeReview?.unapprovedDeploying
      ? issues
          .filter((i) => config.columns.deploying?.includes(i.statusId))
          .map((i) => [i.key, i.statusSince])
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

  for (const pr of prs) {
    const subject = prSubject(pr);
    if (pr.authorId === config.me) continue;
    const mine = pr.reviewers.find((r) => r.id === config.me);
    // Bitbucket keeps an approval through new pushes; those are reviewed (`approvedCommit`).
    if (!mine || (mine.state === "approved" && !pr.approvedCommit)) continue;
    if (state.handled[`review:${subject}`] === pr.lastPushAt) continue;

    const skip = (reason: string) => decisions.push({ subject, action: "skip", reason });
    const wait = (reason: string) => decisions.push({ subject, action: "wait", reason });
    const keys = ticketKeysOf(pr);
    const unapprovedDeploying =
      !pr.reviewers.some((r) => r.state === "approved") && keys.some((key) => deploying.has(key));
    const reachedCodeReview = keys
      .map((key) => inCodeReview.get(key) ?? (unapprovedDeploying ? deploying.get(key) : undefined))
      .filter((since): since is string => Boolean(since))
      .sort()
      .at(-1);
    if (codeReviewColumn && keys.length === 0) wait("no ticket in the PR title or branch");
    else if (codeReviewColumn && !reachedCodeReview) {
      // Past Code Review (tested, deploying: the PR merges at the deploy) or off the board: not
      // the user's to review, so not listed either.
      if (keys.some((key) => beforeCodeReview.has(key))) {
        wait(`ticket ${keys.join(", ")} isn't in Code Review yet`);
      }
    } else if (pr.draft) skip("draft");
    else if (pr.hasConflicts) skip("has conflicts");
    else if (pr.ci === "failed") skip("CI failed");
    else if (pr.reviewers.some((r) => r.id !== config.me && r.state === "changes_requested")) {
      skip("another reviewer requested changes");
    } else if ((state.reviewRounds[subject] ?? 0) >= config.maxReviewRounds) {
      skip(`${config.maxReviewRounds} review rounds already`);
    } else if (pr.ci === "running") wait("CI running");
    else if (!businessTime) wait("outside business hours");
    else {
      const since =
        reachedCodeReview && Date.parse(reachedCodeReview) > Date.parse(pr.lastPushAt)
          ? reachedCodeReview
          : pr.lastPushAt;
      const elapsed = businessMinutesBetween(
        new Date(since),
        now,
        config.businessHours,
        delayMinutes,
      );
      if (elapsed < delayMinutes) {
        wait(`giving people time to review (${elapsed} of ${delayMinutes} business minutes)`);
      } else {
        decisions.push({
          subject,
          action: "review",
          reason: pr.approvedCommit
            ? "pushed since the user's approval"
            : unapprovedDeploying && !keys.some((key) => inCodeReview.has(key))
              ? "past Code Review without any approval"
              : "ready for review",
        });
      }
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
