import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { REPO_ROOT } from "./repoRoot.js";

/**
 * Local record of the base branch a "New task" branch was branched off, stored in this app's own
 * gitignored sidecar file at the repo root — same pattern as
 * `nicknames.ts`/`sessionContinuations.ts`/`userPreferences.json`. Nested by repo root, then by
 * branch name (`{ [repoRoot]: { [branch]: entry } }`) rather than by worktree path: a branch name
 * is unique within a repo regardless of whether the task used a worktree or checked the branch out
 * directly in the repo root (the "skip worktree" checkbox) — unlike a worktree-path key, this
 * covers both, since a plain branch name can't collide the way a shared root directory would.
 *
 * Only written when the chosen base branch differs from the repo's own resolved default (see
 * `getDefaultBaseBranch` in git.ts) — the common case (branching off main/master) needs no entry at
 * all, since that's already what the "Open PR" button's default compare link assumes. This keeps
 * the file's size tied to "branches ever created off a non-default base", not every task ever
 * created.
 *
 * Cleaned up once the branch itself is gone — `deleteSessionWorktree`/`removeWorktreeAndCheckoutRoot`
 * (worktree-backed tasks) and `deleteSessionBranch` (the non-worktree "delete branch" action) in
 * sessionService.ts each best-effort forget the entry right after their respective git branch
 * deletion succeeds, so this sidecar can't accumulate entries for branches that no longer exist —
 * unlike `nicknames.ts`/`sessionContinuations.ts`, which have no such cleanup today (see CLAUDE.md).
 */
export type BaseBranchEntry = {
  baseBranch: string;
  createdAt: string;
};

type TaskBaseBranches = Record<string, Record<string, BaseBranchEntry>>;

function getTaskBaseBranchesPath(): string {
  return path.join(REPO_ROOT, "task-base-branches.json");
}

export async function getTaskBaseBranches(): Promise<TaskBaseBranches> {
  try {
    const raw = await readFile(getTaskBaseBranchesPath(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as TaskBaseBranches;
    }
    return {};
  } catch {
    return {};
  }
}

export async function recordTaskBaseBranch(
  repoRoot: string,
  branchName: string,
  baseBranch: string,
): Promise<void> {
  const entries = await getTaskBaseBranches();
  entries[repoRoot] = {
    ...entries[repoRoot],
    [branchName]: { baseBranch, createdAt: new Date().toISOString() },
  };
  await writeFile(getTaskBaseBranchesPath(), JSON.stringify(entries, null, 2), "utf8");
}

export async function forgetTaskBaseBranch(repoRoot: string, branchName: string): Promise<void> {
  const entries = await getTaskBaseBranches();
  if (!entries[repoRoot]?.[branchName]) return;

  delete entries[repoRoot][branchName];
  if (Object.keys(entries[repoRoot]).length === 0) {
    delete entries[repoRoot];
  }
  await writeFile(getTaskBaseBranchesPath(), JSON.stringify(entries, null, 2), "utf8");
}
