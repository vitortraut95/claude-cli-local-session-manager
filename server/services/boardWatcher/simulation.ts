import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import { REPO_ROOT } from "../../utils/repoRoot.js";
import { bitbucketCredentialsFromEnv, listOpenPullRequests } from "./bitbucket.js";
import type { BoardWatcherConfig } from "./config.js";
import { jiraCredentialsFromEnv, searchIssues } from "./jira.js";
import { prSubject, type WatcherDeps } from "./types.js";

/**
 * Simulation mode: the real board and PRs are read, and every write the watcher would make is
 * appended to the gitignored `boardWatcher-actions.jsonl` instead (one JSON object per line),
 * which the digest is built from. Nothing reaches Jira, Bitbucket or the task queue.
 */

export const ACTIONS_FILE = path.join(REPO_ROOT, "boardWatcher-actions.jsonl");

export type ActionEntry = {
  ts: string;
  action: "enqueue-dev" | "claim-test" | "review" | "comment" | "approve" | "notify";
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

export function createSimulationDeps(config: BoardWatcherConfig, now: () => Date): WatcherDeps {
  if (!config.jira || !config.bitbucket) {
    throw new Error('boardWatcher.json needs "jira" and "bitbucket" for simulation mode.');
  }
  const { jira, bitbucket } = config;
  const jiraCredentials = jiraCredentialsFromEnv(jira.site);
  const bitbucketCredentials = bitbucketCredentialsFromEnv(bitbucket.workspace);
  const titles = new Map<string, string>();
  const statusIds = [
    ...config.columns.todo,
    ...config.columns.waitTest,
    ...config.columns.testing,
  ].join(",");

  const record = async (entry: Omit<ActionEntry, "ts" | "title">) => {
    const line: ActionEntry = {
      ts: now().toISOString(),
      title: titles.get(entry.subject) ?? "",
      ...entry,
    };
    await appendFile(ACTIONS_FILE, `${JSON.stringify(line)}\n`, "utf8");
  };

  return {
    board: {
      listIssues: async () => {
        const issues = await searchIssues(
          jiraCredentials,
          `(${jira.scopeJql}) AND sprint in openSprints() AND status in (${statusIds})`,
          300,
        );
        for (const issue of issues) titles.set(issue.key, issue.summary);
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
        record({ action: "comment", subject: prSubject(pr), detail: finding.body }),
      approve: (pr) => record({ action: "approve", subject: prSubject(pr) }),
    },
    reviewer: {
      review: async (pr) => {
        await record({ action: "review", subject: prSubject(pr) });
        return null;
      },
    },
    notifier: {
      notify: (level, title, text) =>
        record({ action: "notify", subject: title, detail: `${level}: ${text}` }),
    },
    tasks: {
      enqueue: (key, kind) =>
        record({ action: kind === "dev" ? "enqueue-dev" : "claim-test", subject: key }),
    },
  };
}
