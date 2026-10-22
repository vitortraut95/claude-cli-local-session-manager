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
import { getClaudeUsageStatus } from "./usageService.js";
import { recordEvent } from "../utils/history.js";
import { getFreeMemoryPercent, getMemoryPressure } from "../utils/systemResources.js";
import {
  getQueue,
  getTaskStore,
  setTaskStatus,
  updateQueueEntry,
  type QueueEntry,
} from "../utils/taskStore.js";

/**
 * Launches the task queue on its own: every `TICK_MS` it checks for room (live sessions, free
 * RAM, memory pressure, Claude plan usage) and starts the next ready entry exactly like "New
 * task" does — task branch (`<prefix>/<key>`, or just the key) off the repo's default, always in its own worktree, extra repos via
 * `--add-dir`, the default prompt — in a new terminal. Launches are `launchSpacingMinutes` apart:
 * a session's memory (tests, preview servers) only shows up minutes after it opens, so free RAM at
 * launch time alone would let the whole queue start at once.
 */

const TICK_MS = 15_000;
/** A just-launched session has no pid file yet; it holds its slot this long meanwhile. */
const LAUNCH_GRACE_MS = 90_000;
/** PSI `some avg10` above this = the machine is already stalling on memory. */
const MAX_MEMORY_PRESSURE = 10;

export type SchedulerBlock =
  "paused" | "max_sessions" | "recent_launch" | "low_memory" | "memory_pressure" | "usage_limit";

export type SchedulerStatus = {
  enabled: boolean;
  activeSessions: number;
  maxSessions: number;
  freeMemoryPercent: number | null;
  minFreeMemoryPercent: number;
  memoryPressure: number | null;
  /** Highest Claude plan limit in use; null when it couldn't be read (not a block then). */
  usagePercent: number | null;
  maxUsagePercent: number;
  /** Entries ready to launch (repo and branch prefix chosen, not launched, no error). */
  waiting: number;
  /** Why nothing would launch right now; null = there's room. */
  blockedBy: SchedulerBlock | null;
  /** The entry being launched at this moment, if any. */
  launching: string | null;
};

const pendingLaunches = new Map<string, number>();
let launchingKey: string | null = null;
let lastLaunchAt = 0;
let ticking = false;

function isReady(entry: QueueEntry): boolean {
  return !entry.launchedAt && !entry.error && entry.repos.length > 0 && entry.branchPrefix !== null;
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
    launching: launchingKey,
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
    extraDirs: "This task also spans these folders (already added with --add-dir): {dirs}",
    sharedNodeModules:
      "node_modules here is a symlink to the main checkout's, shared with other tasks: {dirs}. " +
      "Don't run yarn/npm/pnpm install or add in this worktree. If the task changes dependencies, " +
      "delete just the link (rm node_modules, no -r) and install inside the worktree.",
  },
  pt: {
    task: "Tarefa",
    extraDirs: "Esta tarefa também envolve estas pastas (já adicionadas com --add-dir): {dirs}",
    sharedNodeModules:
      "O node_modules aqui é um link para o da raiz do repo, compartilhado com outras tarefas: " +
      "{dirs}. Não rode yarn/npm/pnpm install nem add neste worktree. Se a tarefa mudar " +
      "dependências, apague só o link (rm node_modules, sem -r) e instale dentro do worktree.",
  },
};

/** Same message "New task" composes: `Task: <link>`, the default prompt, the extra-dirs note and
 *  the shared node_modules warning. `linked` = absolute paths of the linked node_modules. */
function composePrompt(
  prefs: UserPreferences,
  entry: QueueEntry,
  addDirs: string[],
  linked: string[],
): string {
  const text = PROMPT_TEXT[prefs.language ?? "en"];
  return [
    `${text.task}: ${entry.link ?? entry.key}`,
    prefs.defaultPrompt.trim(),
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
  const [mainFolder, ...extraFolders] = entry.repos;
  if (!mainFolder) return null;
  const branch = entry.branchPrefix ? `${entry.branchPrefix}/${entry.key}` : entry.key;

  const repo = await getRepoInfo(mainFolder);
  const base = repo.defaultBaseBranch;
  const linked: string[] = [];
  let worktreePath = await findExistingTaskWorktree(repo.repoRoot, branch, entry.key);
  if (!worktreePath) {
    const { baseBranchRef } = await resolveBaseBranch(repo.repoRoot, base);
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
    const status = await getSchedulerStatus();
    trackBlock(status);
    if (status.blockedBy || status.waiting === 0) return;
    const [prefs, queue] = await Promise.all([getUserPreferences(), getQueue()]);
    const next = queue.find(isReady);
    if (!next) return;
    launchingKey = next.key;
    const startedAt = Date.now();
    lastLaunchAt = startedAt;
    recordEvent("queue.launch.started", { key: next.key, repos: next.repos });
    try {
      const outcome = await launchEntry(next, prefs);
      recordEvent("queue.launched", {
        key: next.key,
        durationMs: Date.now() - startedAt,
        // From entering the queue to its session opening.
        queuedMs: next.addedAt ? Date.now() - Date.parse(next.addedAt) : null,
        ...outcome,
      });
      console.log(`[scheduler] Launched ${next.key}.`);
    } catch (err) {
      const message = errorMessage(err);
      console.warn(`[scheduler] ${next.key} failed: ${message}`);
      recordEvent("queue.launch.failed", {
        key: next.key,
        durationMs: Date.now() - startedAt,
        error: message,
      });
      await updateQueueEntry(next.key, { error: message });
    }
  } catch (err) {
    console.warn("[scheduler] Tick failed:", err);
    recordEvent("scheduler.error", { error: errorMessage(err) });
  } finally {
    launchingKey = null;
    ticking = false;
  }
}

/**
 * Launches a queue entry again — for one marked launched whose session never actually started
 * (no transcript, no process). Reuses its worktree (see `findExistingTaskWorktree`).
 */
export async function relaunchQueueEntry(key: string): Promise<LaunchOutcome | null> {
  const [prefs, queue] = await Promise.all([getUserPreferences(), getQueue()]);
  const entry = queue.find((e) => e.key === key);
  if (!entry) throw new Error(`${key} isn't in the queue.`);
  const startedAt = Date.now();
  recordEvent("queue.launch.started", { key, repos: entry.repos, relaunch: true });
  try {
    const outcome = await launchEntry({ ...entry, launchedAt: null, error: null }, prefs);
    lastLaunchAt = startedAt;
    recordEvent("queue.launched", {
      key,
      durationMs: Date.now() - startedAt,
      relaunch: true,
      ...outcome,
    });
    return outcome;
  } catch (err) {
    const message = errorMessage(err);
    recordEvent("queue.launch.failed", { key, durationMs: Date.now() - startedAt, error: message });
    await updateQueueEntry(key, { error: message });
    throw err;
  }
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
