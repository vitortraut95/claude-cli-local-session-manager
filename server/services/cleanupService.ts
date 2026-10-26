import path from "node:path";
import { deleteSession, directoryExists, listSessions } from "./sessionService.js";
import { getUserPreferences } from "./preferencesService.js";
import { getKnownProjectFolders } from "./taskService.js";
import { withWorkspaceRepos } from "./workspaceService.js";
import type { Session } from "../../shared/session.js";
import {
  branchHasUniqueCommits,
  getDefaultBaseBranch,
  getRepoRoot,
  getWorktreeBranch,
  hasUncommittedChanges,
  isBranchMerged,
  isBranchPushed,
  isLinkedWorktree,
  listWorktrees,
  pruneWorktrees,
  removeWorktreeAndBranch,
  removeWorktreeKeepBranch,
  type WorktreeEntry,
} from "../utils/git.js";
import { AppError } from "../utils/httpError.js";
import { inferTaskKey } from "../utils/taskKeys.js";
import { getTaskStore, linkRepoBranchToTask, type TaskStore } from "../utils/taskStore.js";
import type { CleanupFinding, WorktreeSkipReason } from "../../shared/cleanup.js";
export type { CleanupFinding } from "../../shared/cleanup.js";

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
 * 4. `remove-done-task-worktree` — a worktree whose task (or, with no task, whose session) is
 *    marked "done", not merged yet, with no uncommitted changes, no active session and every
 *    commit already on `origin/<branch>`. Only the worktree goes: the branch stays until merged.
 * 5. `prune-old-sessions` — see `scanForOldSessionFindings`.
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
  const [knownFolders, sessions, store] = await Promise.all([
    getKnownProjectFolders(),
    listSessions(),
    getTaskStore(),
  ]);
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
      if (!defaultBranch) continue;
      const result = await classifyWorktree(repoRoot, entry.path, entry.branch, defaultBranch, {
        sessions,
        store,
      });
      if (typeof result !== "string") findings.push(result);
    }
  }

  findings.push(...(await scanForOldSessionFindings(projectFolders, sessions)));

  return findings;
}

const FINDING_ID_PREFIX = {
  "remove-merged-worktree": "remove",
  "remove-abandoned-worktree": "abandoned",
  "remove-done-task-worktree": "done",
};

function worktreeFinding(
  kind: "remove-merged-worktree" | "remove-abandoned-worktree" | "remove-done-task-worktree",
  repoRoot: string,
  worktreePath: string,
  branch: string,
  defaultBranch: string | null,
): CleanupFinding {
  return {
    id: `${FINDING_ID_PREFIX[kind]}:${worktreePath}`,
    kind,
    command:
      kind === "remove-done-task-worktree"
        ? `git worktree remove ${worktreePath}`
        : `git worktree remove ${worktreePath} && git branch -D ${branch}`,
    repoRoot,
    staleBranches: [],
    worktreePath,
    branch,
    defaultBranch,
    staleSessions: [],
    keepCount: 0,
  };
}

/** Status "done" on the branch's task (recorded, else read from the name), or — for a worktree
 *  with no task — on a session that ran in it. */
function isMarkedDone(
  store: TaskStore,
  sessions: Session[],
  repoRoot: string,
  worktreePath: string,
  branch: string,
): boolean {
  const taskKey = store.repoBranches[repoRoot]?.[branch]?.taskKey ?? inferTaskKey(branch);
  if (taskKey) return store.tasks[taskKey]?.status === "done";
  const target = path.resolve(worktreePath);
  return sessions.some(
    (s) => s.workingDirectory && path.resolve(s.workingDirectory) === target && s.status === "done",
  );
}

