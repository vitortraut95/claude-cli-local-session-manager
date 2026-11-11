import { getRepoRoot } from "../utils/git.js";
import { AppError, BadRequestError } from "../utils/httpError.js";
import { isTaskKey, normalizeTaskKey } from "../utils/taskKeys.js";
import { recordEvent } from "../utils/history.js";
import { SAFE_BRANCH_NAME } from "./taskService.js";
import { PR_SUBJECT, reviewBoardSetup, reviewRepoPath } from "./taskReviewService.js";
import { getQueue, setQueue, type QueueEntry, type QueueEntryInput } from "../utils/taskStore.js";
import type { QueueGroupedTask } from "../../shared/tasks.js";

/**
 * The task queue: tickets pasted in to be worked on, each tied to the repo(s) it'll be done in,
 * and pull requests to review (`repo#id`). `taskSchedulerService` launches them.
 */

export function getTaskQueue(): Promise<QueueEntry[]> {
  return getQueue();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** A branch-name segment: what `createTaskWorktree` accepts, minus the "/" (added in between). */
const SAFE_BRANCH_PREFIX = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** Each repo is stored as its repo root, so a subfolder and the root don't count twice. A task
 *  with no repo yet is kept (still to be chosen); `noRepo` = none on purpose (repos ignored). */
async function parseEntry(raw: unknown): Promise<QueueEntryInput> {
  if (isRecord(raw) && raw.kind === "review") return parseReviewEntry(raw);
  const rawKey = isRecord(raw) && typeof raw.key === "string" ? raw.key : "";
  const key = normalizeTaskKey(rawKey);
  if (!key || !isTaskKey(key)) {
    throw new BadRequestError(
      "TASK_INVALID_KEY",
      `"${rawKey}" isn't a ticket key (e.g. PROJ-123).`,
    );
  }
  const link =
    isRecord(raw) && typeof raw.link === "string" && raw.link.trim() ? raw.link.trim() : null;
  const groupedTasks: QueueGroupedTask[] = [];
  for (const task of isRecord(raw) && Array.isArray(raw.groupedTasks) ? raw.groupedTasks : []) {
    const groupedKey = isRecord(task) && typeof task.key === "string" ? task.key : "";
    const normalized = normalizeTaskKey(groupedKey);
    if (!normalized || !isTaskKey(normalized)) {
      throw new BadRequestError(
        "TASK_INVALID_KEY",
        `"${groupedKey}" isn't a ticket key (e.g. PROJ-123).`,
      );
    }
    if (normalized === key || groupedTasks.some((t) => t.key === normalized)) continue;
    const groupedLink =
      isRecord(task) && typeof task.link === "string" && task.link.trim() ? task.link.trim() : null;
    groupedTasks.push({ key: normalized, link: groupedLink });
  }
  const noRepo = isRecord(raw) && raw.noRepo === true;
  const folders = !noRepo && isRecord(raw) && Array.isArray(raw.repos) ? raw.repos : [];

  const repos: string[] = [];
  for (const folder of folders) {
    if (typeof folder !== "string" || !folder.trim()) continue;
    const repoRoot = await getRepoRoot(folder.trim());
    if (!repoRoot) {
      throw new AppError("TASK_NOT_GIT_REPO", `"${folder}" is not inside a git repository.`);
    }
    if (!repos.includes(repoRoot)) repos.push(repoRoot);
  }
  const rawPrefix = isRecord(raw) ? raw.branchPrefix : null;
  const branchPrefix = typeof rawPrefix === "string" ? rawPrefix.trim() : null;
  if (branchPrefix && !SAFE_BRANCH_PREFIX.test(branchPrefix)) {
    throw new BadRequestError(
      "QUEUE_INVALID_BRANCH_PREFIX",
      `"${branchPrefix}" isn't a valid branch prefix (letters, numbers, "-", "_" and "." only).`,
    );
  }
  const kind = isRecord(raw) && raw.kind === "test" ? "test" : "dev";
  const rawBranch = isRecord(raw) && typeof raw.branch === "string" ? raw.branch.trim() : "";
  if (rawBranch && !SAFE_BRANCH_NAME.test(rawBranch)) {
    throw new BadRequestError(
      "QUEUE_INVALID_BRANCH",
      `"${rawBranch}" isn't a valid branch name (letters, numbers, "-", "_", "." and "/" only).`,
    );
  }
  const rawBase = isRecord(raw) && typeof raw.baseBranch === "string" ? raw.baseBranch.trim() : "";
  if (rawBase && !SAFE_BRANCH_NAME.test(rawBase)) {
    throw new BadRequestError(
      "QUEUE_INVALID_BRANCH",
      `"${rawBase}" isn't a valid branch name (letters, numbers, "-", "_", "." and "/" only).`,
    );
  }
  const useLocalBaseBranch = isRecord(raw) && raw.useLocalBaseBranch === true;
  // Kept as sent: the modal clears it to retry a failed launch.
  const error =
    isRecord(raw) && typeof raw.error === "string" && raw.error.trim() ? raw.error.trim() : null;
  return {
    key,
    link,
    groupedTasks,
    kind,
    repos,
    noRepo,
    branchPrefix,
    branch: rawBranch || null,
    baseBranch: rawBase || null,
    useLocalBaseBranch,
    error,
  };
}

/** A PR to review: `repo#id` and its page; the repo is its local clone, found once. */
async function parseReviewEntry(raw: Record<string, unknown>): Promise<QueueEntryInput> {
  const key = typeof raw.key === "string" ? raw.key.trim() : "";
  const repo = PR_SUBJECT.exec(key)?.[1];
  if (!repo) {
    throw new BadRequestError(
      "QUEUE_INVALID_PR",
      `"${key}" isn't a pull request (paste its link, e.g. .../my-repo/pull-requests/12).`,
    );
  }
  const saved = Array.isArray(raw.repos) && typeof raw.repos[0] === "string" ? raw.repos[0] : "";
  let repoPath = saved.trim();
  if (!repoPath) {
    const { config } = await reviewBoardSetup();
    repoPath = (await reviewRepoPath(config, repo)) ?? "";
    if (!repoPath) {
      throw new AppError(
        "REVIEW_REPO_NOT_FOUND",
        `No local clone of ${repo} in the workspace folders.`,
      );
    }
  }
  return {
    key,
    link: typeof raw.link === "string" && raw.link.trim() ? raw.link.trim() : null,
    groupedTasks: [],
    kind: "review",
    repos: [repoPath],
    noRepo: false,
    branchPrefix: null,
    branch: null,
    baseBranch: null,
    useLocalBaseBranch: false,
    error: typeof raw.error === "string" && raw.error.trim() ? raw.error.trim() : null,
  };
}

/** Replaces the whole queue (the modal saves its full list); a repeated key — an entry's own or
 *  grouped — keeps the first. */
export async function saveTaskQueue(body: unknown): Promise<QueueEntry[]> {
  const rawEntries = isRecord(body) && Array.isArray(body.entries) ? body.entries : [];
  const entries: QueueEntryInput[] = [];
  const seen = new Set<string>();
  for (const raw of rawEntries) {
    const entry = await parseEntry(raw);
    if (seen.has(entry.key)) continue;
    entry.groupedTasks = entry.groupedTasks?.filter((task) => !seen.has(task.key));
    for (const task of [entry, ...(entry.groupedTasks ?? [])]) seen.add(task.key);
    entries.push(entry);
  }
  const previous = new Map((await getQueue()).map((entry) => [entry.key, entry]));
  await setQueue(entries);
  const stored = await getQueue();
  recordQueueChanges(previous, stored);
  return stored;
}

function groupedKeysText(entry: QueueEntry): string {
  return (entry.groupedTasks ?? []).map((task) => task.key).join(",");
}

/** Added / removed / re-targeted entries and retries (a cleared error), for the history. */
function recordQueueChanges(previous: Map<string, QueueEntry>, stored: QueueEntry[]): void {
  const keys = new Set(stored.map((entry) => entry.key));
  for (const entry of stored) {
    const before = previous.get(entry.key);
    if (!before) {
      recordEvent("queue.added", {
        key: entry.key,
        link: entry.link,
        groupedKeys: (entry.groupedTasks ?? []).map((task) => task.key),
        kind: entry.kind,
        repos: entry.repos,
        noRepo: entry.noRepo,
        branchPrefix: entry.branchPrefix,
        branch: entry.branch,
        baseBranch: entry.baseBranch,
      });
      continue;
    }
    if (entry.launchedAt) continue;
    if (
      before.kind !== entry.kind ||
      groupedKeysText(before) !== groupedKeysText(entry) ||
      before.noRepo !== entry.noRepo ||
      before.branchPrefix !== entry.branchPrefix ||
      before.branch !== entry.branch ||
      before.baseBranch !== entry.baseBranch ||
      before.useLocalBaseBranch !== entry.useLocalBaseBranch ||
      before.repos.join("\n") !== entry.repos.join("\n")
    ) {
      recordEvent("queue.updated", {
        key: entry.key,
        groupedKeys: (entry.groupedTasks ?? []).map((task) => task.key),
        kind: entry.kind,
        repos: entry.repos,
        noRepo: entry.noRepo,
        branchPrefix: entry.branchPrefix,
        branch: entry.branch,
        baseBranch: entry.baseBranch,
        useLocalBaseBranch: entry.useLocalBaseBranch,
      });
    }
    if (before.error && !entry.error) {
      recordEvent("queue.retry", { key: entry.key, previousError: before.error });
    }
  }
  for (const [key, before] of previous) {
    if (!keys.has(key)) recordEvent("queue.removed", { key, launched: Boolean(before.launchedAt) });
  }
}

/**
 * Adds a test entry for `key` at the end of the queue unless the key is already there (queued or
 * launched). For the board watcher, which queues the Wait Test tickets it picks up.
 */
export async function addTestEntryIfAbsent(entry: {
  key: string;
  link: string | null;
  repos: string[];
  branch: string | null;
}): Promise<boolean> {
  const queue = await getQueue();
  if (queue.some((e) => e.key === entry.key)) return false;
  await saveTaskQueue({
    entries: [
      ...queue,
      {
        key: entry.key,
        link: entry.link,
        kind: "test",
        repos: entry.repos,
        noRepo: entry.repos.length === 0,
        branchPrefix: null,
        branch: entry.branch,
        baseBranch: null,
        useLocalBaseBranch: false,
        error: null,
      },
    ],
  });
  return true;
}

/**
 * Adds a review entry for the PR `key` (`repo#id`) at the end of the queue. For the board
 * automations, which queue the PRs due for their AI review: one that already launched is replaced
 * (its result couldn't be posted, e.g. a push came in meanwhile); one still waiting is left as it
 * is (false).
 */
export async function addReviewEntryIfAbsent(entry: {
  key: string;
  link: string | null;
  repo: string;
}): Promise<boolean> {
  const queue = await getQueue();
  const existing = queue.find((e) => e.key === entry.key);
  if (existing && !existing.launchedAt) return false;
  const rest = queue.filter((e) => e.key !== entry.key);
  // Removed first, so the new entry comes back without the old launch fields.
  if (existing) await saveTaskQueue({ entries: rest });
  await saveTaskQueue({
    entries: [...rest, { key: entry.key, link: entry.link, kind: "review", repos: [entry.repo] }],
  });
  return true;
}

/**
 * Queues `key` for a test again: a fresh test entry replaces an earlier one that already
 * launched (its session is over: the ticket got a fix after a failed test). An entry still
 * waiting to launch is left as it is (false).
 */
export async function requeueTestEntry(entry: {
  key: string;
  link: string | null;
  repos: string[];
  branch: string | null;
}): Promise<boolean> {
  const queue = await getQueue();
  const existing = queue.find((e) => e.key === entry.key);
  if (existing && !existing.launchedAt) return false;
  // Removed first, so the new entry comes back without the old launch fields.
  if (existing) await saveTaskQueue({ entries: queue.filter((e) => e.key !== entry.key) });
  return addTestEntryIfAbsent(entry);
}

/**
 * Adds a dev entry for `key` at the end of the queue unless the key is already there. For the
 * board watcher, which queues the user's own To Do tickets; with no repo it waits in the queue
 * for one to be chosen.
 */
export async function addDevEntryIfAbsent(entry: {
  key: string;
  link: string | null;
  repos: string[];
  branchPrefix: string | null;
}): Promise<boolean> {
  const queue = await getQueue();
  if (queue.some((e) => e.key === entry.key)) return false;
  await saveTaskQueue({
    entries: [
      ...queue,
      {
        key: entry.key,
        link: entry.link,
        kind: "dev",
        repos: entry.repos,
        noRepo: false,
        branchPrefix: entry.branchPrefix,
        branch: null,
        baseBranch: null,
        useLocalBaseBranch: false,
        error: null,
      },
    ],
  });
  return true;
}
