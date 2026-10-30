import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import { REPO_ROOT } from "../../utils/repoRoot.js";
import { bitbucketCredentialsFromEnv, listOpenPullRequests } from "./bitbucket.js";
import type { BoardWatcherConfig } from "./config.js";
import { noticePause } from "./instantNotices.js";
import { jiraCredentialsFromEnv, searchIssues } from "./jira.js";
import { prSubject, type BoardIssue, type PullRequest, type WatcherDeps } from "./types.js";

/**
 * Simulation mode: the real board and PRs are read, and every write the watcher would make is
 * appended to the gitignored `boardWatcher-actions.jsonl` instead (one JSON object per line),
 * which the digest is built from. Nothing reaches Jira, Bitbucket or the task queue.
 */

export const ACTIONS_FILE = path.join(REPO_ROOT, "boardWatcher-actions.jsonl");

export type ActionEntry = {
  ts: string;
  action:
    | "enqueue-dev"
    | "claim-test"
    | "review"
    | "reviewed"
    | "review-failed"
    | "tested"
    | "test-failed"
    | "comment"
    | "approve"
    | "notify";
  subject: string;
  /** The issue summary or PR title, for the digest. */
  title: string;
  detail?: string;
};

export async function readActions(since: Date): Promise<ActionEntry[]> {
  const raw = await readFile(ACTIONS_FILE, "utf8").catch(() => "");
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ActionEntry)
    .filter((entry) => Date.parse(entry.ts) >= since.getTime());
}

export async function recordAction(
  entry: Omit<ActionEntry, "ts">,
  now = new Date(),
): Promise<void> {
  await appendFile(
    ACTIONS_FILE,
    `${JSON.stringify({ ts: now.toISOString(), ...entry })}\n`,
    "utf8",
  );
}

/** `onReview` / `onTest` take a PR due for review / a claimed ticket (a real session runs it
 *  later); without them it's only recorded. */
export function createSimulationDeps(
  config: BoardWatcherConfig,
  now: () => Date,
  onReview?: (pr: PullRequest) => void,
  onTest?: (issue: BoardIssue) => void,
): WatcherDeps {
  if (!config.jira || !config.bitbucket) {
    throw new Error('boardWatcher.json needs "jira" and "bitbucket" for simulation mode.');
  }
  const { jira, bitbucket } = config;
  const jiraCredentials = jiraCredentialsFromEnv(jira.site);
  const bitbucketCredentials = bitbucketCredentialsFromEnv(bitbucket.workspace);
  const titles = new Map<string, string>();
  const issuesByKey = new Map<string, BoardIssue>();
  const statusIds = [
    ...config.columns.todo,
    ...config.columns.waitTest,
    ...config.columns.testing,
  ].join(",");

  const record = (entry: Omit<ActionEntry, "ts" | "title"> & { title?: string }) =>
    recordAction({ title: titles.get(entry.subject) ?? "", ...entry }, now());

  return {
    board: {
      listIssues: async () => {
        const issues = await searchIssues(
          jiraCredentials,
          `(${jira.scopeJql}) AND sprint in openSprints() AND status in (${statusIds})`,
          300,
        );
        for (const issue of issues) {
          titles.set(issue.key, issue.summary);
          issuesByKey.set(issue.key, issue);
        }
        return issues;
      },
      // A claim is a transition followed by an enqueue; the enqueue records it.
      transition: () => Promise.resolve(),
    },
    codeHost: {
      listPullRequests: async () => {
        const prs = await listOpenPullRequests(bitbucketCredentials, bitbucket.repos);
        for (const pr of prs) titles.set(prSubject(pr), pr.title);
        return prs;
      },
      comment: (pr, finding) =>
        record({
          action: "comment",
          subject: prSubject(pr),
          title: pr.title,
          detail: `${finding.file ? `${finding.file}${finding.line ? `:${finding.line}` : ""} — ` : ""}${finding.body}`,
        }),
      approve: (pr) => record({ action: "approve", subject: prSubject(pr), title: pr.title }),
    },
    reviewer: {
      review: async (pr) => {
        await record({ action: "review", subject: prSubject(pr) });
        onReview?.(pr);
        return null;
      },
    },
    notifier: {
      notify: async (level, title, text) => {
        await record({ action: "notify", subject: title, detail: `${level}: ${text}` });
        if (level === "urgent") await noticePause(title, text);
      },
    },
    tasks: {
      enqueue: async (key, kind) => {
        await record({ action: kind === "dev" ? "enqueue-dev" : "claim-test", subject: key });
        const issue = issuesByKey.get(key);
        if (kind === "test" && issue) onTest?.(issue);
      },
    },
  };
}
