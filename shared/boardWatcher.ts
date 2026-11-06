/** Board watcher API types (`server/routes/boardWatcher.ts`), shared with the frontend. */

/** What each automation switch turns on; all default to on once the watcher is enabled. */
export type AutomationFeatures = {
  /** My To Do tickets with a good description go to the task queue. */
  devQueue: boolean;
  /** Colleagues' PRs are looked at (review, then approve). */
  codeReview: boolean;
  /** A real review session runs for each due PR (off = only recorded as due). */
  reviewSessions: boolean;
  /** PRs of tickets already past Code Review (Validation, Ready for Deployment) that nobody
   *  approved are reviewed too, before they merge at the deploy. */
  reviewUnapprovedDeploying: boolean;
  /** Colleagues' Wait Test tickets with a test plan go to the test queue. */
  testQueue: boolean;
  /** Important events go to Teams right away. */
  instantNotices: boolean;
  /** The 09:00 / 18:00 digest goes to Teams. */
  digest: boolean;
  /** A preview build that failed for infra reasons is looked at for a re-run (done for real only
   *  with `live.rebuild`). */
  rebuild: boolean;
};

/** Which writes are done for real; off = only recorded (simulation). All start off. */
export type AutomationLive = {
  /** My To Do tickets go into the app's task queue. */
  devQueue: boolean;
  /** A claimed Wait Test ticket is moved to Testing in Jira. */
  testClaim: boolean;
  /** Review findings are posted on the PR. */
  comments: boolean;
  /** A clean review approves the PR. */
  approve: boolean;
  /** One started task of mine at a time is moved to In Progress in Jira. */
  startProgress: boolean;
  /** A preview build of mine (or of a claimed test) that failed for infra reasons is run again,
   *  once per commit, in Jenkins. */
  rebuild: boolean;
};

export type AutomationLimits = {
  approveDelayMinutes: number;
  waitTestGraceMinutes: number;
  maxClaimedTests: number;
  maxClaimsPerDay: number;
  maxDevTasks: number;
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
  live: AutomationLive;
  limits: AutomationLimits;
  businessHours: { start: string; end: string; days: number[]; timezone: string };
};

export type AutomationSettingsInput = {
  enabled?: boolean;
  features?: Partial<AutomationFeatures>;
  live?: Partial<AutomationLive>;
  limits?: Partial<AutomationLimits>;
  businessHours?: Partial<Pick<AutomationSettings["businessHours"], "start" | "end" | "days">>;
};

export type WatcherDecisionAction =
  | "enqueue-dev"
  | "weak-description"
  | "claim-test"
  | "retest"
  | "start-progress"
  | "review"
  | "skip"
  | "wait";

/** What the watcher decided about one ticket (a key) or PR (`repo#id`) on its last look. */
/** Why a PR is on the list beyond its reason: past Code Review without approvals, or pushed
 *  since the user approved it. */
export type DecisionContext = {
  kind: "unapproved-deploying" | "pushed-after-approval";
  keys: string[];
  lastPushAt: string;
};

export type BuildDiagnosisView = {
  kind: "infra" | "code" | "unknown";
  stage: string;
  cause: string;
  fix: string;
};

export type WatcherDecision = {
  subject: string;
  action: WatcherDecisionAction;
  reason: string;
  ref?: string;
  context?: DecisionContext;
  /** The failed build behind a "CI failed", with why once the log was read (null: couldn't). */
  build?: { url: string; name: string; diagnosis?: BuildDiagnosisView | null };
  /** The PR and/or ticket, to open from the Board. */
  links?: { kind: "pr" | "issue"; url: string }[];
};

export type WatcherActionKind =
  | "enqueue-dev"
  | "claim-test"
  | "retest"
  | "start-progress"
  | "queued-test"
  | "review"
  | "reviewed"
  | "review-failed"
  | "tested"
  | "test-failed"
  | "comment"
  | "approve"
  | "notify"
  | "build-failed"
  | "pr-news"
  | "homolog";

