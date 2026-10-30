/** Board watcher API types (`server/routes/boardWatcher.ts`), shared with the frontend. */

/** What each automation switch turns on; all default to on once the watcher is enabled. */
export type AutomationFeatures = {
  /** My To Do tickets with a good description go to the task queue. */
  devQueue: boolean;
  /** Colleagues' PRs are looked at (review, then approve). */
  codeReview: boolean;
  /** A real review session runs for each due PR (off = only recorded as due). */
  reviewSessions: boolean;
  /** Colleagues' Wait Test tickets with a test plan go to the test queue. */
  testQueue: boolean;
  /** Important events go to Teams right away. */
  instantNotices: boolean;
  /** The 09:00 / 18:00 digest goes to Teams. */
  digest: boolean;
};

export type AutomationLimits = {
  approveDelayHours: number;
  waitTestGraceMinutes: number;
  maxClaimedTests: number;
  maxClaimsPerDay: number;
  maxApprovesPerDay: number;
  maxCommentsPerPr: number;
  maxReviewRounds: number;
  descriptionMinScore: number;
};

export type AutomationSettings = {
  /** False when `boardWatcher.json` doesn't exist yet (nothing can be turned on). */
  configured: boolean;
  enabled: boolean;
  mode: "simulate";
  features: AutomationFeatures;
  limits: AutomationLimits;
  businessHours: { start: string; end: string; days: number[]; timezone: string };
};

export type AutomationSettingsInput = {
  enabled?: boolean;
  features?: Partial<AutomationFeatures>;
  limits?: Partial<AutomationLimits>;
  businessHours?: Partial<Pick<AutomationSettings["businessHours"], "start" | "end" | "days">>;
};

export type WatcherDecisionAction =
  "enqueue-dev" | "weak-description" | "claim-test" | "review" | "skip" | "wait";

/** What the watcher decided about one ticket (a key) or PR (`repo#id`) on its last look. */
export type WatcherDecision = {
  subject: string;
  action: WatcherDecisionAction;
  reason: string;
  ref?: string;
};

export type WatcherActionKind =
  | "enqueue-dev"
  | "claim-test"
  | "queued-test"
  | "review"
  | "reviewed"
  | "review-failed"
  | "tested"
  | "test-failed"
  | "comment"
  | "approve"
  | "notify";

/** One line of `boardWatcher-actions.jsonl`: something done (or, in simulation, that would be). */
export type WatcherActionEntry = {
  ts: string;
  action: WatcherActionKind;
  subject: string;
  title: string;
  detail?: string;
  /** A test's screenshots, relative to `boardWatcher-tests/` (served by `GET /evidence`). */
  files?: string[];
};

export type BoardWatcherStatus = {
  enabled: boolean;
  mode: string | null;
  /** A look at the board is running right now. */
  running: boolean;
  /** A review or test session is running right now. */
  reviewing: boolean;
  lastTickAt: string | null;
  nextLookAt: string | null;
  lastDigestAt: string | null;
  lastError: { message: string; at: string; alertedAt: string | null } | null;
  pausedReason: string | null;
  pendingReviews: string[];
  pendingTests: string[];
  approvalsToday: number;
  testClaimsToday: number;
  lastDecisions: WatcherDecision[];
};
