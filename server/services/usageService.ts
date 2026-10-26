import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AppError, errorMessage } from "../utils/httpError.js";
import type { ClaudeExtraUsage, ClaudeUsageLimit, ClaudeUsageStatus } from "../../shared/system.js";

type RawLimit = {
  kind?: string;
  group?: string;
  percent?: number;
  severity?: string;
  resets_at?: string | null;
  is_active?: boolean;
};

type RawExtraUsage = {
  is_enabled?: boolean;
  monthly_limit?: number;
  used_credits?: number;
  utilization?: number | null;
  currency?: string;
};

type RawUsageResponse = {
  limits?: RawLimit[];
  extra_usage?: RawExtraUsage | null;
};

const ANTHROPIC_BETA_HEADER = "oauth-2025-04-20";
const USAGE_ENDPOINT = "https://api.anthropic.com/api/oauth/usage";
/** Undocumented account-usage endpoint used by Claude Code's status line; reading it doesn't
 *  consume usage. */
/** One fetch per window, however many readers (scheduler, badge); longer once
 *  the endpoint has rate-limited us. The badge's refresh button bypasses it (not the backoff). */
const CACHE_TTL_MS = 3 * 60_000;
const CACHE_TTL_AFTER_429_MS = 5 * 60_000;
/** After a 429 (whose Retry-After is 0, i.e. no hint), no request for this long, doubling while it
 *  keeps happening. Retrying every tick is what keeps the limit from ever lifting. */
const BACKOFF_MIN_MS = 5 * 60_000;
const BACKOFF_MAX_MS = 30 * 60_000;

let cache: { status: ClaudeUsageStatus; fetchedAt: number } | null = null;
let backoff: { until: number; ms: number } | null = null;
let cacheTtlMs = CACHE_TTL_MS;

/** The last good reading while rate-limited, or the error when there's none yet. */
function rateLimited(): ClaudeUsageStatus {
  if (cache) return { ...cache.status, stale: true };
  const minutes = Math.ceil(((backoff?.until ?? Date.now()) - Date.now()) / 60_000);
  throw new AppError(
    "USAGE_RATE_LIMITED",
    `Anthropic's usage endpoint is rate-limiting requests — trying again in ~${minutes} min.`,
  );
}

function getCredentialsPath(): string {
  return path.join(os.homedir(), ".claude", ".credentials.json");
}

/** Security: only the access token is read, used once for the Authorization header; the file
 *  (and its refresh token) never leaves this function. */
async function readAccessToken(): Promise<string> {
  let raw: string;
  try {
    raw = await readFile(getCredentialsPath(), "utf-8");
  } catch {
    throw new AppError(
      "USAGE_NO_CREDENTIALS",
      `Could not find Claude's login credentials — run "claude" and sign in first.`,
    );
  }

  let parsed: { claudeAiOauth?: { accessToken?: string } };
  try {
    parsed = JSON.parse(raw) as { claudeAiOauth?: { accessToken?: string } };
  } catch {
    throw new AppError("USAGE_CREDENTIALS_UNREADABLE", "Claude's credentials file is unreadable.");
  }

  const token = parsed.claudeAiOauth?.accessToken;
  if (!token) {
    throw new AppError(
      "USAGE_NO_TOKEN",
      `No Claude login token found — run "claude" and sign in first.`,
    );
  }
  return token;
}

/** The last reading, without fetching (null before the first one). */
export function getCachedClaudeUsageStatus(): ClaudeUsageStatus | null {
  return cache?.status ?? null;
}

/** Current usage-limit status (percentages, reset times, extra-usage credits), cached for 3 min
 *  (5 after a 429) unless `forceRefresh`. */
export async function getClaudeUsageStatus(forceRefresh = false): Promise<ClaudeUsageStatus> {
  if (!forceRefresh && cache && Date.now() - cache.fetchedAt < cacheTtlMs) {
    return cache.status;
  }
  if (backoff && Date.now() < backoff.until) return rateLimited();

  const token = await readAccessToken();

  let response: Response;
  try {
    response = await fetch(USAGE_ENDPOINT, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "anthropic-beta": ANTHROPIC_BETA_HEADER,
      },
    });
  } catch (err) {
    throw new AppError(
      "USAGE_ENDPOINT_UNREACHABLE",
      `Could not reach Anthropic's usage endpoint: ${errorMessage(err)}`,
      { cause: err },
    );
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new AppError(
        "USAGE_TOKEN_EXPIRED",
        `Claude's login token has expired — run "claude" once to refresh it.`,
      );
    }
    if (response.status === 429) {
      const ms = Math.min(BACKOFF_MAX_MS, Math.max(BACKOFF_MIN_MS, (backoff?.ms ?? 0) * 2));
      backoff = { until: Date.now() + ms, ms };
      cacheTtlMs = CACHE_TTL_AFTER_429_MS;
      console.warn(`[usage] Rate-limited (429) — no request for ${ms / 60_000} min.`);
      return rateLimited();
    }
    throw new AppError("USAGE_FETCH_FAILED", `Could not fetch usage (HTTP ${response.status}).`);
  }
  backoff = null;

  // Accounts with nothing to report yet can get a 200 with an empty body: treat as no limits.
  const rawBody = await response.text();
  let data: RawUsageResponse;
  try {
    data = rawBody.trim() ? (JSON.parse(rawBody) as RawUsageResponse) : {};
  } catch {
    data = {};
  }

  const limits: ClaudeUsageLimit[] = (data.limits ?? []).flatMap((limit) => {
    if (
      typeof limit.kind !== "string" ||
      typeof limit.group !== "string" ||
      typeof limit.percent !== "number"
    ) {
      return [];
    }
    return [
      {
        kind: limit.kind,
        group: limit.group,
        percent: limit.percent,
        severity: limit.severity ?? "normal",
        resetsAt: limit.resets_at ?? null,
        isActive: limit.is_active ?? false,
      },
    ];
  });

  const extraUsage: ClaudeExtraUsage | null = data.extra_usage
    ? {
        isEnabled: Boolean(data.extra_usage.is_enabled),
        monthlyLimit: data.extra_usage.monthly_limit ?? 0,
        usedCredits: data.extra_usage.used_credits ?? 0,
        utilization: data.extra_usage.utilization ?? null,
        currency: data.extra_usage.currency ?? "USD",
      }
    : null;

  const status: ClaudeUsageStatus = {
    limits,
    extraUsage,
    fetchedAt: new Date().toISOString(),
    stale: false,
  };
  cache = { status, fetchedAt: Date.now() };
  return status;
}
