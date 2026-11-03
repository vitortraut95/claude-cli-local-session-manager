import { adfToMarkdown } from "./adf.js";
import { apiFetch } from "./http.js";
import type { BoardIssue } from "./types.js";

/**
 * Jira Cloud client for the board watcher (REST v3, basic auth with an API token). The only
 * write is moving a card (`transitionIssue`), used when a claimed test goes live.
 */

export type JiraCredentials = { site: string; email: string; token: string };

/** When an issue entered and left a status; `to` is null while it's still there. */
export type StatusStay = { statusId: string; from: string; to: string | null };

export type JiraIssue = BoardIssue & { stays: StatusStay[]; createdAt: string };

type RawIssue = {
  key: string;
  fields: {
    summary?: string;
    issuetype?: { name?: string };
    description?: unknown;
    status?: { id: string };
    assignee?: { accountId: string } | null;
    labels?: string[];
    created?: string;
    comment?: {
      comments?: { id: string; author?: { accountId: string }; created: string; body: unknown }[];
    };
  };
  changelog?: {
    histories?: {
      created: string;
      items: { field: string; from: string | null; to: string | null }[];
    }[];
  };
};

const FIELDS = "summary,issuetype,description,status,assignee,labels,created,comment";
const PAGE_SIZE = 50;

export function jiraCredentialsFromEnv(site: string): JiraCredentials {
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  if (!email || !token) throw new Error("JIRA_EMAIL and JIRA_API_TOKEN must be set.");
  return { site, email, token };
}

async function request(
  credentials: JiraCredentials,
  apiPath: string,
  body?: unknown,
): Promise<Response> {
  const auth = Buffer.from(`${credentials.email}:${credentials.token}`).toString("base64");
  const response = await apiFetch("jira", `https://${credentials.site}${apiPath}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Jira ${apiPath.split("?")[0]} answered ${response.status}.`);
  }
  return response;
}

async function get<T>(credentials: JiraCredentials, apiPath: string): Promise<T> {
  return (await (await request(credentials, apiPath)).json()) as T;
}

/** Moves `key` to `statusId` through the workflow transition that leads there. */
export async function transitionIssue(
  credentials: JiraCredentials,
  key: string,
  statusId: string,
): Promise<void> {
  const apiPath = `/rest/api/3/issue/${encodeURIComponent(key)}/transitions`;
  const { transitions } = await get<{ transitions: { id: string; to?: { id: string } }[] }>(
    credentials,
    apiPath,
  );
  const transition = transitions.find((t) => t.to?.id === statusId);
  if (!transition) throw new Error(`${key} has no transition to status ${statusId}.`);
  await request(credentials, apiPath, { transition: { id: transition.id } });
}

/** The board's active sprint, or null between sprints. */
export async function activeSprint(
  credentials: JiraCredentials,
  boardId: number,
): Promise<{ id: number; name: string; startDate: string } | null> {
  const page = await get<{ values: { id: number; name: string; startDate: string }[] }>(
    credentials,
    `/rest/agile/1.0/board/${boardId}/sprint?state=active`,
  );
  return page.values[0] ?? null;
}

export type LinkedPullRequest = {
  /** "workspace/repo". */
  repo: string;
  id: string;
  title: string;
  status: "OPEN" | "MERGED" | "DECLINED";
  url: string;
};

/** The Bitbucket PRs linked to an issue (Jira's development panel: by key in title or branch). */
export async function linkedPullRequests(
  credentials: JiraCredentials,
  key: string,
): Promise<LinkedPullRequest[]> {
  const { id } = await get<{ id: string }>(credentials, `/rest/api/3/issue/${key}?fields=id`);
  const params = new URLSearchParams({
    issueId: id,
    applicationType: "bitbucket",
    dataType: "pullrequest",
  });
  const page = await get<{
    detail?: {
      pullRequests?: {
        id: string;
        name: string;
        status: LinkedPullRequest["status"];
        url: string;
        repositoryName: string;
      }[];
    }[];
  }>(credentials, `/rest/dev-status/latest/issue/detail?${params.toString()}`);
  return (page.detail ?? []).flatMap((d) =>
    (d.pullRequests ?? []).map((pr) => ({
      repo: pr.repositoryName,
      id: pr.id,
      title: pr.name,
      status: pr.status,
      url: pr.url,
    })),
  );
}

