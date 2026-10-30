import { readFile } from "node:fs/promises";
import path from "node:path";
import { REPO_ROOT } from "../../utils/repoRoot.js";

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
  /** Business hours since the PR's last push before approving, so people get to review first. */
  approveDelayHours: number;
  maxCommentsPerPr: number;
  maxReviewRounds: number;
  /** Past this the watcher pauses itself: that many approvals in a day means something's off. */
  maxApprovesPerDay: number;
  maxClaimedTests: number;
  maxClaimsPerDay: number;
  /** Business minutes a ticket sits in Wait Test before the watcher takes it, so people go first. */
  waitTestGraceMinutes: number;
  /** Out of 5, see `descriptionGate.ts`. */
  descriptionMinScore: number;
};

export type BoardWatcherConfig = BoardWatcherLimits & {
  /** Off unless true. */
  enabled?: boolean;
  /** `simulate` reads the real board and PRs but only records what it would do. The only mode
   *  for now. */
  mode?: "simulate";
  /** The user's account id on the board and the code host. */
  me: string;
  /** Status ids making up each board column. */
  columns: { todo: string[]; waitTest: string[]; testing: string[] };
  /** Where a claimed test is moved to. */
  testingStatusId: string;
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
  codeReview?: { enabled?: boolean };
  notifications?: { instant?: boolean; digest?: boolean };
  /** What happens to a claimed Wait Test ticket: `queue` (default) adds it to the app's task
   *  queue as a test entry, launched by the scheduler like any other; `headless` runs an
   *  unattended test session (`claudeTester.ts`, with `skill`). */
  test?: {
    /** Off = Wait Test tickets aren't claimed at all. */
    enabled?: boolean;
    runner?: "queue" | "headless";
    skill?: string;
    model?: string;
    maxBudgetUsd?: number;
  };
  /** Real review sessions (`claudeReviewer.ts`); off = reviews are only recorded as due. */
  review?: { enabled?: boolean; model?: string; maxBudgetUsd?: number };
};

export const DEFAULT_LIMITS: BoardWatcherLimits = {
  approveDelayHours: 2,
  maxCommentsPerPr: 3,
  maxReviewRounds: 3,
  maxApprovesPerDay: 8,
  maxClaimedTests: 2,
  maxClaimsPerDay: 4,
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
  const parsed = JSON.parse(raw) as Partial<BoardWatcherConfig>;
  if (!parsed.me || !parsed.columns || !parsed.testingStatusId) {
    throw new Error(`${BOARD_WATCHER_CONFIG_FILE} needs "me", "columns" and "testingStatusId".`);
  }
  return {
    ...DEFAULT_LIMITS,
    ...parsed,
    businessHours: { ...DEFAULT_BUSINESS_HOURS, ...parsed.businessHours },
  } as BoardWatcherConfig;
}
