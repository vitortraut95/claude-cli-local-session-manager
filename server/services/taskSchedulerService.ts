import path from "node:path";
import { addRepoToTask } from "./taskGroupService.js";
import { getUserPreferences, type UserPreferences } from "./preferencesService.js";
import { directoryExists, getActiveResumeSessionIds } from "./sessionService.js";
import {
  createTaskWorktree,
  getRepoInfo,
  launchTaskTerminal,
  resolveBaseBranch,
} from "./taskService.js";
import { cleanupFinishedTests, launchTestEntry } from "./taskTestService.js";
import { getClaudeUsageStatus } from "./usageService.js";
import { firstWorkspaceDir } from "./workspaceService.js";
import { recordEvent } from "../utils/history.js";
import { BadRequestError, ConflictError, NotFoundError } from "../utils/httpError.js";
import { getFreeMemoryPercent, getMemoryPressure } from "../utils/systemResources.js";
import {
  getQueue,
  getTaskStore,
  setTaskStatus,
  updateQueueEntry,
  type QueueEntry,
} from "../utils/taskStore.js";
import type { SchedulerBlock, SchedulerStatus } from "../../shared/tasks.js";

/**
 * Launches the task queue on its own: every `TICK_MS` it checks for room (live sessions, free
 * RAM, memory pressure, Claude plan usage) and starts the next ready entry exactly like "New
 * task" does — task branch (`<prefix>/<key>`, or just the key) off the entry's base (else the
 * repo's default), always in its own worktree, extra repos via
 * `--add-dir`, the default prompt — in a new terminal; a test entry runs `taskTestSkill` on the
 * task's existing branch instead (`taskTestService.ts`). Launches are `launchSpacingMinutes` apart:
 * a session's memory (tests, preview servers) only shows up minutes after it opens, so free RAM at
 * launch time alone would let the whole queue start at once.
 */

const TICK_MS = 15_000;
/** A just-launched session has no pid file yet; it holds its slot this long meanwhile. */
const LAUNCH_GRACE_MS = 90_000;
/** PSI `some avg10` above this = the machine is already stalling on memory. */
const MAX_MEMORY_PRESSURE = 10;

const pendingLaunches = new Map<string, number>();
/** Entries being launched right now: the tick's and any "Start now". */
const launchingKeys = new Set<string>();
let lastLaunchAt = 0;
let ticking = false;

/** A test entry needs no branch prefix (it tests a branch that already exists), and neither does
 *  one with no repo (no branch is made). */
function isReady(entry: QueueEntry): boolean {
  return (
    !entry.launchedAt &&
    !entry.error &&
    (entry.noRepo || entry.repos.length > 0) &&
    (entry.kind === "test" || entry.noRepo || entry.branchPrefix !== null)
  );
}

/** Live sessions plus launches still inside their grace period that haven't shown up yet. */
async function countActiveSessions(): Promise<number> {
  const active = await getActiveResumeSessionIds();
  const now = Date.now();
  for (const [id, startedAt] of pendingLaunches) {
    if (active.has(id) || now - startedAt > LAUNCH_GRACE_MS) pendingLaunches.delete(id);
  }
  return active.size + pendingLaunches.size;
}

async function getUsagePercent(): Promise<number | null> {
  try {
    const { limits } = await getClaudeUsageStatus();
    return limits.length > 0 ? Math.max(...limits.map((limit) => limit.percent)) : null;
  } catch {
    return null;
  }
}