/** Every status's name by id ("10052" → "Ready for Deployment"). */
export async function statusNames(credentials: JiraCredentials): Promise<Map<string, string>> {
  const statuses = await get<{ id: string; name: string }[]>(credentials, "/rest/api/3/status");
  return new Map(statuses.map((status) => [status.id, status.name]));
}

export type StatusChange = { key: string; summary: string; at: string; from: string; to: string };

/** Status changes the user (`me`) made on issues matching `jql`, by name ("In Progress"). */
export async function statusChangesBy(
  credentials: JiraCredentials,
  jql: string,
  me: string,
): Promise<StatusChange[]> {
  const params = new URLSearchParams({
    jql,
    fields: "summary",
    expand: "changelog",
    maxResults: "50",
  });
  const page = await get<{
    issues: {
      key: string;
      fields: { summary?: string };
      changelog?: {
        histories?: {
          created: string;
          author?: { accountId?: string };
          items: { field: string; fromString?: string | null; toString?: string | null }[];
        }[];
      };
    }[];
  }>(credentials, `/rest/api/3/search/jql?${params.toString()}`);
  return page.issues.flatMap((issue) =>
    (issue.changelog?.histories ?? [])
      .filter((h) => h.author?.accountId === me)
      .flatMap((h) =>
        h.items
          .filter((item) => item.field === "status")
          .map((item) => ({
            key: issue.key,
            summary: issue.fields.summary ?? "",
            at: h.created,
            from: item.fromString ?? "",
            to: item.toString ?? "",
          })),
      ),
  );
}

/** Every issue matching `jql`, with comments and the status history, up to `limit`. */
export async function searchIssues(
  credentials: JiraCredentials,
  jql: string,
  limit = 200,
): Promise<JiraIssue[]> {
  const issues: JiraIssue[] = [];
  let pageToken: string | undefined;
  while (issues.length < limit) {
    const params = new URLSearchParams({
      jql,
      fields: FIELDS,
      expand: "changelog",
      maxResults: String(PAGE_SIZE),
    });
    if (pageToken) params.set("nextPageToken", pageToken);
    const page = await get<{ issues: RawIssue[]; nextPageToken?: string; isLast?: boolean }>(
      credentials,
      `/rest/api/3/search/jql?${params.toString()}`,
    );
    issues.push(...page.issues.map(toJiraIssue));
    if (page.isLast !== false || !page.nextPageToken) break;
    pageToken = page.nextPageToken;
  }
  return issues.slice(0, limit);
}

function toJiraIssue(raw: RawIssue): JiraIssue {
  const { fields } = raw;
  const createdAt = fields.created ?? new Date(0).toISOString();
  const statusId = fields.status?.id ?? "";
  const stays = statusStays(raw, createdAt, statusId);
  return {
    key: raw.key,
    summary: fields.summary ?? "",
    issueType: fields.issuetype?.name,
    description: adfToMarkdown(fields.description),
    statusId,
    statusSince: stays.at(-1)?.from ?? createdAt,
    assigneeId: fields.assignee?.accountId ?? null,
    labels: fields.labels ?? [],
    comments: (fields.comment?.comments ?? []).map((c) => ({
      id: c.id,
      authorId: c.author?.accountId ?? "",
      created: c.created,
      body: adfToMarkdown(c.body),
    })),
    createdAt,
    stays,
  };
}

/** Rebuilds the stays from the status changes, oldest first. */
function statusStays(raw: RawIssue, createdAt: string, currentStatus: string): StatusStay[] {
  const changes = (raw.changelog?.histories ?? [])
    .flatMap((h) =>
      h.items
        .filter((item) => item.field === "status")
        .map((item) => ({ at: h.created, from: item.from, to: item.to })),
    )
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  const stays: StatusStay[] = [];
  let since = createdAt;
  let status = changes[0]?.from ?? currentStatus;
  for (const change of changes) {
    stays.push({ statusId: status, from: since, to: change.at });
    since = change.at;
    status = change.to ?? status;
  }
  stays.push({ statusId: status, from: since, to: null });
  return stays;
}
