import { getRepoRoot } from "../utils/git.js";
import { AppError, BadRequestError } from "../utils/httpError.js";
import { isTaskKey, normalizeTaskKey } from "../utils/taskKeys.js";
import { recordEvent } from "../utils/history.js";
import { getQueue, setQueue, type QueueEntry, type QueueEntryInput } from "../utils/taskStore.js";

/**
 * The task queue: tickets pasted in to be worked on, each tied to the repo(s) it'll be done in.
 * `taskSchedulerService` launches them.
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
 *  with no repo yet is kept (still to be chosen). */
async function parseEntry(raw: unknown): Promise<QueueEntryInput> {
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
  const folders = isRecord(raw) && Array.isArray(raw.repos) ? raw.repos : [];

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
  // Kept as sent: the modal clears it to retry a failed launch.
  const error =
    isRecord(raw) && typeof raw.error === "string" && raw.error.trim() ? raw.error.trim() : null;
  return { key, link, repos, branchPrefix, error };
}

/** Replaces the whole queue (the modal saves its full list); a repeated key keeps the first. */
export async function saveTaskQueue(body: unknown): Promise<QueueEntry[]> {
  const rawEntries = isRecord(body) && Array.isArray(body.entries) ? body.entries : [];
  const entries: QueueEntryInput[] = [];
  for (const raw of rawEntries) {
    const entry = await parseEntry(raw);
    if (!entries.some((e) => e.key === entry.key)) entries.push(entry);
  }
  const previous = new Map((await getQueue()).map((entry) => [entry.key, entry]));
  await setQueue(entries);
  const stored = await getQueue();
  recordQueueChanges(previous, stored);
  return stored;
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
        repos: entry.repos,
        branchPrefix: entry.branchPrefix,
      });
      continue;
    }
    if (entry.launchedAt) continue;
    if (
      before.branchPrefix !== entry.branchPrefix ||
      before.repos.join("\n") !== entry.repos.join("\n")
    ) {
      recordEvent("queue.updated", {
        key: entry.key,
        repos: entry.repos,
        branchPrefix: entry.branchPrefix,
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
