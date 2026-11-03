import { readFile, rename, writeFile } from "node:fs/promises";
import type {
  AutomationFeatures,
  AutomationLimits,
  AutomationLive,
  AutomationSettings,
  AutomationSettingsInput,
} from "../../../shared/boardWatcher.js";
import { BadRequestError, ConflictError } from "../../utils/httpError.js";
import {
  BOARD_WATCHER_CONFIG_FILE,
  DEFAULT_BUSINESS_HOURS,
  DEFAULT_LIMITS,
  loadBoardWatcherConfig,
} from "./config.js";

/**
 * The automation switches and limits the app's "Automation" modal edits, mapped onto
 * `boardWatcher.json`. Saving rewrites only those keys, so the board ids and the rest of the file
 * stay as they are.
 */

const LIMIT_RANGES: Record<keyof AutomationLimits, [number, number]> = {
  approveDelayHours: [0, 48],
  waitTestGraceMinutes: [0, 1440],
  maxClaimedTests: [1, 10],
  maxClaimsPerDay: [1, 50],
  maxApprovesPerDay: [1, 100],
  maxCommentsPerPr: [0, 20],
  maxReviewRounds: [1, 20],
  descriptionMinScore: [0, 5],
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function getAutomationSettings(): Promise<AutomationSettings> {
  const config = await loadBoardWatcherConfig();
  const limits = Object.fromEntries(
    (Object.keys(LIMIT_RANGES) as (keyof AutomationLimits)[]).map((key) => [
      key,
      config?.[key] ?? DEFAULT_LIMITS[key],
    ]),
  ) as AutomationLimits;
  const hours = config?.businessHours ?? DEFAULT_BUSINESS_HOURS;
  return {
    configured: config !== null,
    enabled: Boolean(config?.enabled),
    mode: "simulate",
    features: {
      devQueue: config?.todo?.enabled !== false,
      codeReview: config?.codeReview?.enabled !== false,
      reviewSessions: Boolean(config?.review?.enabled),
      reviewUnapprovedDeploying: config?.codeReview?.unapprovedDeploying === true,
      testQueue: config?.test?.enabled !== false,
      instantNotices: config?.notifications?.instant !== false,
      digest: config?.notifications?.digest !== false,
    },
    live: {
      devQueue: config?.live?.devQueue === true,
      testClaim: config?.live?.testClaim === true,
      comments: config?.live?.comments === true,
      approve: config?.live?.approve === true,
      startProgress: config?.live?.startProgress === true,
    },
    limits,
    businessHours: {
      start: hours.start,
      end: hours.end,
      days: hours.days,
      timezone: hours.timezone,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function section(raw: Record<string, unknown>, key: string): Record<string, unknown> {
  const existing = raw[key];
  const value = isRecord(existing) ? existing : {};
  raw[key] = value;
  return value;
}

const FEATURE_KEYS: Record<keyof AutomationFeatures, [string, string]> = {
  devQueue: ["todo", "enabled"],
  codeReview: ["codeReview", "enabled"],
  reviewSessions: ["review", "enabled"],
  reviewUnapprovedDeploying: ["codeReview", "unapprovedDeploying"],
  testQueue: ["test", "enabled"],
  instantNotices: ["notifications", "instant"],
  digest: ["notifications", "digest"],
};

export const LIVE_KEYS: (keyof AutomationLive)[] = [
  "devQueue",
  "startProgress",
  "testClaim",
  "comments",
  "approve",
];

export async function saveAutomationSettings(body: unknown): Promise<AutomationSettings> {
  const text = await readFile(BOARD_WATCHER_CONFIG_FILE, "utf8").catch(() => null);
  if (text === null) {
    throw new ConflictError(
      "BOARD_WATCHER_NOT_CONFIGURED",
      "boardWatcher.json doesn't exist yet; the board ids must be set up first.",
    );
  }
  const raw = JSON.parse(text) as Record<string, unknown>;
  const input = (isRecord(body) ? body : {}) as AutomationSettingsInput;

  if (input.enabled !== undefined) {
    if (typeof input.enabled !== "boolean") throw new BadRequestError("BAD_SETTING", "enabled");
    raw.enabled = input.enabled;
  }
  for (const [feature, value] of Object.entries(input.features ?? {})) {
    const target = FEATURE_KEYS[feature as keyof AutomationFeatures];
    if (!target || typeof value !== "boolean") {
      throw new BadRequestError("BAD_SETTING", `"${feature}" isn't an automation switch.`);
    }
    section(raw, target[0])[target[1]] = value;
  }
  for (const [action, value] of Object.entries(input.live ?? {})) {
    if (!LIVE_KEYS.includes(action as keyof AutomationLive) || typeof value !== "boolean") {
      throw new BadRequestError("BAD_SETTING", `"${action}" isn't a real-action switch.`);
    }
    section(raw, "live")[action] = value;
  }
  for (const [limit, value] of Object.entries(input.limits ?? {})) {
    const range = LIMIT_RANGES[limit as keyof AutomationLimits];
    if (!range || typeof value !== "number" || !Number.isFinite(value)) {
      throw new BadRequestError("BAD_SETTING", `"${limit}" isn't a limit.`);
    }
    if (value < range[0] || value > range[1]) {
      throw new BadRequestError(
        "BAD_SETTING",
        `${limit} must be between ${range[0]} and ${range[1]}.`,
      );
    }
    raw[limit] = value;
  }
  if (input.businessHours) {
    const hours = section(raw, "businessHours");
    const { start, end, days } = input.businessHours;
    for (const [name, value] of [
      ["start", start],
      ["end", end],
    ] as const) {
      if (value === undefined) continue;
      if (typeof value !== "string" || !HHMM.test(value)) {
        throw new BadRequestError("BAD_SETTING", `businessHours.${name} must be HH:MM.`);
      }
      hours[name] = value;
    }
    if (days !== undefined) {
      if (!Array.isArray(days) || days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
        throw new BadRequestError("BAD_SETTING", "businessHours.days must be 0 (Sun) to 6 (Sat).");
      }
      hours.days = [...new Set(days)].sort();
    }
  }

  const tmp = `${BOARD_WATCHER_CONFIG_FILE}.tmp`;
  await writeFile(tmp, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
  await rename(tmp, BOARD_WATCHER_CONFIG_FILE);
  return getAutomationSettings();
}
