import type { PullRequest, ReviewerState } from "./types.js";

/**
 * Read-only Bitbucket Cloud client for the board watcher (REST 2.0, basic auth with an Atlassian
 * API token). Only GETs. The API doesn't say whether a PR has merge conflicts, so `hasConflicts`
 * is always false here.
 */

export type BitbucketCredentials = { workspace: string; email: string; token: string };

type RawPullRequest = {
  id: number;
  title: string;
  draft?: boolean;
  created_on: string;
  author?: { account_id?: string };
  source?: { commit?: { hash?: string } };
  participants?: {
    role: string;
    state?: string | null;
    user?: { account_id?: string };
  }[];
};

const PR_FIELDS = [
  "values.id",
  "values.title",
  "values.draft",
  "values.created_on",
  "values.author.account_id",
  "values.source.commit.hash",
  "values.participants.role",
  "values.participants.state",
  "values.participants.user.account_id",
  "next",
].join(",");

export function bitbucketCredentialsFromEnv(workspace: string): BitbucketCredentials {
  const email = process.env.BITBUCKET_EMAIL;
  const token = process.env.BITBUCKET_TOKEN;
  if (!email || !token) throw new Error("BITBUCKET_EMAIL and BITBUCKET_TOKEN must be set.");
  return { workspace, email, token };
}

async function get<T>(credentials: BitbucketCredentials, url: string): Promise<T> {
  const auth = Buffer.from(`${credentials.email}:${credentials.token}`).toString("base64");
  const response = await fetch(url, {
    headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Bitbucket ${new URL(url).pathname} answered ${response.status}.`);
  }
  return (await response.json()) as T;
}

function reviewerState(state: string | null | undefined): ReviewerState {
  if (state === "approved") return "approved";
  if (state === "changes_requested") return "changes_requested";
  return "none";
}

/** Build statuses reported on the commit (Jenkins posts them): any failure wins, then running. */
function ciState(states: string[]): PullRequest["ci"] {
  if (states.length === 0) return "none";
  if (states.some((s) => s === "FAILED" || s === "STOPPED")) return "failed";
  if (states.some((s) => s === "INPROGRESS")) return "running";
  return "passed";
}

async function toPullRequest(
  credentials: BitbucketCredentials,
  repo: string,
  raw: RawPullRequest,
): Promise<PullRequest> {
  const base = `https://api.bitbucket.org/2.0/repositories/${credentials.workspace}/${repo}`;
  const hash = raw.source?.commit?.hash;
  const [commit, statuses] = hash
    ? await Promise.all([
        get<{ date?: string }>(credentials, `${base}/commit/${hash}?fields=date`),
        get<{ values?: { state: string }[] }>(
          credentials,
          `${base}/commit/${hash}/statuses?pagelen=50&fields=values.state`,
        ),
      ])
    : [{}, {}];
  return {
    id: String(raw.id),
    repo,
    title: raw.title,
    authorId: raw.author?.account_id ?? "",
    createdAt: raw.created_on,
    lastPushAt: commit.date ?? raw.created_on,
    draft: raw.draft ?? false,
    reviewers: (raw.participants ?? [])
      .filter((p) => p.role === "REVIEWER" && p.user?.account_id)
      .map((p) => ({ id: p.user?.account_id ?? "", state: reviewerState(p.state) })),
    ci: ciState((statuses.values ?? []).map((s) => s.state)),
    hasConflicts: false,
  };
}

/** Open PRs of each repo, with their reviewers, CI state and last push. */
export async function listOpenPullRequests(
  credentials: BitbucketCredentials,
  repos: string[],
): Promise<PullRequest[]> {
  const prs: PullRequest[] = [];
  for (const repo of repos) {
    let url: string | undefined =
      `https://api.bitbucket.org/2.0/repositories/${credentials.workspace}/${repo}/pullrequests` +
      `?state=OPEN&pagelen=50&fields=${PR_FIELDS}`;
    while (url) {
      const page: { values: RawPullRequest[]; next?: string } = await get(credentials, url);
      prs.push(
        ...(await Promise.all(page.values.map((raw) => toPullRequest(credentials, repo, raw)))),
      );
      url = page.next;
    }
  }
  return prs;
}
