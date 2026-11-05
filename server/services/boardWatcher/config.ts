import { readFile } from "node:fs/promises";
import path from "node:path";
import { REPO_ROOT } from "../../utils/repoRoot.js";
import type { NetworkRequirements } from "./network.js";

/**
 * Board watcher settings. The board's own ids (account, status ids per column) live in the
 * gitignored `boardWatcher.json` at the repo root, never in the code; the limits default to the
 * values below.
 */

export type BusinessHours = {
  /** IANA zone, e.g. "America/Sao_Paulo". */
  timezone: string;
  /** 0 = Sunday … 6 = Saturday. */
  days: number[];
  /** "HH:MM", start inclusive, end exclusive. */
  start: string;
  end: string;
};

export type BoardWatcherLimits = {
  /** Business minutes since the PR's last push before approving, so people get to review first. */
  approveDelayMinutes: number;
  maxCommentsPerPr: number;
  maxReviewRounds: number;
  /** Past this the watcher pauses itself: that many approvals in a day means something's off. */
  maxApprovesPerDay: number;
  maxClaimedTests: number;
  maxClaimsPerDay: number;
  /** My tasks the watcher queued that can be in development at once (ticket still in To Do or
   *  In Progress); the next To Do one is only queued when a slot frees. */
  maxDevTasks: number;
  /** Business minutes a ticket sits in Wait Test before the watcher takes it, so people go first. */
  waitTestGraceMinutes: number;
  /** Out of 5, see `descriptionGate.ts`. */
  descriptionMinScore: number;
};

export type BoardWatcherConfig = BoardWatcherLimits & {
  /** Off unless true. */
  enabled?: boolean;
  /** The real board and PRs are always read; each write is only recorded (simulation) unless
   *  its switch in `live` is on. */
  mode?: "simulate";
  /** Writes done for real (all off unless true): queue my To Do tickets in the app, move a
   *  claimed test to Testing in Jira, post review comments and approve on Bitbucket, move my
   *  started task to In Progress. */
  live?: {
    devQueue?: boolean;
    testClaim?: boolean;
    comments?: boolean;
    approve?: boolean;
    startProgress?: boolean;
    rebuild?: boolean;
  };
  /** The user's account id on the board and the code host. */
  me: string;
  /** Status ids making up each board column. With `codeReview`, PRs are only reviewed once
   *  their ticket is there. */
  columns: {
    todo: string[];
    waitTest: string[];
    testing: string[];
    codeReview?: string[];
    inProgress?: string[];
    /** After the test, until the PR merges at the deploy (Validation, Ready for Deployment). */
    deploying?: string[];
  };
  /** Where a claimed test is moved to ("" = no Testing column: tests aren't claimed). */
  testingStatusId: string;
  /** Where the user's started task is moved to, one at a time (`decideProgress`). */
  inProgressStatusId?: string;
  /** Visible actions (comment, approve, claim) only happen inside these. */
  businessHours: BusinessHours;
  /** Where the board lives. Only the active sprint's issues are considered; `scopeJql` narrows
   *  searches to the team's issues. */
  jira?: { site: string; boardId?: number; scopeJql: string; boardUrl?: string };
  /** The team's repos whose open PRs are reviewed; `localRepos` maps each to its local clone,
   *  where review worktrees are made. */
  bitbucket?: { workspace: string; repos: string[]; localRepos?: Record<string, string> };
  /** Automation switches (all on unless false): queue my To Do tickets, look at colleagues' PRs,
   *  and the Teams notices. */
  todo?: { enabled?: boolean };
  /** `unapprovedDeploying`: also review the PRs nobody approved whose ticket is in `deploying`. */
  codeReview?: { enabled?: boolean; unapprovedDeploying?: boolean };
  notifications?: { instant?: boolean; digest?: boolean };
  /** "Point to homolog": the repos it's offered for and, per repo, the homolog pages to open
   *  once it's deployed. */
  homolog?: { repos: string[]; urls?: Record<string, string[]> };
  /** A summary for the daily meeting (yesterday, today, what's stuck), sent `leadMinutes` before
   *  `meetingAt` ("HH:MM", business timezone) on business days. Off without it. */
  daily?: { meetingAt: string; leadMinutes?: number };
  /** What happens to a claimed Wait Test ticket: `queue` (default) adds it to the app's task
   *  queue as a test entry, launched by the scheduler like any other; `headless` runs an
   *  unattended test session (`claudeTester.ts`, with `skill`). */
  test?: {
    /** Off = Wait Test tickets aren't claimed at all. */
    enabled?: boolean;
    runner?: "queue" | "headless";
    /** What the network must look like before a test starts (e.g. VPN up, IPv6 off, for
     *  homolog/preview environments); see `network.ts`. */
    requires?: NetworkRequirements;
    skill?: string;
    model?: string;
    maxBudgetUsd?: number;
  };
  /** Real review sessions (`claudeReviewer.ts`); off = reviews are only recorded as due. A
   *  small PR (up to `smallPr` changed files and lines) is reviewed with `smallModel` (default
   *  "sonnet"), the rest with `model` (default: the CLI's). */
  review?: {
    enabled?: boolean;
    model?: string;
    smallModel?: string;
    smallPr?: { maxFiles?: number; maxLines?: number };
    maxBudgetUsd?: number;
  };
};

export const DEFAULT_LIMITS: BoardWatcherLimits = {
  approveDelayMinutes: 120,
  maxCommentsPerPr: 3,
  maxReviewRounds: 3,
  maxApprovesPerDay: 8,
  maxClaimedTests: 2,
  maxClaimsPerDay: 4,
  maxDevTasks: 1,
  waitTestGraceMinutes: 60,
  descriptionMinScore: 3,
};

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  days: [1, 2, 3, 4, 5],
  start: "09:00",
  end: "18:00",
};

export const BOARD_WATCHER_CONFIG_FILE = path.join(REPO_ROOT, "boardWatcher.json");

/** Null when the file doesn't exist yet (the watcher stays off). */
export async function loadBoardWatcherConfig(): Promise<BoardWatcherConfig | null> {
  const raw = await readFile(BOARD_WATCHER_CONFIG_FILE, "utf8").catch(
    (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") return null;
      throw err;
    },
  );
  if (raw === null) return null;
  const parsed = JSON.parse(raw) as Partial<BoardWatcherConfig> & { approveDelayHours?: number };
  if (!parsed.me || !parsed.columns) {
    // Halfway through the setup panel (not turned on yet): no watcher, no error.
    if (!parsed.enabled) return null;
    throw new Error(`${BOARD_WATCHER_CONFIG_FILE} needs "me" and "columns".`);
  }
  // Older files set the delay in hours.
  const { approveDelayHours, ...rest } = parsed;
  if (rest.approveDelayMinutes === undefined && typeof approveDelayHours === "number") {
    rest.approveDelayMinutes = approveDelayHours * 60;
  }
  return {
    ...DEFAULT_LIMITS,
    ...rest,
    // A board without the test columns (code review only) leaves them empty.
    columns: {
      todo: [],
      waitTest: [],
      testing: [],
      ...(parsed.columns as Partial<BoardWatcherConfig["columns"]>),
    },
    testingStatusId: parsed.testingStatusId ?? "",
    businessHours: { ...DEFAULT_BUSINESS_HOURS, ...parsed.businessHours },
  } as BoardWatcherConfig;
}
