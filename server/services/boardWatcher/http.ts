/**
 * The one door to Jira, Bitbucket and Jenkins: counts every call per service (the Board shows the
 * last look's, against Bitbucket's hourly limit) and retries what's worth retrying, a rate limit
 * (429) or a passing server error (502/503/504) or network failure, with a growing wait
 * (`Retry-After` when given). Writes are only retried on 429, which means they weren't done.
 */

export type ApiService = "jira" | "bitbucket" | "jenkins";

const MAX_ATTEMPTS = 3;
const MAX_WAIT_MS = 30_000;
const RETRY_STATUSES = new Set([429, 502, 503, 504]);

let calls: Record<ApiService, number> = { jira: 0, bitbucket: 0, jenkins: 0 };
let retries = 0;

/** The calls (and retries) since the last reset, then starts counting again. */
export function takeCallCounts(): { calls: Record<ApiService, number>; retries: number } {
  const taken = { calls, retries };
  calls = { jira: 0, bitbucket: 0, jenkins: 0 };
  retries = 0;
  return taken;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function waitFor(response: Response | null, attempt: number): number {
  const retryAfter = Number(response?.headers.get("retry-after"));
  const ms =
    Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 1000;
  return Math.min(ms, MAX_WAIT_MS);
}

export async function apiFetch(
  service: ApiService,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const isRead = (init.method ?? "GET") === "GET";
  for (let attempt = 1; ; attempt += 1) {
    calls[service] += 1;
    let response: Response | null = null;
    try {
      response = await fetch(url, init);
    } catch (err) {
      if (!isRead || attempt >= MAX_ATTEMPTS) throw err;
    }
    const retryable =
      response === null ||
      (RETRY_STATUSES.has(response.status) && (isRead || response.status === 429));
    if (!retryable || attempt >= MAX_ATTEMPTS) {
      if (response) return response;
      throw new Error(`${service} didn't answer.`);
    }
    retries += 1;
    await sleep(waitFor(response, attempt));
  }
}
