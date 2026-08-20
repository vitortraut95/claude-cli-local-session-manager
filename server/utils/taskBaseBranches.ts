import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { REPO_ROOT } from "./repoRoot.js";

/**
 * Local record of the base branch a "New task" worktree was branched off, stored in this app's own
 * gitignored sidecar file at the repo root — same pattern as
 * `nicknames.ts`/`sessionContinuations.ts`/`userPreferences.json`. Keyed by the worktree's
 * absolute path (not session id): the session id doesn't exist yet at worktree-creation time (the
 * CLI only writes the first transcript line once the terminal actually starts, unlike "Compact &
 * continue"'s pre-generated `--session-id`), while the worktree path is already final at that
 * point. Only ever written for `useWorktree: true` tasks — the "skip worktree" path checks the new
 * branch out directly in the repo root, which is shared/reused across unrelated future tasks in
 * that same folder, so a path-keyed entry there would misattribute a stale base branch to whatever
 * session next happens to share that root.
 *
 * Only written when the chosen base branch differs from the repo's own resolved default (see
 * `getDefaultBaseBranch` in git.ts) — the common case (branching off main/master) needs no entry at
 * all, since that's already what the "Open PR" button's default compare link assumes. This keeps
 * the file's size tied to "worktrees ever created off a non-default base", not every task ever
 * created.
 *
 * Cleaned up when the worktree itself is removed (`deleteSessionWorktree`/
 * `removeWorktreeAndCheckoutRoot` in sessionService.ts) so this can't accumulate orphaned entries
 * for worktrees that no longer exist — unlike `nicknames.ts`/`sessionContinuations.ts`, which have
 * no such cleanup today (see CLAUDE.md).
 */
export type BaseBranchEntry = {
  baseBranch: string;
  createdAt: string;
};

function getTaskBaseBranchesPath(): string {
  return path.join(REPO_ROOT, "task-base-branches.json");
}

export async function getTaskBaseBranches(): Promise<Record<string, BaseBranchEntry>> {
  try {
    const raw = await readFile(getTaskBaseBranchesPath(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, BaseBranchEntry>;
    }
    return {};
  } catch {
    return {};
  }
}

export async function recordTaskBaseBranch(worktreePath: string, baseBranch: string): Promise<void> {
  const entries = await getTaskBaseBranches();
  entries[worktreePath] = { baseBranch, createdAt: new Date().toISOString() };
  await writeFile(getTaskBaseBranchesPath(), JSON.stringify(entries, null, 2), "utf8");
}

export async function forgetTaskBaseBranch(worktreePath: string): Promise<void> {
  const entries = await getTaskBaseBranches();
  if (!(worktreePath in entries)) return;

  delete entries[worktreePath];
  await writeFile(getTaskBaseBranchesPath(), JSON.stringify(entries, null, 2), "utf8");
}
