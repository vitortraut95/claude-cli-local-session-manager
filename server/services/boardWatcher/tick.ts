import type { WatcherWork } from "../../../shared/boardWatcher.js";
import { localDay } from "./businessTime.js";
import type { BoardWatcherConfig } from "./config.js";
import {
  decideIssues,
  decideProgress,
  decidePullRequests,
  decideRetests,
  type Decision,
} from "./decide.js";
import {
  prSubject,
  type AiReviewOutcome,
  type PullRequest,
  type ReviewResult,
  type WatcherDeps,
  type WatcherState,
} from "./types.js";

/**
 * One look at the board: reads it, decides (`decide.ts`) and carries the decisions out through
 * the providers, updating `state` in place so the next tick doesn't repeat any of it.
 */
export async function runTick(
  deps: WatcherDeps,
  state: WatcherState,
  config: BoardWatcherConfig,
  now: Date,
): Promise<Decision[]> {
  if (state.pausedReason) return [];
  const [issues, prs, startedDevKeys] = await Promise.all([
    deps.board.listIssues(),
    deps.codeHost.listPullRequests(),
    deps.tasks.startedDevKeys(),
  ]);
  const issueDecisions = decideIssues(issues, state, config, now);
  const claims = issueDecisions.filter((d) => d.action === "claim-test").length;
  const as = (work: WatcherWork, list: Decision[]) => list.map((d) => ({ ...d, work }));
  const decisions = [
    ...issueDecisions,
    ...as("retest", decideRetests(issues, prs, state, config, now, claims)),
    ...as("progress", decideProgress(issues, startedDevKeys, config, now, state.forced)),
    ...as("review", decidePullRequests(prs, state, config, now, issues)),
  ];
  const prsBySubject = new Map(prs.map((pr) => [prSubject(pr), pr]));

  for (const decision of decisions) {
    const { subject } = decision;
    switch (decision.action) {
      case "enqueue-dev":
        await deps.tasks.enqueue(subject, "dev");
        state.handled[`dev:${subject}`] = now.toISOString();
        break;
      case "weak-description":
        if (state.handled[`gate:${subject}`] === decision.ref) break;
        await deps.notifier.notify("digest", `Weak description: ${subject}`, decision.reason);
        state.handled[`gate:${subject}`] = decision.ref ?? "";
        break;
      case "claim-test":
        await deps.board.transition(subject, config.testingStatusId);
        await deps.tasks.enqueue(subject, "test");
        state.handled[`test:${subject}`] = decision.ref ?? "";
        if (!state.claimedTests.includes(subject)) state.claimedTests.push(subject);
        countTestClaim(state, config, now);
        break;
      case "start-progress":
        if (config.inProgressStatusId) {
          await deps.board.transition(subject, config.inProgressStatusId);
        }
        break;
      case "retest":
        await deps.tasks.enqueue(subject, "retest");
        state.handled[`retest:${subject}`] = decision.ref ?? "";
        countTestClaim(state, config, now);
        break;
      case "review": {
        const pr = prsBySubject.get(subject);
        if (!pr) break;
        // A teammate's automation got there first: that was the PR's one AI review.
        if (await deps.codeHost.hasAiReview(pr)) {
          state.handled[`ai-reviewed:${subject}`] = pr.sourceHash ?? pr.lastPushAt;
          decision.action = "skip";
          decision.reason = "already reviewed by AI";
          break;
        }
        // Checked before reviewing so a review isn't spent on a PR that can't be approved today.
        if (await pauseAtApprovalCap(deps, state, config, now)) break;
        const result = await deps.reviewer.review(pr);
        if (result) await applyReview(pr, result, deps, state, config, now);
        else state.handled[`review:${subject}`] = pr.lastPushAt;
        break;
      }
      case "skip":
      case "wait":
        break;
    }
    if (state.pausedReason) break;
  }
  return decisions;
}

function countTestClaim(state: WatcherState, config: BoardWatcherConfig, now: Date): void {
  const day = localDay(now, config.businessHours);
  if (state.testClaims.day !== day) state.testClaims = { day, count: 0 };
  state.testClaims.count += 1;
}

/** Pauses the watcher once today's approvals hit the cap; true when it did. */
async function pauseAtApprovalCap(
  deps: WatcherDeps,
  state: WatcherState,
  config: BoardWatcherConfig,
  now: Date,
): Promise<boolean> {
  const day = localDay(now, config.businessHours);
  if (state.approvals.day !== day) state.approvals = { day, count: 0 };
  if (state.approvals.count < config.maxApprovesPerDay) return false;
  state.pausedReason = `${state.approvals.count} approvals today (limit ${config.maxApprovesPerDay})`;
  await deps.notifier.notify("urgent", "Daily approval cap reached", state.pausedReason);
  return true;
}

/** Posts the relevant findings, approves when nothing blocks it and marks the PR as reviewed by
 *  AI, so no automation reviews it again. Also used for a review that ran outside the tick
 *  (`boardWatcherService`). */
export async function applyReview(
  pr: PullRequest,
  result: ReviewResult,
  deps: WatcherDeps,
  state: WatcherState,
  config: BoardWatcherConfig,
  now = new Date(),
): Promise<void> {
  const subject = prSubject(pr);
  const relevant = result.findings.filter((f) => f.severity !== "minor" && f.topic !== "product");
  const productQuestions = result.findings.filter((f) => f.topic === "product");
  if (productQuestions.length > 0) {
    await deps.notifier.notify(
      "digest",
      `Product questions: ${subject}`,
      productQuestions.map((f) => f.body).join("\n"),
    );
  }
  const posted = relevant.slice(0, config.maxCommentsPerPr);
  for (const finding of posted) {
    await deps.codeHost.comment(pr, finding);
  }
  const outcome = await approveUnlessBlocked(pr, relevant, deps, state, config, now);
  await deps.codeHost.markAiReviewed(pr, { outcome, summary: result.summary, posted });
  state.handled[`review:${subject}`] = pr.lastPushAt;
  state.handled[`ai-reviewed:${subject}`] = pr.sourceHash ?? pr.lastPushAt;
}

async function approveUnlessBlocked(
  pr: PullRequest,
  relevant: ReviewResult["findings"],
  deps: WatcherDeps,
  state: WatcherState,
  config: BoardWatcherConfig,
  now: Date,
): Promise<AiReviewOutcome> {
  const subject = prSubject(pr);
  const blocking = relevant.filter((f) => f.severity === "blocking").length;
  if (blocking > 0) {
    await deps.notifier.notify(
      "digest",
      `Not approved: ${subject}`,
      `${blocking} blocking finding(s) on "${pr.title}".`,
    );
    return { kind: "blocked", blocking };
  }
  // Reviews queued before the cap was reached still finish; they just don't approve past it.
  const day = localDay(now, config.businessHours);
  if (state.approvals.day !== day) state.approvals = { day, count: 0 };
  if (state.approvals.count >= config.maxApprovesPerDay) {
    await deps.notifier.notify(
      "digest",
      `Not approved: ${subject}`,
      `Daily approval cap (${config.maxApprovesPerDay}) reached.`,
    );
    return { kind: "approval-cap", cap: config.maxApprovesPerDay };
  }
  await deps.codeHost.approve(pr);
  state.approvals.count += 1;
  return { kind: "approved" };
}
