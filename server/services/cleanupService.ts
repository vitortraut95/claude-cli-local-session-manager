import path from "node:path";
import { deleteSession, directoryExists, listSessions } from "./sessionService.js";
import { getUserPreferences } from "./preferencesService.js";
import { getKnownProjectFolders } from "./taskService.js";
import { withWorkspaceRepos } from "./workspaceService.js";
import type { Session } from "../types/session.js";
import {
  branchHasUniqueCommits,
  getDefaultBaseBranch,
  hasUncommittedChanges,
  isBranchMerged,
  listWorktrees,
  pruneWorktrees,
  removeWorktreeAndBranch,
  type WorktreeEntry,
} from "../utils/git.js";
import { AppError } from "../utils/httpError.js";

export type StaleSession = {
  id: string;
  title: string;
  updatedAt: string;
  sizeBytes: number;
};

export type CleanupFinding = {
  id: string;
  kind:
    | "prune-worktrees"
    | "remove-merged-worktree"
    | "remove-abandoned-worktree"
    | "prune-old-sessions";
  /** Structured data the client renders its own translated title/description from. */
  command: string;
  repoRoot: string;
  /** Only set for `prune-worktrees`; empty for the other kinds. */
  staleBranches: string[];
  /** Only set for `remove-merged-worktree`; null for the other kinds. */
  worktreePath: string | null;
  branch: string | null;
  /** Only set for `remove-merged-worktree`; null for the other kinds. */
  defaultBranch: string | null;
  /** Only set for `prune-old-sessions` — the sessions beyond the keep-count this finding would
   *  delete, most recent first; empty for the other kinds. */
  staleSessions: StaleSession[];
  /** Only set for `prune-old-sessions` — how many most-recent sessions are kept; 0 otherwise. */
  keepCount: number;
};

/**
 * Scans every known project plus every workspace repo (local-only, no fetch) for:
 *
 * 1. `prune-worktrees` — a linked worktree's directory was deleted by hand, leaving git's
 *    bookkeeping pointing at it. Fixing this never touches real files.
 * 2. `remove-merged-worktree` — a linked worktree whose branch is fully merged into the default
 *    branch, with no uncommitted changes and no active session (the `git branch -d` test).
 * 3. `remove-abandoned-worktree` — a worktree under `<repo>/.claude/worktrees/` no session ever ran
 *    in, with no uncommitted changes and no commit only its branch holds. Limited to
 *    `.claude/worktrees/`: a worktree created by hand elsewhere may be in use without a session.
 * 4. `prune-old-sessions` — see `scanForOldSessionFindings`.
 *
 * Every finding is re-validated in `executeCleanupFinding` before acting.
 */
export function scanForCleanupFindings(): Promise<CleanupFinding[]> {
  // Concurrent callers (the modal opened in two tabs, a double click) share the scan already
  // running instead of each walking every repo again.
  inFlightScan ??= runCleanupScan().finally(() => {
    inFlightScan = null;
  });
  return inFlightScan;
}

let inFlightScan: Promise<CleanupFinding[]> | null = null;

async function runCleanupScan(): Promise<CleanupFinding[]> {
  const [knownFolders, sessions] = await Promise.all([getKnownProjectFolders(), listSessions()]);
  const projectFolders = await withWorkspaceRepos(knownFolders, (repoPath) => ({
    path: repoPath,
    label: path.basename(repoPath),
  }));
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
        command: `git worktree prune`,
        repoRoot,
        staleBranches: staleEntries.map((entry) => entry.branch ?? "?"),
        worktreePath: null,
        branch: null,
        defaultBranch: null,
        staleSessions: [],
        keepCount: 0,
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
      if (dirty) continue;
      if (!merged) {
        if (
          isAppWorktree(repoRoot, entry.path) &&
          !hasAnySession(sessions, entry.path) &&
          !(await branchHasUniqueCommits(repoRoot, entry.branch))
        ) {
          findings.push({
            id: `abandoned:${entry.path}`,
            kind: "remove-abandoned-worktree",
            command: `git worktree remove ${entry.path} && git branch -D ${entry.branch}`,
            repoRoot,
            staleBranches: [],
            worktreePath: entry.path,
            branch: entry.branch,
            defaultBranch: null,
            staleSessions: [],
            keepCount: 0,
          });
        }
        continue;
      }

      findings.push({
        id: `remove:${entry.path}`,
        kind: "remove-merged-worktree",
        command: `git worktree remove ${entry.path} && git branch -D ${entry.branch}`,
        repoRoot,
        staleBranches: [],
        worktreePath: entry.path,
        branch: entry.branch,
        defaultBranch,
        staleSessions: [],
        keepCount: 0,
      });
    }
  }

  findings.push(...(await scanForOldSessionFindings(projectFolders, sessions)));

  return findings;
}

/** Under `<repoRoot>/.claude/worktrees/`, where `--worktree` and "New task" create them. */
function isAppWorktree(repoRoot: string, worktreePath: string): boolean {
  const base = path.join(path.resolve(repoRoot), ".claude", "worktrees") + path.sep;
  return path.resolve(worktreePath).startsWith(base);
}

/** Any session (active or not) whose working directory is the worktree or inside it. */
function hasAnySession(sessions: Session[], worktreePath: string): boolean {
  const target = path.resolve(worktreePath);
  return sessions.some((s) => {
    if (!s.workingDirectory) return false;
    const dir = path.resolve(s.workingDirectory);
    return dir === target || dir.startsWith(`${target}${path.sep}`);
  });
}

/**
 * Which known repo root a session's working directory belongs to (main checkout, a worktree under
 * `.claude/worktrees/`, or an orphaned worktree via `missingWorktreeRepoRoot`). Pure path
 * comparison. Picks the *longest* matching root: repos can be nested inside an outer repo (e.g.
 * `~` itself), and a session must count toward only its innermost one.
 */