/** One line of `boardWatcher-actions.jsonl`: something done (or, in simulation, that would be). */
export type WatcherActionEntry = {
  ts: string;
  action: WatcherActionKind;
  subject: string;
  title: string;
  detail?: string;
  /** Done for real (Jira, Bitbucket, the task queue); absent = only recorded (simulation). */
  live?: boolean;
  /** A test's screenshots, relative to `boardWatcher-tests/` (served by `GET /evidence`). */
  files?: string[];
  /** A review/test session's cost as the CLI reports it (an API-price estimate on a plan) and
   *  how long it ran. */
  costUsd?: number;
  durationMs?: number;
};

export const HISTORY_FILTERS = ["all", "reviews", "tests", "queue", "notices"] as const;
export type HistoryFilter = (typeof HISTORY_FILTERS)[number];

const HISTORY_FILTER_KINDS: Record<Exclude<HistoryFilter, "all">, WatcherActionKind[]> = {
  reviews: ["review", "reviewed", "review-failed", "approve", "comment"],
  tests: ["claim-test", "retest", "tested", "test-failed", "homolog"],
  queue: ["enqueue-dev", "queued-test", "start-progress"],
  notices: ["notify", "build-failed", "pr-news"],
};

export function matchesHistoryFilter(entry: WatcherActionEntry, filter: HistoryFilter): boolean {
  return filter === "all" || HISTORY_FILTER_KINDS[filter].includes(entry.action);
}

/** The ticket key or `repo#id` an entry is about (a notice's subject is "Not approved: repo#1"). */
export function historySubject(entry: Pick<WatcherActionEntry, "subject">): string {
  return entry.subject.replace(/^(Weak description|Not approved|Product questions): /, "");
}

/** Everything recorded about one ticket or PR, newest first. */
export type WatcherHistoryGroup = {
  subject: string;
  title: string;
  lastTs: string;
  /** Some of it was done for real. */
  live: boolean;
  entries: WatcherActionEntry[];
};

/** One page of groups, most recently active first; `nextCursor` asks for the next one. */
export type WatcherHistoryPage = { groups: WatcherHistoryGroup[]; nextCursor: string | null };

export type BoardWatcherStatus = {
  enabled: boolean;
  mode: string | null;
  /** The writes done for real (the rest is simulated). */
  live: (keyof AutomationLive)[];
  /** Inside business hours: tests, reviews, comments and approvals only happen then. */
  businessTime: boolean;
  /** Outside them, when they start again. */
  nextBusinessStart: string | null;
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
  /** Review/test sessions the watcher ran today, with their total time and estimated cost. */
  today: { reviews: number; tests: number; durationMs: number; costUsd: number };
  /** Why pending reviews/tests aren't starting (e.g. the plan's usage limit), or null. */
  jobsBlockedBy: string | null;
  /** The API calls of the last look (and anything running alongside it) and over the last hour,
   *  against Bitbucket's hourly limit. */
  calls: WatcherCalls | null;
  scoreboard: WatcherScoreboard;
  lastDecisions: WatcherDecision[];
  /** The PR or ticket title per subject (`repo#id` or a key) the Board shows, when known. */
  titles: Record<string, string>;
  /** To link a subject: `{jira}KEY` and `{bitbucket}repo/pull-requests/id`. */
  linkBases: { jira: string | null; bitbucket: string | null };
};

export type WatcherCalls = {
  lastLook: { jira: number; bitbucket: number; jenkins: number };
  lastLookMs: number;
  retries: number;
  lastHour: { jira: number; bitbucket: number; jenkins: number };
};

/** A branch that can be pointed to homolog: a ticket's PR branch in a homolog repo. */
export type HomologCandidate = { repo: string; branch: string };

/** The daily summary as the Board shows it (built on demand). */
export type DailyPreview = {
  /** "ontem", or "sexta 30/10" after a holiday or a day off. */
  dayLabel: string;
  yesterday: string[];
  today: string[];
  stuck: string[];
  /** The few first-person lines to say or paste. */
  text: string;
};

/** The user's verdict on something the watcher did (a history entry), for calibration. */
export type WatcherFeedback = {
  /** Identifies the history entry: its `ts`, `action` and `subject`. */
  entryKey: string;
  action: WatcherActionKind;
  subject: string;
  verdict: "up" | "down";
  /** Why, in the user's words; a "down" with a note becomes a lesson for the next sessions. */
  note?: string;
  ts: string;
};