/** The finding one linked worktree (existing, with a branch) qualifies for, if any. */
async function classifyWorktree(
  repoRoot: string,
  worktreePath: string,
  branch: string,
  defaultBranch: string,
  { sessions, store }: { sessions: Session[]; store: TaskStore },
): Promise<CleanupFinding | WorktreeSkipReason> {
  if (branch === defaultBranch) return "default-branch";
  const target = path.resolve(worktreePath);
  if (
    sessions.some(
      (s) => s.isActive && s.workingDirectory && path.resolve(s.workingDirectory) === target,
    )
  ) {
    return "active-session";
  }

  const [merged, dirty] = await Promise.all([
    isBranchMerged(repoRoot, branch, defaultBranch),
    hasUncommittedChanges(worktreePath).catch(() => true),
  ]);
  if (dirty) return "uncommitted-changes";
  if (merged) {
    return worktreeFinding("remove-merged-worktree", repoRoot, worktreePath, branch, defaultBranch);
  }
  if (isMarkedDone(store, sessions, repoRoot, worktreePath, branch)) {
    return (await isBranchPushed(repoRoot, branch))
      ? worktreeFinding("remove-done-task-worktree", repoRoot, worktreePath, branch, null)
      : "not-pushed";
  }
  if (
    isAppWorktree(repoRoot, worktreePath) &&
    !hasAnySession(sessions, worktreePath) &&
    !(await branchHasUniqueCommits(repoRoot, branch))
  ) {
    return worktreeFinding("remove-abandoned-worktree", repoRoot, worktreePath, branch, null);
  }
  return "not-done";
}

/**
 * For a session card: what removing its worktree would mean right now — the finding to confirm
 * and execute, or why there's none. Null when the session isn't in a linked worktree.
 */
export async function getWorktreeCleanupForSession(
  sessionId: string,
): Promise<{ finding: CleanupFinding | null; reason: WorktreeSkipReason | null } | null> {
  const [sessions, store] = await Promise.all([listSessions(), getTaskStore()]);
  const cwd = sessions.find((s) => s.id === sessionId)?.workingDirectory;
  if (!cwd || !(await directoryExists(cwd)) || !(await isLinkedWorktree(cwd))) return null;
  const repoRoot = await getRepoRoot(cwd);
  const branch = repoRoot ? await getWorktreeBranch(cwd, repoRoot) : null;
  if (!repoRoot || !branch) return null;
  const defaultBranch = await getDefaultBaseBranch(repoRoot);
  const result = await classifyWorktree(repoRoot, cwd, branch, defaultBranch, { sessions, store });
  return typeof result === "string"
    ? { finding: null, reason: result }
    : { finding: result, reason: null };
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

  if (finding.kind === "remove-done-task-worktree") {
    const [sessions, store] = await Promise.all([listSessions(), getTaskStore()]);
    if (!isMarkedDone(store, sessions, repoRoot, worktreePath, branch)) {
      throw new AppError(
        "CLEANUP_TASK_NOT_DONE",
        `The task of "${branch}" is no longer marked done — cancelled for safety.`,
      );
    }
    if (!(await isBranchPushed(repoRoot, branch))) {
      throw new AppError(
        "CLEANUP_BRANCH_NOT_PUSHED",
        `Branch "${branch}" has commits that aren't on origin — push them first.`,
      );
    }
    if (await hasUncommittedChanges(worktreePath)) {
      throw new AppError(
        "CLEANUP_UNCOMMITTED_CHANGES",
        `"${worktreePath}" now has uncommitted changes — cancelled for safety.`,
      );
    }
    const target = path.resolve(worktreePath);
    if (
      sessions.some(
        (s) => s.isActive && s.workingDirectory && path.resolve(s.workingDirectory) === target,
      )
    ) {
      throw new AppError(
        "SESSION_ACTIVE",
        `A session is active in "${worktreePath}" right now — cancelled for safety.`,
      );
    }
    await removeWorktreeKeepBranch(worktreePath);
    // The branch stays linked to its task, now with no worktree of its own.
    const taskKey = store.repoBranches[repoRoot]?.[branch]?.taskKey;
    if (taskKey) await linkRepoBranchToTask(repoRoot, branch, taskKey, null).catch(() => undefined);
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
