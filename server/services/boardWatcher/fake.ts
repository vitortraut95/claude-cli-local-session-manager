import {
  prSubject,
  type BoardIssue,
  type PullRequest,
  type ReviewResult,
  type WatcherDeps,
} from "./types.js";

/**
 * Sandbox providers: the board and PRs come from a scenario, and every write is recorded as a
 * one-line effect (e.g. `approve web#12`) instead of leaving the machine. Writes also update the
 * fake world, so the next tick sees a claimed test in Testing or an approved PR.
 */

export type FakeWorld = {
  issues: BoardIssue[];
  prs: PullRequest[];
  /** Review results per PR subject; a PR without one reviews clean. */
  reviews: Record<string, ReviewResult>;
  /** Dev tasks whose session started, first started first. */
  startedDevKeys?: string[];
  /** PRs that already carry the AI review comment (by anyone). */
  aiReviewed?: string[];
  /** Tickets whose test branch isn't on origin. */
  missingTestBranches?: string[];
};

export function createFakeDeps(world: FakeWorld, me: string, effects: string[]): WatcherDeps {
  return {
    board: {
      listIssues: () => Promise.resolve(structuredClone(world.issues)),
      transition: (key, statusId) => {
        effects.push(`transition ${key} -> ${statusId}`);
        const issue = world.issues.find((i) => i.key === key);
        if (issue) issue.statusId = statusId;
        return Promise.resolve();
      },
    },
    codeHost: {
      listPullRequests: () => Promise.resolve(structuredClone(world.prs)),
      comment: (pr, finding) => {
        effects.push(`comment ${prSubject(pr)} ${finding.severity}`);
        return Promise.resolve();
      },
      approve: (pr) => {
        effects.push(`approve ${prSubject(pr)}`);
        const target = world.prs.find((p) => prSubject(p) === prSubject(pr));
        const reviewer = target?.reviewers.find((r) => r.id === me);
        if (reviewer) reviewer.state = "approved";
        else target?.reviewers.push({ id: me, state: "approved" });
        return Promise.resolve();
      },
      hasAiReview: (pr) => Promise.resolve((world.aiReviewed ?? []).includes(prSubject(pr))),
      markAiReviewed: (pr, { outcome }) => {
        effects.push(`ai-review ${prSubject(pr)} ${outcome.kind}`);
        world.aiReviewed = [...(world.aiReviewed ?? []), prSubject(pr)];
        return Promise.resolve();
      },
    },
    reviewer: {
      review: (pr) => Promise.resolve(world.reviews[prSubject(pr)] ?? { findings: [] }),
    },
    notifier: {
      notify: (level, title) => {
        effects.push(`notify ${level}: ${title}`);
        return Promise.resolve();
      },
    },
    tasks: {
      enqueue: (key, kind) => {
        effects.push(`enqueue ${kind} ${key}`);
        return Promise.resolve();
      },
      startedDevKeys: () => Promise.resolve(world.startedDevKeys ?? []),
      testBranchProblem: (key) =>
        Promise.resolve(
          (world.missingTestBranches ?? []).includes(key) ? "branch isn't on origin" : null,
        ),
    },
  };
}
