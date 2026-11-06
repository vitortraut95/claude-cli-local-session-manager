import path from "node:path";
import { mapWithConcurrency } from "../../utils/concurrency.js";
import { getWorkspaceRepos } from "../workspaceService.js";
import type { BoardWatcherConfig } from "./config.js";
import { issueRefs, jiraCredentialsFromEnv, linkedPullRequests } from "./jira.js";

/**
 * The repos the watcher follows: every repo with a PR (open, merged or declined) linked to an
 * issue of the board's active sprint, from Jira's development panel. Nothing to configure: a
 * new repo shows up as soon as one of the sprint's tasks gets a PR there. Each issue's PRs are
 * re-read after `ISSUE_TTL_MS`.
 */

const ISSUE_TTL_MS = 30 * 60_000;
const issuePrRepos = new Map<string, { at: number; repos: string[] }>();
let lastRepos: string[] = [];

export async function sprintRepos(config: BoardWatcherConfig): Promise<string[]> {
  if (!config.jira) return [];
  const credentials = jiraCredentialsFromEnv(config.jira.site);
  try {
    const refs = await issueRefs(
      credentials,
      `(${config.jira.scopeJql}) AND sprint in openSprints()`,
    );
    const perIssue = await mapWithConcurrency(refs, 6, async ({ id, key }) => {
      const cached = issuePrRepos.get(key);
      if (cached && Date.now() - cached.at < ISSUE_TTL_MS) return cached.repos;
      const prs = await linkedPullRequests(credentials, key, id);
      // "workspace/slug" → "slug".
      const repos = [...new Set(prs.map((pr) => pr.repo.split("/").at(-1) ?? pr.repo))];
      issuePrRepos.set(key, { at: Date.now(), repos });
      return repos;
    });
    lastRepos = [...new Set(perIssue.flat())].sort();
  } catch (err) {
    // Jira didn't answer: the last list found keeps the watcher going.
    if (lastRepos.length === 0) throw err;
    console.warn("[board-watcher] Couldn't read the sprint's repos, using the last ones:", err);
  }
  return lastRepos;
}

const CLONES_TTL_MS = 10 * 60_000;
let clones: { at: number; bySlug: Map<string, string> } | null = null;

/** The local clone of each repo: the one saved in `bitbucket.localRepos`, else the repo of the
 *  workspace folders with that folder name. Repos without a clone are left out. */
export async function localRepoPaths(
  config: BoardWatcherConfig,
  repos: string[],
): Promise<Record<string, string>> {
  if (!clones || Date.now() - clones.at > CLONES_TTL_MS) {
    const found = await getWorkspaceRepos();
    clones = { at: Date.now(), bySlug: new Map(found.map((dir) => [path.basename(dir), dir])) };
  }
  const saved = config.bitbucket?.localRepos ?? {};
  const paths: Record<string, string> = {};
  for (const repo of repos) {
    const dir = saved[repo] ?? clones.bySlug.get(repo);
    if (dir) paths[repo] = dir;
  }
  return paths;
}
