import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

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

export type ClaudeUsageLimit = {
  /** e.g. "session", "weekly_all", "weekly_opus" — whatever Anthropic's own account/usage API
   *  reports; not an enum on this side so a new limit kind just shows up automatically. */
  kind: string;
  group: string;
  percent: number;
  severity: string;
  resetsAt: string | null;
  isActive: boolean;
};

export type ClaudeExtraUsage = {
  isEnabled: boolean;
  monthlyLimit: number;
  usedCredits: number;
  utilization: number | null;
  currency: string;
};

export type ClaudeUsageStatus = {
  limits: ClaudeUsageLimit[];
  extraUsage: ClaudeExtraUsage | null;
};

const ANTHROPIC_BETA_HEADER = "oauth-2025-04-20";
const USAGE_ENDPOINT = "https://api.anthropic.com/api/oauth/usage";
/** Same undocumented account-usage endpoint the official Claude Code CLI/desktop app and
 *  third-party "Claude usage" status bar tools read from — a plain authenticated GET, so
 *  (unlike sending a real model request just to read its rate-limit response headers) checking
 *  this doesn't consume any of the user's own usage. */
const CACHE_TTL_MS = 30_000;

let cache: { status: ClaudeUsageStatus; fetchedAt: number } | null = null;

function getCredentialsPath(): string {
  return path.join(os.homedir(), ".claude", ".credentials.json");
}

/** Never returned to the caller — only the token string is read out of this file in memory, used
 *  once for the Authorization header below, and discarded; the file itself (and its refresh
 *  token) never leaves this function. */
async function readAccessToken(): Promise<string> {
  let raw: string;
  try {
    raw = await readFile(getCredentialsPath(), "utf-8");
  } catch {
    throw new Error(`Could not find Claude's login credentials — run "claude" and sign in first.`);
  }

  let parsed: { claudeAiOauth?: { accessToken?: string } };
  try {
    parsed = JSON.parse(raw) as { claudeAiOauth?: { accessToken?: string } };
  } catch {
    throw new Error("Claude's credentials file is unreadable.");
  }

  const token = parsed.claudeAiOauth?.accessToken;
  if (!token) {
    throw new Error(`No Claude login token found — run "claude" and sign in first.`);
  }
  return token;
}

/**
 * Fetches the account's current usage-limit status (session/weekly percentages, reset times,
 * extra-usage credits) — same data source recent Claude Code versions use for their own status
 * line. Cached briefly (30s) since the frontend may re-fetch on every mount; `forceRefresh` (the
 * header widget's manual refresh button) bypasses that.
 */
export async function getClaudeUsageStatus(forceRefresh = false): Promise<ClaudeUsageStatus> {
  if (!forceRefresh && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.status;
  }

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
    throw new Error(
      `Could not reach Anthropic's usage endpoint: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(`Claude's login token has expired — run "claude" once to refresh it.`);
    }
    throw new Error(`Could not fetch usage (HTTP ${response.status}).`);
  }

  // A 200 response with an empty or non-JSON body has been observed for accounts with nothing
  // to report yet (e.g. never made a request in the current 5h/7d window) — treated as "no usage
  // data yet" (empty limits) rather than letting `response.json()`'s parse failure bubble up as a
  // raw, scary "Unexpected end of JSON input" error toast.
  const rawBody = await response.text();
  let data: RawUsageResponse;
  try {
    data = rawBody.trim() ? (JSON.parse(rawBody) as RawUsageResponse) : {};
  } catch {
    data = {};
  }

  const limits: ClaudeUsageLimit[] = (data.limits ?? []).flatMap((limit) => {
    if (typeof limit.kind !== "string" || typeof limit.group !== "string" || typeof limit.percent !== "number") {
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

  const status: ClaudeUsageStatus = { limits, extraUsage };
  cache = { status, fetchedAt: Date.now() };
  return status;
}
