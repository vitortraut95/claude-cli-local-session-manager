import type { PullRequest, ReviewFinding, ReviewerState } from "./types.js";

/**
 * Bitbucket Cloud client for the board watcher (REST 2.0, basic auth with an Atlassian API
 * token). The writes (a review comment, an approval) first check the PR is still at the commit
 * that was reviewed. The API doesn't say whether a PR has merge conflicts, so `hasConflicts` is
 * false here; `conflicts.ts` fills it in from the local clone.
 */

export type BitbucketCredentials = { workspace: string; email: string; token: string };

type RawPullRequest = {
  id: number;
  title: string;
  draft?: boolean;
  created_on: string;
  author?: { account_id?: string };
  source?: { commit?: { hash?: string }; branch?: { name?: string } };
  destination?: { branch?: { name?: string } };
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
  "values.source.branch.name",
  "values.destination.branch.name",
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

async function request(
  credentials: BitbucketCredentials,
  url: string,
  body?: unknown,
): Promise<Response> {
  const auth = Buffer.from(`${credentials.email}:${credentials.token}`).toString("base64");
  const response = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Bitbucket ${new URL(url).pathname} answered ${response.status}.`);
  }
  return response;
}

async function get<T>(credentials: BitbucketCredentials, url: string): Promise<T> {
  return (await (await request(credentials, url)).json()) as T;
}

function pullRequestUrl(credentials: BitbucketCredentials, pr: PullRequest): string {
  return `https://api.bitbucket.org/2.0/repositories/${credentials.workspace}/${pr.repo}/pullrequests/${pr.id}`;
}

/** The PR's state now ("OPEN", "MERGED"…) and its latest commit. */
export async function pullRequestHead(
  credentials: BitbucketCredentials,
  pr: PullRequest,
): Promise<{ state: string; hash: string | null }> {
  const current = await get<{ state?: string; source?: { commit?: { hash?: string } } }>(
    credentials,
    `${pullRequestUrl(credentials, pr)}?fields=state,source.commit.hash`,
  );
  return { state: current.state ?? "gone", hash: current.source?.commit?.hash ?? null };
}

/** Bitbucket shortens hashes to 12 characters; either side may be the short one. */
export function sameCommit(a: string | null | undefined, b: string | null | undefined): boolean {
  return !a || !b || a.startsWith(b) || b.startsWith(a);
}

/** Throws when the PR got a new push (or was closed) since `pr` was read: what was reviewed is
 *  no longer what would be commented on or approved. */
async function assertUnchanged(credentials: BitbucketCredentials, pr: PullRequest): Promise<void> {
  const { state, hash } = await pullRequestHead(credentials, pr);
  if (state !== "OPEN") throw new Error(`${pr.repo}#${pr.id} is ${state}.`);
  if (!sameCommit(pr.sourceHash, hash)) {
    throw new Error(`${pr.repo}#${pr.id} got a new push since the review.`);
  }
}

/** A review finding as a PR comment: inline on its line when it has one, falling back to a
 *  general comment naming the place (a line outside the diff can't take an inline comment). */
export async function commentOnPullRequest(
  credentials: BitbucketCredentials,
  pr: PullRequest,
  finding: ReviewFinding,
): Promise<void> {
  await assertUnchanged(credentials, pr);
  const url = `${pullRequestUrl(credentials, pr)}/comments`;
  if (finding.file && finding.line) {
    const inline = {
      content: { raw: finding.body },
      inline: { path: finding.file, to: finding.line },
    };
    const posted = await request(credentials, url, inline).then(
      () => true,
      () => false,
    );
    if (posted) return;
  }
  const where = finding.file
    ? `\`${finding.file}${finding.line ? `:${finding.line}` : ""}\`: `
    : "";
  await request(credentials, url, { content: { raw: `${where}${finding.body}` } });
}

export async function approvePullRequest(
  credentials: BitbucketCredentials,
  pr: PullRequest,
): Promise<void> {
  await assertUnchanged(credentials, pr);
  await request(credentials, `${pullRequestUrl(credentials, pr)}/approve`, {});
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
    sourceBranch: raw.source?.branch?.name,
    destinationBranch: raw.destination?.branch?.name,
    sourceHash: hash,
  };
}

type RawActivity = {
  approval?: { date: string; user?: { account_id?: string } };
  update?: { date: string; source?: { commit?: { hash?: string } } };
};

/** Sets `approvedCommit` on the PRs `me` approved before their latest push: the head at the
 *  time of the approval is the last update (push) before it. */
export async function markStaleApprovals(
  credentials: BitbucketCredentials,
  prs: PullRequest[],
  me: string,
): Promise<void> {
  const approved = prs.filter((pr) =>
    pr.reviewers.some((r) => r.id === me && r.state === "approved"),
  );
  await Promise.all(
    approved.map(async (pr) => {
      const page = await get<{ values?: RawActivity[] }>(
        credentials,
        `${pullRequestUrl(credentials, pr)}/activity?pagelen=50`,
      );
      const activity = page.values ?? [];
      const approvedAt = activity
        .map((a) => a.approval)
        .filter((a) => a?.user?.account_id === me)
        .map((a) => Date.parse(a?.date ?? ""))
        .sort((a, b) => b - a)[0];
      if (!approvedAt) return;
      const hash = activity
        .map((a) => a.update)
        .filter((u) => u && Date.parse(u.date) <= approvedAt)
        .sort((a, b) => Date.parse(b?.date ?? "") - Date.parse(a?.date ?? ""))[0]?.source?.commit
        ?.hash;
      if (hash && !sameCommit(hash, pr.sourceHash)) pr.approvedCommit = hash;
    }),
  );
}

/** The PRs (open or merged) of `repos` whose title or source branch has `key`, newest first:
 *  where a ticket's code lives, even when nobody linked the PR on the ticket. */
export async function findPullRequestsForKey(
  credentials: BitbucketCredentials,
  repos: string[],
  key: string,
): Promise<{ repo: string; branch: string }[]> {
  const query = `title ~ "${key}" OR source.branch.name ~ "${key}"`;
  const found = await Promise.all(
    repos.map(async (repo) => {
      const page = await get<{ values?: { source?: { branch?: { name?: string } } }[] }>(
        credentials,
        `https://api.bitbucket.org/2.0/repositories/${credentials.workspace}/${repo}/pullrequests` +
          `?q=${encodeURIComponent(query)}&state=OPEN&state=MERGED&sort=-updated_on&pagelen=5` +
          `&fields=values.source.branch.name`,
      );
      return (page.values ?? [])
        .map((pr) => pr.source?.branch?.name ?? "")
        .filter(Boolean)
        .map((branch) => ({ repo, branch }));
    }),
  );
  return found.flat();
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
