import { apiFetch } from "./http.js";
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
  updated_on?: string;
  author?: { account_id?: string };
  source?: { commit?: { hash?: string }; branch?: { name?: string } };
  destination?: { branch?: { name?: string }; commit?: { hash?: string } };
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
  "values.updated_on",
  "values.author.account_id",
  "values.source.commit.hash",
  "values.source.branch.name",
  "values.destination.branch.name",
  "values.destination.commit.hash",
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
  const response = await apiFetch("bitbucket", url, {
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

/**
 * Caches that spare repeated calls between looks: what a commit is doesn't change (its date, a
 * finished build's statuses), and a ticket's PRs or a PR's approval history move slowly enough
 * for a short TTL. Process-local; a restart just refills them.
 */
const MAX_CACHED = 2000;
const commitDates = new Map<string, string>();
const finishedStatuses = new Map<string, { state: string; name?: string; url?: string; updated_on?: string }[]>();

function remember<V>(cache: Map<string, V>, key: string, value: V): V {
  const oldest = cache.keys().next().value;
  if (cache.size >= MAX_CACHED && oldest !== undefined) cache.delete(oldest);
  cache.set(key, value);
  return value;
}

async function commitDate(
  credentials: BitbucketCredentials,
  base: string,
  hash: string,
): Promise<string | undefined> {
  const cached = commitDates.get(hash);
  if (cached) return cached;
  const { date } = await get<{ date?: string }>(credentials, `${base}/commit/${hash}?fields=date`);
  return date ? remember(commitDates, hash, date) : undefined;
}

/** A commit's build statuses; kept once every build on it finished. */
async function commitStatuses(
  credentials: BitbucketCredentials,
  base: string,
  hash: string,
): Promise<{ state: string; name?: string; url?: string; updated_on?: string }[]> {
  const cached = finishedStatuses.get(hash);
  if (cached) return cached;
  const { values = [] } = await get<{
    values?: { state: string; name?: string; url?: string; updated_on?: string }[];
  }>(
    credentials,
    `${base}/commit/${hash}/statuses?pagelen=50&fields=values.state,values.name,values.url,values.updated_on`,
  );
  if (values.length > 0 && !values.some((s) => s.state === "INPROGRESS")) {
    remember(finishedStatuses, hash, values);
  }
  return values;
}

function failedBuildOf(
  statuses: { state: string; name?: string; url?: string; updated_on?: string }[],
): PullRequest["failedBuild"] {
  const failed = statuses.find((s) => (s.state === "FAILED" || s.state === "STOPPED") && s.url);
  return failed?.url ? { url: failed.url, name: failed.name ?? "" } : undefined;
}

async function toPullRequest(
  credentials: BitbucketCredentials,
  repo: string,
  raw: RawPullRequest,
): Promise<PullRequest> {
  const base = `https://api.bitbucket.org/2.0/repositories/${credentials.workspace}/${repo}`;
  const hash = raw.source?.commit?.hash;
  const [date, statuses] = hash
    ? await Promise.all([
        commitDate(credentials, base, hash),
        commitStatuses(credentials, base, hash),
      ])
    : [undefined, []];
  return {
    id: String(raw.id),
    repo,
    title: raw.title,
    authorId: raw.author?.account_id ?? "",
    createdAt: raw.created_on,
    updatedAt: raw.updated_on,
    lastPushAt: date ?? raw.created_on,
    draft: raw.draft ?? false,
    reviewers: (raw.participants ?? [])
      .filter((p) => p.role === "REVIEWER" && p.user?.account_id)
      .map((p) => ({ id: p.user?.account_id ?? "", state: reviewerState(p.state) })),
    ci: ciState(statuses.map((s) => s.state)),
    failedBuild: failedBuildOf(statuses),
    hasConflicts: false,
    sourceBranch: raw.source?.branch?.name,
    destinationBranch: raw.destination?.branch?.name,
    destinationHash: raw.destination?.commit?.hash,
    sourceHash: hash,
  };
}

type RawActivity = {
  approval?: { date: string; user?: { account_id?: string } };
  update?: { date: string; source?: { commit?: { hash?: string } } };
};

/** Per PR and head: the commit the user approved when it's an earlier one. Re-read after the TTL
 *  so an approval of the new head clears it. */
const STALE_APPROVAL_TTL_MS = 60 * 60_000;
const staleApprovals = new Map<string, { at: number; commit: string | null }>();

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
      const key = `${pr.repo}#${pr.id}@${pr.sourceHash ?? ""}`;
      const cached = staleApprovals.get(key);
      if (cached && Date.now() - cached.at < STALE_APPROVAL_TTL_MS) {
        if (cached.commit) pr.approvedCommit = cached.commit;
        return;
      }
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
        .sort((a, b) => Date.parse(b?.date ?? "") - Date.parse(a?.date ?? ""))[0]?.source
        ?.commit?.hash;
      const commit = hash && !sameCommit(hash, pr.sourceHash) ? hash : null;
      remember(staleApprovals, key, { at: Date.now(), commit });
      if (commit) pr.approvedCommit = commit;
    }),
  );
}

export type PullRequestNews = {
  comments: { author: string; body: string; file?: string; line?: number; at: string }[];
  /** Who asked for changes since `since`. */
  changesRequested: string[];
};

/** What others said on a PR after `since`: their comments (newest last) and requests for
 *  changes. */
