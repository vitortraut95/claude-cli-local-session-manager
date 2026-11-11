/**
 * The board watcher's view of the outside world. Everything it reads or writes goes through the
 * providers below, so the same decisions run against fakes (sandbox, `board-watcher:eval`) or the
 * real Jira/Bitbucket/Teams.
 */

export type IssueComment = { id: string; authorId: string; created: string; body: string };

export type BoardIssue = {
  key: string;
  summary: string;
  /** "Story", "Bug"…; picks the branch prefix of a queued dev task. */
  issueType?: string;
  description: string;
  statusId: string;
  /** When it entered `statusId`. */
  statusSince: string;
  assigneeId: string | null;
  labels: string[];
  comments: IssueComment[];
};

export type ReviewerState = "approved" | "changes_requested" | "none";

export type PullRequest = {
  id: string;
  repo: string;
  title: string;
  authorId: string;
  createdAt: string;
  /** Any activity (push, comment, approval) bumps it. */
  updatedAt?: string;
  /** The build that failed on the PR's head, when `ci` is "failed". */
  /** `at`: when the build finished failing (Bitbucket's status update). */
  failedBuild?: { url: string; name: string; at?: string };
  /** When the PR's latest commit was pushed. */
  lastPushAt: string;
  draft: boolean;
  reviewers: { id: string; state: ReviewerState }[];
  ci: "passed" | "failed" | "running" | "none";
  hasConflicts: boolean;
  /** Needed to check the PR out for a real review. */
  sourceBranch?: string;
  destinationBranch?: string;
  /** The destination branch's head, short (as Bitbucket gives it). */
  destinationHash?: string;
  sourceHash?: string;
};

/** Only `blocking` stops the approval; `minor` (style, nitpicks) is never posted. A `product`
 *  finding (a question for PO/design/content, not about the code) goes to the user's digest
 *  instead of the PR. */
export type ReviewFinding = {
  severity: "blocking" | "major" | "minor";
  topic?: "code" | "product";
  file?: string;
  line?: number;
  body: string;
};

/** `summary`: the review's overview, repeated in the AI review comment. */
export type ReviewResult = { findings: ReviewFinding[]; summary?: string };

export type BoardProvider = {
  listIssues(): Promise<BoardIssue[]>;
  transition(key: string, statusId: string): Promise<void>;
};

/** What an AI review ended in, for the comment that marks the PR as reviewed by AI. */
export type AiReviewOutcome =
  | { kind: "approved" }
  | { kind: "blocked"; blocking: number }
  | { kind: "approval-cap"; cap: number };

/** The AI review comment's content: how it ended, the overview and the findings posted. */
export type AiReview = { outcome: AiReviewOutcome; summary?: string; posted: ReviewFinding[] };

/** PRs where the user is a reviewer or the author (the watcher filters out the author's own). */
export type CodeHostProvider = {
  listPullRequests(): Promise<PullRequest[]>;
  comment(pr: PullRequest, finding: ReviewFinding): Promise<void>;
  approve(pr: PullRequest): Promise<void>;
  /** Whether the PR already has the AI review comment, posted by anyone. */
  hasAiReview(pr: PullRequest): Promise<boolean>;
  /** Posts the comment that marks the PR as reviewed by AI (once per PR, for the whole team),
   *  with the review's overview and findings. */
  markAiReviewed(pr: PullRequest, review: AiReview): Promise<void>;
};

/** Null when the review runs later, outside the tick (a queued session). */
export type Reviewer = { review(pr: PullRequest): Promise<ReviewResult | null> };

/** `urgent` = needs the user now; `digest` = goes in the next summary. */
export type NotificationLevel = "urgent" | "digest";

export type Notifier = {
  notify(level: NotificationLevel, title: string, text: string): Promise<void>;
};

/** `retest`: a ticket already in Testing whose last test failed, tested again after a fix. */
export type TaskSink = {
  enqueue(key: string, kind: "dev" | "test" | "retest"): Promise<void>;
  /** The user's dev tasks whose session started, first started first. */
  startedDevKeys(): Promise<string[]>;
  /** Why a Wait Test ticket's test can't start yet (its branch isn't on origin), or null. */
  testBranchProblem(key: string): Promise<string | null>;
};

export type WatcherDeps = {
  board: BoardProvider;
  codeHost: CodeHostProvider;
  reviewer: Reviewer;
  notifier: Notifier;
  tasks: TaskSink;
};

/** Persisted between ticks so nothing is done twice. */
export type WatcherState = {
  /** What was last acted on per subject, e.g. `dev:KEY`, `test:KEY` → plan comment id,
   *  `retest:KEY` → the fix push retested,
   *  `review:repo#id` → the push queued for review, `ai-reviewed:repo#id` → the commit the AI
   *  review ran on (that PR isn't reviewed again), `gate:KEY` → the description already
   *  reported. */
  handled: Record<string, string>;
  approvals: { day: string; count: number };
  /** Tests this watcher moved to Testing; they stop counting once the issue leaves Testing. */
  claimedTests: string[];
  testClaims: { day: string; count: number };
  /** Set when a limit trips; nothing runs until the user clears it. */
  pausedReason: string | null;
  /** PRs waiting for a review session (run one at a time, outside the tick). */
  pendingReviews: PullRequest[];
  /** Claimed tickets waiting for a test session, as they were when claimed. */
  pendingTests: { issue: BoardIssue; planId: string; retest?: boolean }[];
  /** Tickets and PRs the user started by hand ("Start now"): what they were waiting for is
   *  skipped (business hours, grace periods, limits, the ticket not in Code Review yet, CI
   *  running), and their session runs even outside business hours. */
  forced: string[];
  /** Tickets and PRs in the order the user dragged them to on the Board: the first ones get the
   *  next session, the dev slot or the test claim before the rest (`byPriority`). */
  priority: string[];
};

export function emptyWatcherState(): WatcherState {
  return {
    handled: {},
    approvals: { day: "", count: 0 },
    claimedTests: [],
    testClaims: { day: "", count: 0 },
    pausedReason: null,
    pendingReviews: [],
    pendingTests: [],
    forced: [],
    priority: [],
  };
}

/** `items` with the ones in `priority` first, in that order; the rest keep theirs. */
export function byPriority<T>(items: T[], subjectOf: (item: T) => string, priority: string[]): T[] {
  const rank = new Map(priority.map((subject, index) => [subject, index]));
  return items
    .map((item, index) => ({ item, index, rank: rank.get(subjectOf(item)) ?? Infinity }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ item }) => item);
}

export function prSubject(pr: PullRequest): string {
  return `${pr.repo}#${pr.id}`;
}