function resolveOwningRepoRoot(session: Session, repoRoots: string[]): string | null {
  if (session.missingWorktreeRepoRoot) {
    const resolvedMissing = path.resolve(session.missingWorktreeRepoRoot);
    return repoRoots.find((root) => path.resolve(root) === resolvedMissing) ?? null;
  }
  if (!session.workingDirectory) return null;
  const resolvedDir = path.resolve(session.workingDirectory);

  let best: string | null = null;
  for (const root of repoRoots) {
    const resolvedRoot = path.resolve(root);
    const matches =
      resolvedDir === resolvedRoot || resolvedDir.startsWith(`${resolvedRoot}${path.sep}`);
    if (matches && (!best || resolvedRoot.length > path.resolve(best).length)) {
      best = root;
    }
  }
  return best;
}

/**
 * Per project, keeps the `keepRecentSessionsPerProject` most recent sessions and offers to delete
 * the rest, never an active one. An old session that isn't deletable still counts toward "kept".
 */
async function scanForOldSessionFindings(
  projectFolders: { path: string }[],
  sessions: Session[],
): Promise<CleanupFinding[]> {
  const { keepRecentSessionsPerProject: keepCount } = await getUserPreferences();
  if (keepCount < 0) return [];

  const repoRoots = projectFolders.map((f) => f.path);
  const sessionsByRepoRoot = new Map<string, Session[]>();
  for (const session of sessions) {
    const repoRoot = resolveOwningRepoRoot(session, repoRoots);
    if (!repoRoot) continue;
    const list = sessionsByRepoRoot.get(repoRoot);
    if (list) {
      list.push(session);
    } else {
      sessionsByRepoRoot.set(repoRoot, [session]);
    }
  }

  const findings: CleanupFinding[] = [];
  for (const [repoRoot, repoSessions] of sessionsByRepoRoot) {
    const sorted = [...repoSessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    const beyondKeepCount = sorted.slice(keepCount);
    const deletable = beyondKeepCount.filter((s) => !s.isActive);
    if (deletable.length === 0) continue;

    findings.push({
      id: `prune-sessions:${repoRoot}`,
      kind: "prune-old-sessions",
      command: "",
      repoRoot,
      staleBranches: [],
      worktreePath: null,
      branch: null,
      defaultBranch: null,
      staleSessions: deletable.map((s) => ({
        id: s.id,
        title: s.title,
        updatedAt: s.updatedAt,
        sizeBytes: s.sizeBytes,
      })),
      keepCount,
    });
  }
  return findings;
}

/** Re-validates the finding's conditions from scratch before acting — the scan may be stale. */
export async function executeCleanupFinding(finding: CleanupFinding): Promise<void> {
  if (finding.kind === "prune-worktrees") {
    await pruneWorktrees(finding.repoRoot);
    return;
  }

  if (finding.kind === "prune-old-sessions") {
    // Best-effort per id: a session gone or active since the scan is skipped.
    for (const { id } of finding.staleSessions) {
      try {
        await deleteSession(id);
      } catch {
        // Not a real failure, keep going.
      }
    }
    return;
  }

  const { worktreePath, branch, repoRoot } = finding;
  if (!worktreePath || !branch) {
    throw new AppError(
      "CLEANUP_MISSING_TARGET",
      "Missing worktree path or branch for this cleanup item.",
    );
  }

  if (!(await directoryExists(worktreePath))) {
    throw new AppError(
      "CLEANUP_TARGET_GONE",
      `"${worktreePath}" no longer exists — refresh the list.`,
    );
  }

  if (finding.kind === "remove-abandoned-worktree") {
    if (!isAppWorktree(repoRoot, worktreePath)) {
      throw new AppError(
        "CLEANUP_MISSING_TARGET",
        "Only worktrees under .claude/worktrees/ can be removed this way.",
      );
    }
    if (await branchHasUniqueCommits(repoRoot, branch)) {
      throw new AppError(
        "CLEANUP_BRANCH_HAS_COMMITS",
        `Branch "${branch}" now has commits of its own — cancelled for safety.`,
      );
    }
    if (await hasUncommittedChanges(worktreePath)) {
      throw new AppError(
        "CLEANUP_UNCOMMITTED_CHANGES",
        `"${worktreePath}" now has uncommitted changes — cancelled for safety.`,
      );
    }
    if (hasAnySession(await listSessions(), worktreePath)) {
      throw new AppError(
        "CLEANUP_WORKTREE_HAS_SESSION",
        `A session now exists in "${worktreePath}" — cancelled for safety.`,
      );
    }
    await removeWorktreeAndBranch(worktreePath);
    return;
  }

  const defaultBranch = await getDefaultBaseBranch(repoRoot);
  if (!(await isBranchMerged(repoRoot, branch, defaultBranch))) {
    throw new AppError(
      "CLEANUP_BRANCH_NOT_MERGED",
      `Branch "${branch}" is no longer merged into "${defaultBranch}" — cancelled for safety.`,
    );
  }
  if (await hasUncommittedChanges(worktreePath)) {
    throw new AppError(
      "CLEANUP_UNCOMMITTED_CHANGES",
      `"${worktreePath}" now has uncommitted changes — cancelled for safety.`,
    );
  }

  const sessions = await listSessions();
  const target = path.resolve(worktreePath);
  const isActive = sessions.some(
    (s) => s.isActive && s.workingDirectory && path.resolve(s.workingDirectory) === target,
  );
  if (isActive) {
    throw new AppError(
      "SESSION_ACTIVE",
      `A session is active in "${worktreePath}" right now — cancelled for safety.`,
    );
  }

  await removeWorktreeAndBranch(worktreePath);
}
