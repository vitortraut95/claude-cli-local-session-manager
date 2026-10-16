import path from "node:path";
import type { Session, TaskRepoRef } from "../types/session.js";
import type { TaskStore } from "./taskStore.js";

type SessionForRepos = Pick<
  Session,
  "id" | "taskKey" | "repoRoot" | "gitBranch" | "baseBranch" | "isWorktree" | "workingDirectory"
>;

/**
 * Every task's repos, keyed by task key: the branches linked in `tasks.json` plus the
 * `(repoRoot, gitBranch)` of each session carrying that key, deduped. Shared by `listSessions`
 * (each card's "also in" line) and `getTaskDetails`, so both always agree.
 */
export function collectTaskRepos(
  store: TaskStore,
  sessions: SessionForRepos[],
): Map<string, TaskRepoRef[]> {
  const byTask = new Map<string, Map<string, TaskRepoRef>>();
  const reposOf = (key: string) => {
    let repos = byTask.get(key);
    if (!repos) {
      repos = new Map();
      byTask.set(key, repos);
    }
    return repos;
  };
  const repoId = (root: string, branch: string) => `${root}\0${branch}`;

  for (const [repoRoot, byBranch] of Object.entries(store.repoBranches)) {
    for (const [branch, entry] of Object.entries(byBranch)) {
      if (!entry.taskKey) continue;
      reposOf(entry.taskKey).set(repoId(repoRoot, branch), {
        repoRoot,
        project: path.basename(repoRoot),
        branch,
        baseBranch: entry.baseBranch,
        worktreePath: entry.worktreePath,
        recorded: true,
        sessionIds: [],
      });
    }
  }
  for (const session of sessions) {
    if (!session.taskKey || !session.repoRoot || !session.gitBranch) continue;
    const repos = reposOf(session.taskKey);
    const id = repoId(session.repoRoot, session.gitBranch);
    const repo = repos.get(id) ?? {
      repoRoot: session.repoRoot,
      project: path.basename(session.repoRoot),
      branch: session.gitBranch,
      baseBranch: session.baseBranch,
      worktreePath: session.isWorktree ? session.workingDirectory : null,
      recorded: false,
      sessionIds: [],
    };
    repo.sessionIds.push(session.id);
    repos.set(id, repo);
  }

  return new Map(
    [...byTask].map(([key, repos]) => [
      key,
      [...repos.values()].sort((a, b) => a.project.localeCompare(b.project)),
    ]),
  );
}
