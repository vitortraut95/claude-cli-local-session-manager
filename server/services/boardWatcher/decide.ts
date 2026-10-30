import { businessMinutesBetween, isBusinessTime, localDay } from "./businessTime.js";
import type { BoardWatcherConfig } from "./config.js";
import { gradeDescription } from "./descriptionGate.js";
import { testabilityProblem, testPlanStatus } from "./testPlan.js";
import { prSubject, type BoardIssue, type PullRequest, type WatcherState } from "./types.js";

/**
 * Pure decisions for one look at the board: what to queue, claim or review, and why the rest is
 * skipped or waiting. No I/O here; `tick.ts` carries them out. Issues and PRs the user has no
 * part in (unassigned, someone else's, not a reviewer) get no decision at all.
 */

export type DecisionAction =
  "enqueue-dev" | "weak-description" | "claim-test" | "review" | "skip" | "wait";

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
  const inTesting = new Set(
    issues.filter((i) => config.columns.testing.includes(i.statusId)).map((i) => i.key),
  );
  let claimed = state.claimedTests.filter((key) => inTesting.has(key)).length;
  const businessTime = isBusinessTime(now, config.businessHours);
  const waitingTests: BoardIssue[] = [];

  for (const issue of issues) {
    const subject = issue.key;
    if (config.columns.todo.includes(issue.statusId)) {
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

    if (config.columns.waitTest.includes(issue.statusId)) waitingTests.push(issue);
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

export function decidePullRequests(
  prs: PullRequest[],
  state: WatcherState,
  config: BoardWatcherConfig,
  now: Date,
): Decision[] {
  const decisions: Decision[] = [];
  const businessTime = isBusinessTime(now, config.businessHours);
  const delayMinutes = config.approveDelayHours * 60;

  for (const pr of prs) {
    const subject = prSubject(pr);
    if (pr.authorId === config.me) continue;
    const mine = pr.reviewers.find((r) => r.id === config.me);
    // An approval stays until a new push resets it (Bitbucket), so it means this push is done.
    if (!mine || mine.state === "approved") continue;
    if (state.handled[`review:${subject}`] === pr.lastPushAt) continue;

    const skip = (reason: string) => decisions.push({ subject, action: "skip", reason });
    const wait = (reason: string) => decisions.push({ subject, action: "wait", reason });
    if (pr.draft) skip("draft");
    else if (pr.hasConflicts) skip("has conflicts");
    else if (pr.ci === "failed") skip("CI failed");
    else if (pr.reviewers.some((r) => r.id !== config.me && r.state === "changes_requested")) {
      skip("another reviewer requested changes");
    } else if ((state.reviewRounds[subject] ?? 0) >= config.maxReviewRounds) {
      skip(`${config.maxReviewRounds} review rounds already`);
    } else if (pr.ci === "running") wait("CI running");
    else if (!businessTime) wait("outside business hours");
    else {
      const elapsed = businessMinutesBetween(
        new Date(pr.lastPushAt),
        now,
        config.businessHours,
        delayMinutes,
      );
      if (elapsed < delayMinutes) {
        wait(`giving people time to review (${elapsed} of ${delayMinutes} business minutes)`);
      } else {
        decisions.push({ subject, action: "review", reason: "ready for review" });
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
