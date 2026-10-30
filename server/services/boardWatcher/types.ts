/**
 * The board watcher's view of the outside world. Everything it reads or writes goes through the
 * providers below, so the same decisions run against fakes (sandbox, `board-watcher:eval`) or the
 * real Jira/Bitbucket/Teams.
 */

export type IssueComment = { id: string; authorId: string; created: string; body: string };

export type BoardIssue = {
  key: string;
  summary: string;
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
  /** The PR's latest commit; a new push means a new review round. */
  lastPushAt: string;
  draft: boolean;
  reviewers: { id: string; state: ReviewerState }[];
  ci: "passed" | "failed" | "running" | "none";
  hasConflicts: boolean;
  /** Needed to check the PR out for a real review. */
  sourceBranch?: string;
  destinationBranch?: string;
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

export type ReviewResult = { findings: ReviewFinding[] };

export type BoardProvider = {
  listIssues(): Promise<BoardIssue[]>;
  transition(key: string, statusId: string): Promise<void>;
};

/** PRs where the user is a reviewer or the author (the watcher filters out the author's own). */
export type CodeHostProvider = {
  listPullRequests(): Promise<PullRequest[]>;
  comment(pr: PullRequest, finding: ReviewFinding): Promise<void>;
  approve(pr: PullRequest): Promise<void>;
};

/** Null when no review ran (simulation): the push counts as handled, nothing is posted. */
export type Reviewer = { review(pr: PullRequest): Promise<ReviewResult | null> };

/** `urgent` = needs the user now; `digest` = goes in the next summary. */
export type NotificationLevel = "urgent" | "digest";

export type Notifier = {
  notify(level: NotificationLevel, title: string, text: string): Promise<void>;
};

export type TaskSink = { enqueue(key: string, kind: "dev" | "test"): Promise<void> };

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
   *  `review:repo#id` → the push reviewed, `gate:KEY` → the description already reported. */
  handled: Record<string, string>;
  reviewRounds: Record<string, number>;
  approvals: { day: string; count: number };
  /** Tests this watcher moved to Testing; they stop counting once the issue leaves Testing. */
  claimedTests: string[];
  testClaims: { day: string; count: number };
  /** Set when a limit trips; nothing runs until the user clears it. */
  pausedReason: string | null;
  /** PRs waiting for a review session (run one at a time, outside the tick). */
  pendingReviews: PullRequest[];
};

export function emptyWatcherState(): WatcherState {
  return {
    handled: {},
    reviewRounds: {},
    approvals: { day: "", count: 0 },
    claimedTests: [],
    testClaims: { day: "", count: 0 },
    pausedReason: null,
    pendingReviews: [],
  };
}

export function prSubject(pr: PullRequest): string {
  return `${pr.repo}#${pr.id}`;
}
