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
 * `--add-dir`, the default prompt — in a new terminal. At most one launch per tick, so sessions
 * start staggered and each one's memory shows up before the next check.
 */

const TICK_MS = 15_000;
/** A just-launched session has no pid file yet; it holds its slot this long meanwhile. */
const LAUNCH_GRACE_MS = 90_000;
/** PSI `some avg10` above this = the machine is already stalling on memory. */
const MAX_MEMORY_PRESSURE = 10;

export type SchedulerBlock =
  "paused" | "max_sessions" | "low_memory" | "memory_pressure" | "usage_limit";

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
  const { enabled, maxSessions, minFreeMemoryPercent, maxUsagePercent } = prefs.orchestrator;

  // Unreadable values never block: the app still works on a box without PSI.
  let blockedBy: SchedulerBlock | null = null;
  if (!enabled) blockedBy = "paused";
  else if (activeSessions >= maxSessions) blockedBy = "max_sessions";
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

const PROMPT_TEXT = {
  en: {
    task: "Task",
    extraDirs: "This task also spans these folders (already added with --add-dir): {dirs}",
  },
  pt: {
    task: "Tarefa",
    extraDirs: "Esta tarefa também envolve estas pastas (já adicionadas com --add-dir): {dirs}",
  },
};

/** Same message "New task" composes: `Task: <link>`, the default prompt, the extra-dirs note. */
function composePrompt(prefs: UserPreferences, entry: QueueEntry, addDirs: string[]): string {
  const text = PROMPT_TEXT[prefs.language ?? "en"];
  return [
    `${text.task}: ${entry.link ?? entry.key}`,
    prefs.defaultPrompt.trim(),
    addDirs.length > 0 ? text.extraDirs.replace("{dirs}", addDirs.join(", ")) : "",
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

async function launchEntry(entry: QueueEntry, prefs: UserPreferences): Promise<void> {
  const [mainFolder, ...extraFolders] = entry.repos;
  if (!mainFolder) return;
  const branch = entry.branchPrefix ? `${entry.branchPrefix}/${entry.key}` : entry.key;

  const repo = await getRepoInfo(mainFolder);
  const base = repo.defaultBaseBranch;
  let worktreePath = await findExistingTaskWorktree(repo.repoRoot, branch, entry.key);
  if (!worktreePath) {
    const { baseBranchRef } = await resolveBaseBranch(repo.repoRoot, base);
    ({ worktreePath } = await createTaskWorktree(
      repo.repoRoot,
      branch,
      baseBranchRef,
      base,
      true,
      entry.key,
      entry.link,
    ));
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
    } catch (err) {
      extraErrors.push(`${folder}: ${errorMessage(err)}`);
    }
  }

  const { sessionId } = await launchTaskTerminal({
    worktreePath,
    prompt: composePrompt(prefs, entry, addDirs),
    permissionModeAuto: prefs.useAutoPermissionModeByDefault,
    repoRoot: repo.repoRoot,
    nickname: entry.link ?? entry.key,
    originBranch: base,
    destinationBranch: branch,
    addDirs,
  });
  if (sessionId) pendingLaunches.set(sessionId, Date.now());

  await updateQueueEntry(entry.key, {
    launchedAt: new Date().toISOString(),
    sessionId,
    // Launched anyway; kept so the modal can say which extra repo is missing.
    error: extraErrors.length > 0 ? extraErrors.join("\n") : null,
  });
  await setTaskStatus(entry.key, "in_progress");
}

async function tick(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    const status = await getSchedulerStatus();
    if (status.blockedBy || status.waiting === 0) return;
    const [prefs, queue] = await Promise.all([getUserPreferences(), getQueue()]);
    const next = queue.find(isReady);
    if (!next) return;
    launchingKey = next.key;
    try {
      await launchEntry(next, prefs);
      console.log(`[scheduler] Launched ${next.key}.`);
    } catch (err) {
      const message = errorMessage(err);
      console.warn(`[scheduler] ${next.key} failed: ${message}`);
      await updateQueueEntry(next.key, { error: message });
    }
  } catch (err) {
    console.warn("[scheduler] Tick failed:", err);
  } finally {
    launchingKey = null;
    ticking = false;
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