export async function pullRequestNews(
  credentials: BitbucketCredentials,
  pr: PullRequest,
  since: string,
  me: string,
): Promise<PullRequestNews> {
  const url = pullRequestUrl(credentials, pr);
  const query = encodeURIComponent(`created_on > ${since}`);
  const [comments, activity] = await Promise.all([
    get<{
      values?: {
        created_on: string;
        deleted?: boolean;
        content?: { raw?: string };
        inline?: { path?: string; to?: number | null };
        user?: { account_id?: string; display_name?: string };
      }[];
    }>(
      credentials,
      `${url}/comments?q=${query}&sort=created_on&pagelen=50` +
        "&fields=values.created_on,values.deleted,values.content.raw,values.inline," +
        "values.user.account_id,values.user.display_name",
    ),
    get<{
      values?: {
        changes_requested?: { date: string; user?: { account_id?: string; display_name?: string } };
      }[];
    }>(credentials, `${url}/activity?pagelen=50`),
  ]);
  const byOthers = <T extends { user?: { account_id?: string } }>(item: T) =>
    item.user?.account_id !== undefined && item.user.account_id !== me;
  return {
    comments: (comments.values ?? [])
      .filter((c) => !c.deleted && c.content?.raw?.trim() && byOthers(c))
      .map((c) => ({
        author: c.user?.display_name ?? "",
        body: c.content?.raw ?? "",
        file: c.inline?.path,
        line: c.inline?.to ?? undefined,
        at: c.created_on,
      })),
    changesRequested: [
      ...new Set(
        (activity.values ?? [])
          .map((a) => a.changes_requested)
          .filter((c) => c && Date.parse(c.date) > Date.parse(since) && byOthers(c))
          .map((c) => c?.user?.display_name ?? ""),
      ),
    ],
  };
}

export type PullRequestRef = { repo: string; id: string; title: string; at: string };

/** The PRs updated since `since` that `me` opened or approved, with when (approval: their last
 *  participation). */
export async function pullRequestsTouchedBy(
  credentials: BitbucketCredentials,
  repos: string[],
  me: string,
  since: string,
): Promise<{ opened: PullRequestRef[]; approved: PullRequestRef[] }> {
  const query = encodeURIComponent(`updated_on > ${since}`);
  const pages = await Promise.all(
    repos.map(async (repo) => {
      const page = await get<{
        values?: {
          id: number;
          title: string;
          created_on: string;
          author?: { account_id?: string };
          participants?: {
            state?: string | null;
            participated_on?: string | null;
            user?: { account_id?: string };
          }[];
        }[];
      }>(
        credentials,
        `https://api.bitbucket.org/2.0/repositories/${credentials.workspace}/${repo}/pullrequests` +
          `?q=${query}&state=OPEN&state=MERGED&state=DECLINED&pagelen=50` +
          "&fields=values.id,values.title,values.created_on,values.author.account_id," +
          "values.participants.state,values.participants.participated_on," +
          "values.participants.user.account_id",
      );
      return (page.values ?? []).map((pr) => ({ repo, ...pr }));
    }),
  );
  const prs = pages.flat();
  return {
    opened: prs
      .filter((pr) => pr.author?.account_id === me)
      .map((pr) => ({ repo: pr.repo, id: String(pr.id), title: pr.title, at: pr.created_on })),
    approved: prs.flatMap((pr) => {
      const mine = pr.participants?.find(
        (p) => p.user?.account_id === me && p.state === "approved",
      );
      return mine?.participated_on
        ? [{ repo: pr.repo, id: String(pr.id), title: pr.title, at: mine.participated_on }]
        : [];
    }),
  };
}

/** The build (Jenkins status) of a branch's latest commit, preferring the branch's own job over
 *  the PR's; null when the branch is gone (merged and deleted). */
export async function branchBuild(
  credentials: BitbucketCredentials,
  repo: string,
  branch: string,
): Promise<{
  ci: PullRequest["ci"];
  hash: string;
  date: string;
  failedUrl?: string;
  /** The branch's own build on its latest commit (any result). */
  url?: string;
} | null> {
  const base = `https://api.bitbucket.org/2.0/repositories/${credentials.workspace}/${repo}`;
  const ref = await get<{ target?: { hash?: string; date?: string } }>(
    credentials,
    `${base}/refs/branches/${encodeURIComponent(branch)}?fields=target.hash,target.date`,
  ).catch(() => null);
  const hash = ref?.target?.hash;
  if (!hash) return null;
  const all = await commitStatuses(credentials, base, hash);
  const own = all.filter((s) => s.name?.includes(branch));
  const relevant = own.length ? own : all;
  return {
    ci: ciState(relevant.map((s) => s.state)),
    hash,
    date: ref.target?.date ?? "",
    failedUrl: relevant.find((s) => s.state === "FAILED" || s.state === "STOPPED")?.url,
    url: own[0]?.url,
  };
}

const TICKET_PRS_TTL_MS = 30 * 60_000;
const ticketPrs = new Map<string, { at: number; prs: { repo: string; branch: string }[] }>();

/** The PRs (open or merged) of `repos` whose title or source branch has `key`, newest first:
 *  where a ticket's code lives, even when nobody linked the PR on the ticket. */
export async function findPullRequestsForKey(
  credentials: BitbucketCredentials,
  repos: string[],
  key: string,
): Promise<{ repo: string; branch: string }[]> {
  const cacheKey = `${repos.join(",")}|${key}`;
  const cached = ticketPrs.get(cacheKey);
  if (cached && Date.now() - cached.at < TICKET_PRS_TTL_MS) return cached.prs;
  const prs = await searchPullRequestsForKey(credentials, repos, key);
  remember(ticketPrs, cacheKey, { at: Date.now(), prs });
  return prs;
}

async function searchPullRequestsForKey(
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