export type FeedbackScore = { up: number; down: number };

/** Hit rate of the last `days`: reviews (verdicts and comments), tests, and the rest (queueing,
 *  claims, notices). */
export type WatcherScoreboard = {
  days: number;
  reviews: FeedbackScore;
  tests: FeedbackScore;
  decisions: FeedbackScore;
};

export function feedbackEntryKey(entry: Pick<WatcherActionEntry, "ts" | "action" | "subject">) {
  return `${entry.ts}|${entry.action}|${entry.subject}`;
}

/** The setup panel's roles for the board's columns (`boardWatcher.json` → `columns`). */
export const BOARD_ROLES = [
  "todo",
  "inProgress",
  "codeReview",
  "waitTest",
  "testing",
  "deploying",
] as const;
export type BoardRole = (typeof BOARD_ROLES)[number];

/**
 * Where a token or URL the automations use comes from: saved by the panel (wins), exported in a
 * shell startup file (`~/.zshrc`…), an environment variable, or missing.
 */
export type SecretState = "saved" | "environment" | "shell" | "missing";

/** What's configured so far, for the setup panel's steps. */
export type AutomationSetupStatus = {
  claude: { installed: boolean; version: string | null };
  jira: {
    site: string | null;
    email: string | null;
    token: SecretState;
    /** The account id found from the token (`boardWatcher.json` → `me`). */
    me: string | null;
  };
  board: {
    boardId: number | null;
    boardUrl: string | null;
    /** Status ids per role, as saved. */
    columns: Partial<Record<BoardRole, string[]>> | null;
  };
  bitbucket: {
    workspace: string | null;
    email: string | null;
    token: SecretState;
    repos: string[];
    localRepos: Record<string, string>;
  };
  extras: {
    teams: SecretState;
    jenkinsUser: SecretState;
    /** The Jenkins user id itself (not a secret), to show it. */
    jenkinsUserId: string | null;
    jenkinsToken: SecretState;
  };
  /** Variable name → shell file it was read from, for the tokens whose source is `shell`. */
  secretFiles?: Record<string, string>;
  /** The automations' switches, as the Automation modal shows them. */
  features: AutomationFeatures;
  live: AutomationLive;

  /** `boardWatcher.json` → `enabled`: the setup was finished. */
  enabled: boolean;
};

export type BoardColumn = { name: string; statusIds: string[] };

export type BoardColumnsAnswer = {
  boardId: number;
  boardName: string;
  columns: BoardColumn[];
  /** Column names per role, guessed from their names (or the saved mapping). */
  suggested: Partial<Record<BoardRole, string[]>>;
};

export type BitbucketRepoOption = {
  slug: string;
  /** A local clone found in the workspace folders (or the saved one). */
  localPath: string | null;
};

/** The setup's last step: the automations' modes, as the Automation modal saves them. */
export type SetupFinishInput = {
  features: Partial<AutomationFeatures>;
  live: Partial<AutomationLive>;
};

/** What the watcher is doing, for the Board's live panel (kept in memory, newest last). */
export type WatcherActivityKind =
  | "look"
  | "issues"
  | "prs"
  | "decisions"
  | "lookDone"
  | "lookFailed"
  | "review"
  | "reviewDone"
  | "reviewFailed"
  | "reviewSkipped"
  | "test"
  | "testDone"
  | "testFailed"
  | "diagnose"
  | "diagnosed"
  | "rebuild"
  | "blocked"
  | "stopped"
  | "switchOn"
  | "switchOff";

export type WatcherActivityEvent = {
  seq: number;
  at: string;
  kind: WatcherActivityKind;
  /** The PR or ticket it's about. */
  subject?: string;
  /** A count, an outcome or a reason, shown as it is. */
  detail?: string;
};

export type WatcherActivity = {
  events: WatcherActivityEvent[];
  /** What's running right now and since when; null when idle. */
  current: { kind: WatcherActivityKind; subject?: string; since: string } | null;
};
