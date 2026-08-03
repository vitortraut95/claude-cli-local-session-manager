import path from "node:path";
import { directoryExists, listSessions } from "./sessionService.js";
import { getKnownProjectFolders } from "./taskService.js";
import {
  getDefaultBaseBranch,
  hasUncommittedChanges,
  isBranchMerged,
  listWorktrees,
  pruneWorktrees,
  removeWorktreeAndBranch,
  type WorktreeEntry,
} from "../utils/git.js";

export type CleanupFinding = {
  id: string;
  kind: "prune-worktrees" | "remove-merged-worktree";
  title: string;
  description: string;
  command: string;
  repoRoot: string;
  /** Only set for `remove-merged-worktree`; null for `prune-worktrees`. */
  worktreePath: string | null;
  branch: string | null;
};

/**
 * Scans every known project (same repo roots the "new task" folder dropdown offers, see
 * `getKnownProjectFolders`) for two kinds of local, one-click-safe worktree cleanup:
 *
 * 1. `prune-worktrees` — a linked worktree's directory was deleted by hand (outside this app),
 *    leaving git's own bookkeeping still pointing at it. Fixing this never touches real files.
 * 2. `remove-merged-worktree` — a linked worktree whose branch is already fully merged into the
 *    repo's default branch, has no uncommitted changes, and isn't backing an active session right
 *    now. Deleting it can't lose any work, by the same test `git branch -d` (not `-D`) uses.
 *
 * Everything here is local-only (no network fetch) and re-validated again in
 * `executeCleanupFinding` right before acting, since the scan and the click can be minutes apart.
 */
export async function scanForCleanupFindings(): Promise<CleanupFinding[]> {
  const [projectFolders, sessions] = await Promise.all([getKnownProjectFolders(), listSessions()]);
  const activeWorktreePaths = new Set(
    sessions
      .filter((s) => s.isActive && s.workingDirectory)
      .map((s) => path.resolve(s.workingDirectory!)),
  );

  const findings: CleanupFinding[] = [];

  for (const { path: repoRoot } of projectFolders) {
    let entries: WorktreeEntry[];
    try {
      entries = await listWorktrees(repoRoot);
    } catch {
      continue; // repoRoot vanished, or isn't a git repo anymore
    }

    const linked = entries.filter((entry) => path.resolve(entry.path) !== path.resolve(repoRoot));

    const staleEntries: WorktreeEntry[] = [];
    for (const entry of linked) {
      if (!(await directoryExists(entry.path))) staleEntries.push(entry);
    }
    if (staleEntries.length > 0) {
      findings.push({
        id: `prune:${repoRoot}`,
        kind: "prune-worktrees",
        title: `Worktrees deleted manually in "${path.basename(repoRoot)}"`,
        description:
          `${staleEntries.length} worktree(s) (${staleEntries
            .map((entry) => entry.branch ?? "?")
            .join(", ")}) were deleted directly on disk, outside the app — git still keeps their ` +
          `record. This only cleans up that internal record, without deleting anything.`,
        command: `git worktree prune`,
        repoRoot,
        worktreePath: null,
        branch: null,
      });
    }

    let defaultBranch: string | null = null;
    for (const entry of linked) {
      if (!entry.branch) continue;
      if (staleEntries.includes(entry)) continue;
      if (activeWorktreePaths.has(path.resolve(entry.path))) continue;

      defaultBranch ??= await getDefaultBaseBranch(repoRoot).catch(() => null);
      if (!defaultBranch || entry.branch === defaultBranch) continue;

      const [merged, dirty] = await Promise.all([
        isBranchMerged(repoRoot, entry.branch, defaultBranch),
        hasUncommittedChanges(entry.path).catch(() => true),
      ]);
      if (!merged || dirty) continue;

      findings.push({
        id: `remove:${entry.path}`,
        kind: "remove-merged-worktree",
        title: `Worktree "${entry.branch}" already merged`,
        description:
          `Branch "${entry.branch}" is already merged into "${defaultBranch}" and the worktree ` +
          `has no active session or pending changes. The worktree and local branch can be safely ` +
          `removed.`,
        command: `git worktree remove ${entry.path} && git branch -D ${entry.branch}`,
        repoRoot,
        worktreePath: entry.path,
        branch: entry.branch,
      });
    }
  }

  return findings;
}

/**
 * Re-validates the specific finding's conditions from scratch (not just a lookup by `id` in a
 * fresh scan) before acting — the scan that produced it may be stale by the time the user clicks,
 * e.g. a session started in that worktree, or someone committed a fix in the meantime.
 */
export async function executeCleanupFinding(finding: CleanupFinding): Promise<void> {
  if (finding.kind === "prune-worktrees") {
    await pruneWorktrees(finding.repoRoot);
    return;
  }

  const { worktreePath, branch, repoRoot } = finding;
  if (!worktreePath || !branch) {
    throw new Error("Missing worktree path or branch for this cleanup item.");
  }

  if (!(await directoryExists(worktreePath))) {
    throw new Error(`"${worktreePath}" no longer exists — refresh the list.`);
  }

  const defaultBranch = await getDefaultBaseBranch(repoRoot);
  if (!(await isBranchMerged(repoRoot, branch, defaultBranch))) {
    throw new Error(
      `Branch "${branch}" is no longer merged into "${defaultBranch}" — cancelled for safety.`,
    );
  }
  if (await hasUncommittedChanges(worktreePath)) {
    throw new Error(`"${worktreePath}" now has uncommitted changes — cancelled for safety.`);
  }

  const sessions = await listSessions();
  const target = path.resolve(worktreePath);
  const isActive = sessions.some(
    (s) => s.isActive && s.workingDirectory && path.resolve(s.workingDirectory) === target,
  );
  if (isActive) {
    throw new Error(`A session is active in "${worktreePath}" right now — cancelled for safety.`);
  }

  await removeWorktreeAndBranch(worktreePath);
}
