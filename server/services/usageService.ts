import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AppError, errorMessage } from "../utils/httpError.js";

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
  /** e.g. "session", "weekly_all", "weekly_opus" — whatever the usage API reports (not an enum). */
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
/** Undocumented account-usage endpoint used by Claude Code's status line; reading it doesn't
 *  consume usage. */
const CACHE_TTL_MS = 30_000;

let cache: { status: ClaudeUsageStatus; fetchedAt: number } | null = null;

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

/** Current usage-limit status (percentages, reset times, extra-usage credits), cached for 30s
 *  unless `forceRefresh`. */
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
    throw new AppError("USAGE_FETCH_FAILED", `Could not fetch usage (HTTP ${response.status}).`);
  }

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

  const status: ClaudeUsageStatus = { limits, extraUsage };
  cache = { status, fetchedAt: Date.now() };
  return status;
}
