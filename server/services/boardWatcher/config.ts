import { readFile, rename, writeFile } from "node:fs/promises";
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
  maxCommentsPerPr: number;
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
  /** The repos come from the active sprint's PRs (`sprintRepos.ts`); `localRepos` pins a repo's
   *  local clone when it isn't found in the workspace folders by its name. */
  bitbucket?: { workspace: string; localRepos?: Record<string, string> };
  /** Automation switches (all on unless false), each done for real when on: queue my To Do
   *  tickets (and move my started task to In Progress), review colleagues' PRs once (comment,
   *  approve), and the Teams notices. */
  todo?: { enabled?: boolean };
  /** `unapprovedDeploying`: also review the PRs nobody approved whose ticket is in `deploying`. */
  codeReview?: { enabled?: boolean; unapprovedDeploying?: boolean };
  notifications?: { instant?: boolean; digest?: boolean };
  /** Off = a preview build failed for infra reasons isn't run again. */
  rebuild?: { enabled?: boolean };
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
    /** Off = Wait Test tickets aren't claimed at all; on = they're moved to Testing. */
    enabled?: boolean;
    runner?: "queue" | "headless";
    /** What the network must look like before a test starts (e.g. VPN up, IPv6 off, for
     *  homolog/preview environments); see `network.ts`. */
    requires?: NetworkRequirements;
    skill?: string;
    model?: string;
    maxBudgetUsd?: number;
  };
  /** The review sessions (`claudeReviewer.ts`). A small PR (up to `smallPr` changed files and
   *  lines) is reviewed with `smallModel` (default "sonnet"), the rest with `model` (default: the
   *  CLI's). */
  review?: {
    model?: string;
    smallModel?: string;
    smallPr?: { maxFiles?: number; maxLines?: number };
    maxBudgetUsd?: number;
  };
};

export const DEFAULT_LIMITS: BoardWatcherLimits = {
  maxCommentsPerPr: 3,
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
  const json = JSON.parse(raw) as Record<string, unknown>;
  if (dropSimulation(json)) await saveRawConfig(json);
  const parsed = json as Partial<BoardWatcherConfig>;
  if (!parsed.me || !parsed.columns) {
    // Halfway through the setup panel (not turned on yet): no watcher, no error.
    if (!parsed.enabled) return null;
    throw new Error(`${BOARD_WATCHER_CONFIG_FILE} needs "me" and "columns".`);
  }
  return {
    ...DEFAULT_LIMITS,
    ...parsed,
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

export async function saveRawConfig(raw: Record<string, unknown>): Promise<void> {
  const tmp = `${BOARD_WATCHER_CONFIG_FILE}.tmp`;
  await writeFile(tmp, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
  await rename(tmp, BOARD_WATCHER_CONFIG_FILE);
}

type Section = Record<string, unknown> | undefined;

/**
 * Older files had a simulation mode: an automation on with its real-action switch (`live`) off
 * only recorded what it would do. Each one only simulated is turned off (on would now act for
 * real, which nobody chose), and the keys that are gone are removed. True when `raw` changed.
 */
export function dropSimulation(raw: Record<string, unknown>): boolean {
  const legacy = ["mode", "live", "approveDelayMinutes", "approveDelayHours", "maxReviewRounds"];
  const review = raw.review as Section;
  if (!legacy.some((key) => key in raw) && !(review && "enabled" in review)) return false;
  const live = (raw.live ?? {}) as Record<string, unknown>;
  const turnOff = (key: string, real: boolean) => {
    const section = (raw[key] ?? {}) as Record<string, unknown>;
    if (section.enabled === false || real) return;
    raw[key] = { ...section, enabled: false };
  };
  // Any older file had the simulation: no `live` key at all meant everything only recorded.
  turnOff("todo", live.devQueue === true);
  turnOff(
    "codeReview",
    review?.enabled === true && (live.comments === true || live.approve === true),
  );
  turnOff("test", live.testClaim === true);
  turnOff("rebuild", live.rebuild === true);
  if (review) delete review.enabled;
  for (const key of legacy) delete raw[key];
  return true;
}
