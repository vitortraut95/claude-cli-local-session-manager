import { adfToMarkdown } from "./adf.js";
import type { BoardIssue } from "./types.js";

/**
 * Read-only Jira Cloud client for the board watcher (REST v3, basic auth with an API token).
 * Only GETs: no transition or comment goes through here yet.
 */

export type JiraCredentials = { site: string; email: string; token: string };

/** When an issue entered and left a status; `to` is null while it's still there. */
export type StatusStay = { statusId: string; from: string; to: string | null };

export type JiraIssue = BoardIssue & { stays: StatusStay[]; createdAt: string };

type RawIssue = {
  key: string;
  fields: {
    summary?: string;
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

const FIELDS = "summary,description,status,assignee,labels,created,comment";
const PAGE_SIZE = 50;

export function jiraCredentialsFromEnv(site: string): JiraCredentials {
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  if (!email || !token) throw new Error("JIRA_EMAIL and JIRA_API_TOKEN must be set.");
  return { site, email, token };
}

async function get<T>(credentials: JiraCredentials, apiPath: string): Promise<T> {
  const auth = Buffer.from(`${credentials.email}:${credentials.token}`).toString("base64");
  const response = await fetch(`https://${credentials.site}${apiPath}`, {
    headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Jira ${apiPath.split("?")[0]} answered ${response.status}.`);
  }
  return (await response.json()) as T;
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