export async function getSchedulerStatus(): Promise<SchedulerStatus> {
  const [prefs, queue, activeSessions, freeMemoryPercent, memoryPressure, usagePercent] =
    await Promise.all([
      getUserPreferences(),
      getQueue(),
      countActiveSessions(),
      getFreeMemoryPercent(),
      getMemoryPressure(),
      getUsagePercent(),
    ]);
  const { enabled, maxSessions, minFreeMemoryPercent, maxUsagePercent, launchSpacingMinutes } =
    prefs.orchestrator;

  // Unreadable values never block: the app still works on a box without PSI.
  let blockedBy: SchedulerBlock | null = null;
  if (!enabled) blockedBy = "paused";
  else if (activeSessions >= maxSessions) blockedBy = "max_sessions";
  else if (Date.now() - lastLaunchAt < launchSpacingMinutes * 60_000) blockedBy = "recent_launch";
  else if (freeMemoryPercent !== null && freeMemoryPercent < minFreeMemoryPercent)
    blockedBy = "low_memory";
  else if (memoryPressure !== null && memoryPressure > MAX_MEMORY_PRESSURE)
    blockedBy = "memory_pressure";
  else if (usagePercent !== null && usagePercent >= maxUsagePercent) blockedBy = "usage_limit";

  return {
    enabled,
    activeSessions,
    maxSessions,
    freeMemoryPercent,
    minFreeMemoryPercent,
    memoryPressure,
    usagePercent,
    maxUsagePercent,
    waiting: queue.filter(isReady).length,
    blockedBy,
    launching: launchingKeys.values().next().value ?? null,
    launchingKeys: [...launchingKeys],
  };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Mirrors the "New task" modal's `newTaskModal.taskPrefix`, `extraRepos.promptNote` and
 *  `sharedNodeModulesNote` strings. */
const PROMPT_TEXT = {
  en: {
    task: "Task",
    noRepo:
      "No repo was picked for this task: this is the folder the repos live in ({dir}). If it " +
      "needs code changes, find the repo(s) here first.",
    extraDirs: "This task also spans these folders (already added with --add-dir): {dirs}",
    sharedNodeModules:
      "node_modules here is a symlink to the main checkout's, shared with other tasks: {dirs}. " +
      "Don't run yarn/npm/pnpm install or add in this worktree. If the task changes dependencies, " +
      "delete just the link (rm node_modules, no -r) and install inside the worktree.",
  },
  pt: {
    task: "Tarefa",
    noRepo:
      "Nenhum repo foi escolhido para esta tarefa: esta é a pasta onde ficam os repos ({dir}). " +
      "Se ela precisar mudar código, ache o(s) repo(s) aqui antes.",
    extraDirs: "Esta tarefa também envolve estas pastas (já adicionadas com --add-dir): {dirs}",
    sharedNodeModules:
      "O node_modules aqui é um link para o da raiz do repo, compartilhado com outras tarefas: " +
      "{dirs}. Não rode yarn/npm/pnpm install nem add neste worktree. Se a tarefa mudar " +
      "dependências, apague só o link (rm node_modules, sem -r) e instale dentro do worktree.",
  },
};

/** Same message "New task" composes: `Task: <link>`, the default prompt, the extra-dirs note and
 *  the shared node_modules warning. `linked` = absolute paths of the linked node_modules;
 *  `noRepoDir` = where a task with no repo opens. */
function composePrompt(
  prefs: UserPreferences,
  entry: QueueEntry,
  addDirs: string[],
  linked: string[],
  noRepoDir: string | null = null,
): string {
  const text = PROMPT_TEXT[prefs.language ?? "en"];
  return [
    `${text.task}: ${entry.link ?? entry.key}`,
    prefs.defaultPrompt.trim(),
    noRepoDir ? text.noRepo.replace("{dir}", noRepoDir) : "",
    addDirs.length > 0 ? text.extraDirs.replace("{dirs}", addDirs.join(", ")) : "",
    linked.length > 0 ? text.sharedNodeModules.replace("{dirs}", linked.join(", ")) : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** A retry after a failure past the worktree step finds the branch already there: reuse that
 *  worktree when it's this task's, instead of failing on "branch exists" forever. */
async function findExistingTaskWorktree(
  repoRoot: string,
  branch: string,
  key: string,
): Promise<string | null> {
  const entry = (await getTaskStore()).repoBranches[repoRoot]?.[branch];
  if (entry?.taskKey !== key || !entry.worktreePath) return null;
  return (await directoryExists(entry.worktreePath)) ? entry.worktreePath : null;
}

type LaunchOutcome = {
  sessionId: string | null;
  branch: string;
  worktreePath: string;
  addDirs: string[];
  extraErrors: string[];
  linkedNodeModules: number;
};

/** How long a launched session gets to show up as running (its pid file) before the launch counts
 *  as failed. The terminal/Limux opening the command is no proof Claude actually started. */
const SESSION_START_TIMEOUT_MS = 60_000;

async function waitForSessionStart(sessionId: string): Promise<void> {
  const deadline = Date.now() + SESSION_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if ((await getActiveResumeSessionIds()).has(sessionId)) return;
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }
  pendingLaunches.delete(sessionId);
  throw new Error(
    `The session didn't start within ${SESSION_START_TIMEOUT_MS / 1000}s (Claude never showed up ` +
      `in the terminal/Limux) — check the pane or tab for an error, then try again.`,
  );
}

async function launchEntry(
  entry: QueueEntry,
  prefs: UserPreferences,
): Promise<LaunchOutcome | null> {
  if (entry.kind === "test") return launchTest(entry, prefs);
  return entry.noRepo ? launchNoRepoEntry(entry, prefs) : launchDevEntry(entry, prefs);
}

/** A task with no repo: just the session, in the first workspace dir — no branch, no worktree. */
async function launchNoRepoEntry(
  entry: QueueEntry,
  prefs: UserPreferences,
): Promise<LaunchOutcome> {
  const dir = await firstWorkspaceDir(prefs);
  const { sessionId } = await launchTaskTerminal({
    worktreePath: dir,
    prompt: composePrompt(prefs, entry, [], [], dir),
    permissionModeAuto: prefs.useAutoPermissionModeByDefault,
    repoRoot: "",
    nickname: entry.link ?? entry.key,
  });
  if (sessionId) {
    pendingLaunches.set(sessionId, Date.now());
    await waitForSessionStart(sessionId);
  }
  await updateQueueEntry(entry.key, {
    launchedAt: new Date().toISOString(),
    sessionId,
    error: null,
  });
  await setTaskStatus(entry.key, "in_progress", "scheduler");
  return {
    sessionId,
    branch: "",
    worktreePath: dir,
    addDirs: [],
    extraErrors: [],
    linkedNodeModules: 0,
  };
}

/** Same waiting and bookkeeping as a dev entry, but the task's own status is left alone (the task
 *  is someone else's); the test session's status is set by `launchTestEntry`. */
async function launchTest(
  entry: QueueEntry,
  prefs: UserPreferences,
): Promise<LaunchOutcome | null> {
  const outcome = await launchTestEntry(entry, prefs);
  if (!outcome) return null;
  pendingLaunches.set(outcome.sessionId, Date.now());
  await waitForSessionStart(outcome.sessionId);
  await updateQueueEntry(entry.key, {
    launchedAt: new Date().toISOString(),
    sessionId: outcome.sessionId,
    error: outcome.extraErrors.length > 0 ? outcome.extraErrors.join("\n") : null,
  });
  return outcome;
}

async function launchDevEntry(
  entry: QueueEntry,
  prefs: UserPreferences,
): Promise<LaunchOutcome | null> {
  const [mainFolder, ...extraFolders] = entry.repos;
  if (!mainFolder) return null;
  const branch = entry.branchPrefix ? `${entry.branchPrefix}/${entry.key}` : entry.key;

  const repo = await getRepoInfo(mainFolder);
  const base = entry.baseBranch ?? repo.defaultBaseBranch;
  const linked: string[] = [];
  let worktreePath = await findExistingTaskWorktree(repo.repoRoot, branch, entry.key);
  if (!worktreePath) {
    const { baseBranchRef } = await resolveBaseBranch(
      repo.repoRoot,
      base,
      entry.useLocalBaseBranch,
    );
    const created = await createTaskWorktree(
      repo.repoRoot,
      branch,
      baseBranchRef,
      base,
      true,
      entry.key,
      entry.link,
    );
    worktreePath = created.worktreePath;
    linked.push(...created.setup.linked.map((rel) => path.join(created.worktreePath, rel)));
  }

  // Like "New task": an extra repo that fails doesn't stop the others or the main session.
  const addDirs: string[] = [];
  const extraErrors: string[] = [];
  for (const folder of extraFolders) {
    try {
      const existing = await findExistingTaskWorktree(folder, branch, entry.key);
      if (existing) {
        addDirs.push(existing);
        continue;
      }
      const result = await addRepoToTask(entry.key, {
        folderPath: folder,
        branchName: branch,
        baseBranch: "",
        useLocalBranch: false,
        useWorktree: true,
        taskLink: entry.link,
      });
      addDirs.push(result.workingDirectory);
      linked.push(...result.setup.linked.map((rel) => path.join(result.workingDirectory, rel)));
    } catch (err) {
      extraErrors.push(`${folder}: ${errorMessage(err)}`);
    }
  }

  const { sessionId } = await launchTaskTerminal({
    worktreePath,
    prompt: composePrompt(prefs, entry, addDirs, linked),
    permissionModeAuto: prefs.useAutoPermissionModeByDefault,
    repoRoot: repo.repoRoot,
    nickname: entry.link ?? entry.key,
    originBranch: base,
    destinationBranch: branch,
    addDirs,
  });
  if (sessionId) {
    pendingLaunches.set(sessionId, Date.now());
    await waitForSessionStart(sessionId);
  }

  await updateQueueEntry(entry.key, {
    launchedAt: new Date().toISOString(),
    sessionId,
    // Launched anyway; kept so the modal can say which extra repo is missing.
    error: extraErrors.length > 0 ? extraErrors.join("\n") : null,
  });
  await setTaskStatus(entry.key, "in_progress", "scheduler");
  return {
    sessionId,
    branch,
    worktreePath,
    addDirs,
    extraErrors,
    linkedNodeModules: linked.length,
  };
}

/** The block the scheduler is in while tasks wait (null = not blocked, or nothing waiting), so the
 *  history gets one `scheduler.blocked` / `scheduler.unblocked` pair per period, not one per tick. */
let currentBlock: { reason: SchedulerBlock; since: number } | null = null;

function trackBlock(status: SchedulerStatus): void {
  const reason = status.waiting > 0 ? status.blockedBy : null;
  if (currentBlock?.reason === reason) return;
  if (currentBlock) {
    recordEvent("scheduler.unblocked", {
      reason: currentBlock.reason,
      durationMs: Date.now() - currentBlock.since,
    });
  }
  currentBlock = reason ? { reason, since: Date.now() } : null;
  if (reason) {
    recordEvent("scheduler.blocked", {
      reason,
      waiting: status.waiting,
      activeSessions: status.activeSessions,
      maxSessions: status.maxSessions,
      freeMemoryPercent: status.freeMemoryPercent,
      memoryPressure: status.memoryPressure,
      usagePercent: status.usagePercent,
    });
  }
}

async function tick(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    // Every tick, paused or blocked or not: a finished test shouldn't keep its worktrees around.
    await cleanupFinishedTests().catch((err: unknown) =>
      console.warn("[scheduler] Test cleanup failed:", err),
    );
    const status = await getSchedulerStatus();
    trackBlock(status);
    if (status.blockedBy || status.waiting === 0) return;
    const [prefs, queue] = await Promise.all([getUserPreferences(), getQueue()]);
    const next = queue.find((entry) => isReady(entry) && !launchingKeys.has(entry.key));
    if (!next) return;
    // Its failure is already recorded on the entry.
    await launchTracked(next, prefs, false).catch(() => undefined);
  } catch (err) {
    console.warn("[scheduler] Tick failed:", err);
    recordEvent("scheduler.error", { error: errorMessage(err) });
  } finally {
    ticking = false;
  }
}

/** Launches `entry` with the history events and, on failure, its error recorded on the entry
 *  (skipped until cleared). `now` = a "Start now" from the modal. */
async function launchTracked(
  entry: QueueEntry,
  prefs: UserPreferences,
  now: boolean,
): Promise<LaunchOutcome | null> {
  launchingKeys.add(entry.key);
  const startedAt = Date.now();
  lastLaunchAt = startedAt;
  const extra = now ? { now: true } : {};
  recordEvent("queue.launch.started", {
    key: entry.key,
    kind: entry.kind,
    repos: entry.repos,
    ...extra,
  });
  try {
    const outcome = await launchEntry(entry, prefs);
    recordEvent("queue.launched", {
      key: entry.key,
      durationMs: Date.now() - startedAt,
      // From entering the queue to its session opening.
      queuedMs: entry.addedAt ? Date.now() - Date.parse(entry.addedAt) : null,
      ...extra,
      ...outcome,
    });
    console.log(`[scheduler] Launched ${entry.key}${now ? " (start now)" : ""}.`);
    return outcome;
  } catch (err) {
    const message = errorMessage(err);
    console.warn(`[scheduler] ${entry.key} failed: ${message}`);
    recordEvent("queue.launch.failed", {
      key: entry.key,
      durationMs: Date.now() - startedAt,
      error: message,
      ...extra,
    });
    await updateQueueEntry(entry.key, { error: message });
    throw err;
  } finally {
    launchingKeys.delete(entry.key);
  }
}

/**
 * "Start now": launches a saved queue entry right away, whatever its place in line and whether
 * the scheduler is paused or out of room (sessions, RAM, plan usage, spacing). Also for one marked
 * launched whose session never started (reuses its worktree, see `findExistingTaskWorktree`).
 */
export async function launchQueueEntryNow(key: string): Promise<LaunchOutcome | null> {
  const [prefs, queue] = await Promise.all([getUserPreferences(), getQueue()]);
  const entry = queue.find((e) => e.key === key);
  if (!entry) throw new NotFoundError("QUEUE_ENTRY_NOT_FOUND", `${key} isn't in the queue.`);
  if (launchingKeys.has(key)) {
    throw new ConflictError("QUEUE_ENTRY_LAUNCHING", `${key} is already being launched.`);
  }
  if (entry.sessionId && (await getActiveResumeSessionIds()).has(entry.sessionId)) {
    throw new ConflictError("QUEUE_ENTRY_RUNNING", `${key}'s session is already running.`);
  }
  const fresh = { ...entry, launchedAt: null, error: null };
  if (!isReady(fresh)) {
    throw new BadRequestError(
      "QUEUE_ENTRY_NOT_READY",
      `${key} still needs a repo (or "no repo")${entry.kind === "dev" ? " and a branch prefix" : ""}.`,
    );
  }
  return launchTracked(fresh, prefs, true);
}

export function startTaskScheduler(): void {
  setInterval(() => void tick(), TICK_MS);
  void tick();
}

/** "Check now" from the modal, instead of waiting for the next tick. */
export async function runSchedulerNow(): Promise<SchedulerStatus> {
  await tick();
  return getSchedulerStatus();
}
