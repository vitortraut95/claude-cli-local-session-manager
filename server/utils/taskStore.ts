import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { recordEvent } from "./history.js";
import { REPO_ROOT } from "./repoRoot.js";

/**
 * This app's per-session/per-task data, in the gitignored `tasks.json` at the repo root (never in
 * `~/.claude/projects/`, which is the CLI's data).
 *
 * - `tasks[<ticket key>]`: task metadata (`link`, the hand-set work `status`). Membership lives on the entries' own `taskKey`.
 * - `sessions[<session id>]`: `nickname` (a local label, never replaces the real title),
 *   `origin`/`destination` (the session's base/task branches, either may be null), and a work
 *   `status` for a session with no task (a task's status lives on the task, shared by its sessions),
 *   and `test` for a test session (`taskTestService.ts`). A `taskKey`
 *   here comes from older versions and is moved to the branch entry on the next listing.
 * - `repoBranches[<repo root>][<branch>]`: the base a "New task" branch was created off (only when
 *   it differs from the repo default), its `taskKey` (the only place a task link is kept; none =
 *   inferred from the branch, see `taskKeys.ts`) and worktree. Keyed by `(repoRoot, branch)`
 *   because the session id doesn't exist yet at creation and a non-worktree task shares the repo
 *   root. Forgotten once the branch is deleted.
 * - `queue`: tasks waiting to be started (`kind` dev = develop it, test = test its branch), each with the repos it'll be worked in (the first one is
 *   the main repo, the others join its session via `--add-dir`), in the order they were added.
 *   The scheduler sets `launchedAt`/`sessionId` once it starts one, or `error` when that failed
 *   (skipped until cleared).
 *
 * `migrateLegacySidecars` builds this file once from `custom-titles.json`, `session-branches.json`
 * and `task-base-branches.json` when it doesn't exist yet; the old files are deleted on a later
 * start. All writes go through one in-process queue with an atomic temp-file + rename.
 */

export const WORK_STATUSES = ["todo", "in_progress", "waiting_user", "done"] as const;
export type WorkStatus = (typeof WORK_STATUSES)[number];

export function isWorkStatus(value: unknown): value is WorkStatus {
  return typeof value === "string" && (WORK_STATUSES as readonly string[]).includes(value);
}

type TaskEntry = {
  link: string | null;
  status: WorkStatus | null;
  createdAt: string;
};

/** A test session (launched from the queue): the ticket it tests and the disposable worktrees it
 *  was given, emptied once they're removed. */
export type TestSessionInfo = { key: string; worktrees: string[] };

type SessionEntry = {
  nickname: string | null;
  origin: string | null;
  destination: string | null;
  taskKey: string | null;
  status: WorkStatus | null;
  test: TestSessionInfo | null;
};

type RepoBranchEntry = {
  baseBranch: string | null;
  createdAt: string;
  taskKey: string | null;
  worktreePath: string | null;
};

/** "dev" = develop the task (new branch and worktree); "test" = test someone else's branch. */
export type QueueKind = "dev" | "test";

export type QueueEntry = {
  key: string;
  link: string | null;
  kind: QueueKind;
  repos: string[];
  /** No repo on purpose: the session opens in the first workspace dir, with no branch. */
  noRepo: boolean;
  /** The task branch is `<prefix>/<key>`; "" = just `<key>`; null = not chosen yet (not
   *  launched until it is). */
  branchPrefix: string | null;
  /** Test only: the branch to test; null = the one on origin whose name has the key. */
  branch: string | null;
  /** Dev only: what the task branch starts from in the main repo; null = the repo's default.
   *  `useLocalBaseBranch` takes the local branch instead of a freshly fetched origin one. */
  baseBranch: string | null;
  useLocalBaseBranch: boolean;
  addedAt: string;
  launchedAt: string | null;
  sessionId: string | null;
  error: string | null;
};

/** What the queue modal saves; the launch fields are only ever set by the scheduler. */
export type QueueEntryInput = Pick<
  QueueEntry,
  | "key"
  | "link"
  | "kind"
  | "repos"
  | "noRepo"
  | "branchPrefix"
  | "branch"
  | "baseBranch"
  | "useLocalBaseBranch"
  | "error"
>;

export type TaskStore = {
  version: 1;
  tasks: Record<string, TaskEntry>;
  sessions: Record<string, SessionEntry>;
  repoBranches: Record<string, Record<string, RepoBranchEntry>>;
  queue: QueueEntry[];
};

const STORE_FILE = "tasks.json";

function storePath(): string {
  return path.join(REPO_ROOT, STORE_FILE);
}

function emptyStore(): TaskStore {
  return { version: 1, tasks: {}, sessions: {}, repoBranches: {}, queue: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asTextOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isEmptySession(entry: SessionEntry): boolean {
  return (
    !entry.nickname &&
    !entry.origin &&
    !entry.destination &&
    !entry.taskKey &&
    !entry.status &&
    !entry.test
  );
}

function isEmptyRepoBranch(entry: RepoBranchEntry): boolean {
  return !entry.baseBranch && !entry.taskKey;
}

function normalizeTestInfo(raw: unknown): TestSessionInfo | null {
  if (!isRecord(raw) || typeof raw.key !== "string" || !raw.key.trim()) return null;
  return {
    key: raw.key.trim(),
    worktrees: Array.isArray(raw.worktrees)
      ? raw.worktrees.filter((w): w is string => typeof w === "string" && !!w.trim())
      : [],
  };
}

/** Tolerant of a hand-edited file: unknown fields are dropped, missing ones default to null. */
function normalizeStore(parsed: Record<string, unknown>): TaskStore {
  const store = emptyStore();

  if (isRecord(parsed.tasks)) {
    for (const [key, raw] of Object.entries(parsed.tasks)) {
      if (!isRecord(raw)) continue;
      store.tasks[key] = {
        link: asTextOrNull(raw.link),
        status: isWorkStatus(raw.status) ? raw.status : null,
        createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
      };
    }
  }

  if (isRecord(parsed.sessions)) {
    for (const [id, raw] of Object.entries(parsed.sessions)) {
      if (!isRecord(raw)) continue;
      const entry: SessionEntry = {
        nickname: asTextOrNull(raw.nickname),
        origin: asTextOrNull(raw.origin),
        destination: asTextOrNull(raw.destination),
        taskKey: asTextOrNull(raw.taskKey),
        status: isWorkStatus(raw.status) ? raw.status : null,
        test: normalizeTestInfo(raw.test),
      };
      if (!isEmptySession(entry)) store.sessions[id] = entry;
    }
  }

  if (isRecord(parsed.repoBranches)) {
    for (const [repoRoot, branches] of Object.entries(parsed.repoBranches)) {
      if (!isRecord(branches)) continue;
      for (const [branch, raw] of Object.entries(branches)) {
        if (!isRecord(raw)) continue;
        const entry: RepoBranchEntry = {
          baseBranch: asTextOrNull(raw.baseBranch),
          createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
          taskKey: asTextOrNull(raw.taskKey),
          worktreePath: asTextOrNull(raw.worktreePath),
        };
        if (!isEmptyRepoBranch(entry)) (store.repoBranches[repoRoot] ??= {})[branch] = entry;
      }
    }
  }

  if (Array.isArray(parsed.queue)) {
    for (const raw of parsed.queue) {
      if (!isRecord(raw) || typeof raw.key !== "string" || !raw.key.trim()) continue;
      if (store.queue.some((entry) => entry.key === raw.key)) continue;
      store.queue.push({
        key: raw.key.trim(),
        link: asTextOrNull(raw.link),
        kind: raw.kind === "test" ? "test" : "dev",
        repos: Array.isArray(raw.repos)
          ? [...new Set(raw.repos.filter((r): r is string => typeof r === "string" && !!r.trim()))]
          : [],
        noRepo: raw.noRepo === true,
        branchPrefix: typeof raw.branchPrefix === "string" ? raw.branchPrefix.trim() : null,
        branch: asTextOrNull(raw.branch),
        baseBranch: asTextOrNull(raw.baseBranch),
        useLocalBaseBranch: raw.useLocalBaseBranch === true,
        addedAt: typeof raw.addedAt === "string" ? raw.addedAt : "",
        launchedAt: asTextOrNull(raw.launchedAt),
        sessionId: asTextOrNull(raw.sessionId),
        error: asTextOrNull(raw.error),
      });
    }
  }

  return store;
}

async function readJsonRecord(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = JSON.parse(await readFile(filePath, "utf8"));
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function writeStore(store: TaskStore): Promise<void> {
  const target = storePath();
  const tmpPath = `${target}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmpPath, JSON.stringify(store, null, 2), "utf8");
  await rename(tmpPath, target);
}

const LEGACY_FILES = ["custom-titles.json", "session-branches.json", "task-base-branches.json"];

/** Best-effort; only called once `tasks.json` exists, so the migration no longer needs them. */
async function deleteLegacySidecars(): Promise<void> {
  await Promise.all(
    [...LEGACY_FILES, "session-continuations.json"].map((name) =>
      unlink(path.join(REPO_ROOT, name)).catch(() => undefined),
    ),
  );
}

/** Builds the store from the legacy files (a missing or malformed one contributes nothing);
 *  null when none exists. */
async function buildFromLegacyFiles(): Promise<TaskStore | null> {
  const [nicknames, branches, bases] = await Promise.all(
    LEGACY_FILES.map((name) => readJsonRecord(path.join(REPO_ROOT, name))),
  );
  if (!nicknames && !branches && !bases) return null;

  const sessions: Record<string, Record<string, unknown>> = {};
  for (const [id, nickname] of Object.entries(nicknames ?? {})) {
    (sessions[id] ??= {}).nickname = nickname;
  }
  for (const [id, entry] of Object.entries(branches ?? {})) {
    if (!isRecord(entry)) continue;
    Object.assign((sessions[id] ??= {}), {
      origin: entry.origin,
      destination: entry.destination,
    });
  }
  return normalizeStore({ sessions, repoBranches: bases ?? {} });
}

type MigrationResult = { migrated: boolean; sessions: number; branches: number };

let migration: Promise<MigrationResult> | null = null;

/**
 * Runs at most once per process: when `tasks.json` doesn't exist yet, fills it from the legacy
 * files. Awaited by every read/write so nothing sees a half-migrated state.
 */
export function migrateLegacySidecars(): Promise<MigrationResult> {
  migration ??= (async () => {
    const existing = await readFile(storePath(), "utf8").catch((err: NodeJS.ErrnoException) =>
      err.code === "ENOENT" ? null : "",
    );
    if (existing !== null) {
      await deleteLegacySidecars();
      return { migrated: false, sessions: 0, branches: 0 };
    }

    const store = await buildFromLegacyFiles();
    if (!store) return { migrated: false, sessions: 0, branches: 0 };

    await writeStore(store);
    const branches = Object.values(store.repoBranches).reduce(
      (sum, byBranch) => sum + Object.keys(byBranch).length,
      0,
    );
    return { migrated: true, sessions: Object.keys(store.sessions).length, branches };
  })();
  return migration;
}

/** An unparseable `tasks.json` is moved aside (`tasks.json.broken-<time>`) rather than
 *  overwritten, so a bad hand edit stays recoverable. */
async function readStore(): Promise<TaskStore> {
  await migrateLegacySidecars();
  let raw: string;
  try {
    raw = await readFile(storePath(), "utf8");
  } catch {
    return emptyStore();
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isRecord(parsed)) return normalizeStore(parsed);
  } catch {
    // Falls through to the move-aside below.
  }
  const backupPath = `${storePath()}.broken-${Date.now()}`;
  await rename(storePath(), backupPath).catch(() => undefined);
  console.warn(`[tasks.json] Unreadable — moved to ${path.basename(backupPath)}, starting empty.`);
  return emptyStore();
}

let writeQueue: Promise<unknown> = Promise.resolve();

function mutateStore(mutate: (store: TaskStore) => boolean): Promise<void> {
  const run = writeQueue.then(async () => {
    const store = await readStore();
    if (mutate(store)) await writeStore(store);
  });
  // A failed write must not wedge every later one.
  writeQueue = run.catch(() => undefined);
  return run;
}

function updateSession(id: string, patch: Partial<SessionEntry>): Promise<void> {
  return mutateStore((store) => {
    const entry = {
      nickname: null,
      origin: null,
      destination: null,
      taskKey: null,
      status: null,
      test: null,
      ...store.sessions[id],
      ...patch,
    };
    if (isEmptySession(entry)) {
      if (!store.sessions[id]) return false;
      delete store.sessions[id];
    } else {
      store.sessions[id] = entry;
    }
    return true;
  });
}

export async function getNicknames(): Promise<Record<string, string>> {
  const { sessions } = await readStore();
  const result: Record<string, string> = {};
  for (const [id, entry] of Object.entries(sessions)) {
    if (entry.nickname) result[id] = entry.nickname;
  }
  return result;
}

/** Blank/whitespace-only `nickname` clears it. */
export function setNickname(id: string, nickname: string): Promise<void> {
  return updateSession(id, { nickname: asTextOrNull(nickname) });
}

/** Blank/whitespace-only values clear that side. */
export function setSessionBranchOverride(
  id: string,
  origin: string,
  destination: string,
): Promise<void> {
  return updateSession(id, {
    origin: asTextOrNull(origin),
    destination: asTextOrNull(destination),
  });
}

/** Drops everything kept about a session (called when its transcript is deleted). */
export function forgetSession(id: string): Promise<void> {
  return mutateStore((store) => {
    if (!store.sessions[id]) return false;
    delete store.sessions[id];
    return true;
  });
}

/** Marks `id` as a test session of `key`, given `worktrees`. */
export function markTestSession(id: string, key: string, worktrees: string[]): Promise<void> {
  return updateSession(id, { test: { key, worktrees } });
}

/** The test worktrees still left to remove (the session stays marked as a test). */
export function setTestWorktrees(id: string, worktrees: string[]): Promise<void> {
  return mutateStore((store) => {
    const test = store.sessions[id]?.test;
    if (!test) return false;
    test.worktrees = worktrees;
    return true;
  });
}

export function getTaskStore(): Promise<TaskStore> {
  return readStore();
}

/** Applies `patch` to a branch entry in place (creating or dropping it); false = nothing changed. */
function patchRepoBranch(
  store: TaskStore,
  repoRoot: string,
  branchName: string,
  patch: Partial<RepoBranchEntry>,
): boolean {
  const current = store.repoBranches[repoRoot]?.[branchName];
  const entry: RepoBranchEntry = {
    baseBranch: null,
    createdAt: new Date().toISOString(),
    taskKey: null,
    worktreePath: null,
    ...current,
    ...patch,
  };
  const byBranch = store.repoBranches[repoRoot];
  if (isEmptyRepoBranch(entry)) {
    if (!current || !byBranch) return false;
    delete byBranch[branchName];
    if (Object.keys(byBranch).length === 0) delete store.repoBranches[repoRoot];
  } else {
    (store.repoBranches[repoRoot] ??= {})[branchName] = entry;
  }
  return true;
}

function updateRepoBranch(
  repoRoot: string,
  branchName: string,
  patch: Partial<RepoBranchEntry>,
): Promise<void> {
  return mutateStore((store) => patchRepoBranch(store, repoRoot, branchName, patch));
}

export function recordTaskBaseBranch(
  repoRoot: string,
  branchName: string,
  baseBranch: string,
): Promise<void> {
  return updateRepoBranch(repoRoot, branchName, { baseBranch });
}

/** `taskKey` null unlinks the branch from its task (its recorded base, if any, stays). */
export function linkRepoBranchToTask(
  repoRoot: string,
  branchName: string,
  taskKey: string | null,
  worktreePath?: string | null,
): Promise<void> {
  return updateRepoBranch(repoRoot, branchName, {
    taskKey,
    ...(worktreePath !== undefined ? { worktreePath } : {}),
  });
}

/** The branch itself is gone — drops everything recorded about it, task link included. */
export function forgetRepoBranch(repoRoot: string, branchName: string): Promise<void> {
  return mutateStore((store) => {
    const byBranch = store.repoBranches[repoRoot];
    if (!byBranch?.[branchName]) return false;
    delete byBranch[branchName];
    if (Object.keys(byBranch).length === 0) delete store.repoBranches[repoRoot];
    return true;
  });
}

/** Moves a session's own `taskKey` (written by older versions) onto its branch entry, the one
 *  place a task link is kept now. */
export function moveSessionTaskKeyToBranch(
  id: string,
  repoRoot: string,
  branchName: string,
): Promise<void> {
  return mutateStore((store) => {
    const session = store.sessions[id];
    if (!session?.taskKey) return false;
    patchRepoBranch(store, repoRoot, branchName, { taskKey: session.taskKey });
    const rest = { ...session, taskKey: null };
    if (isEmptySession(rest)) delete store.sessions[id];
    else store.sessions[id] = rest;
    return true;
  });
}

/** Creates the task entry if missing; a non-blank `link` replaces the stored one. */
export function upsertTask(key: string, link: string | null): Promise<void> {
  return mutateStore((store) => {
    const current = store.tasks[key];
    const trimmedLink = asTextOrNull(link);
    if (current && (!trimmedLink || current.link === trimmedLink)) return false;
    store.tasks[key] = {
      link: trimmedLink ?? current?.link ?? null,
      status: current?.status ?? null,
      createdAt: current?.createdAt ?? new Date().toISOString(),
    };
    return true;
  });
}

/** Who changed a status, for the history: the user on a card, or the scheduler on launch. */
export type StatusSource = "user" | "scheduler";

/** `null` clears it. */
export async function setSessionStatus(
  id: string,
  status: WorkStatus | null,
  source: StatusSource = "user",
): Promise<void> {
  const from = (await readStore()).sessions[id]?.status ?? null;
  await updateSession(id, { status });
  if (from !== status) recordEvent("status.changed", { sessionId: id, from, to: status, source });
}

/** Creates the task entry if missing (a key only inferred from a branch has none yet). */
export async function setTaskStatus(
  key: string,
  status: WorkStatus | null,
  source: StatusSource = "user",
): Promise<void> {
  let from: WorkStatus | null = null;
  let changed = false;
  await mutateStore((store) => {
    const current = store.tasks[key];
    from = current?.status ?? null;
    if (current?.status === status) return false;
    store.tasks[key] = {
      link: current?.link ?? null,
      status,
      createdAt: current?.createdAt ?? new Date().toISOString(),
    };
    changed = true;
    return true;
  });
  if (changed) recordEvent("status.changed", { key, from, to: status, source });
}

export async function getQueue(): Promise<QueueEntry[]> {
  return (await readStore()).queue;
}

/**
 * Replaces the whole queue. An entry already queued keeps its `addedAt`, and one the scheduler
 * already launched keeps its launch fields and repos — a modal opened before the launch can't
 * put it back in line.
 */
export function setQueue(entries: QueueEntryInput[]): Promise<void> {
  return mutateStore((store) => {
    const previous = new Map(store.queue.map((entry) => [entry.key, entry]));
    const now = new Date().toISOString();
    store.queue = entries.map((entry) => {
      const stored = previous.get(entry.key);
      if (stored?.launchedAt) return stored;
      return {
        ...entry,
        addedAt: stored?.addedAt ?? now,
        launchedAt: null,
        sessionId: null,
      };
    });
    return true;
  });
}

/** Patches one entry in place (no-op when it was removed meanwhile). */
export function updateQueueEntry(
  key: string,
  patch: Partial<Pick<QueueEntry, "launchedAt" | "sessionId" | "error">>,
): Promise<void> {
  return mutateStore((store) => {
    const entry = store.queue.find((e) => e.key === key);
    if (!entry) return false;
    Object.assign(entry, patch);
    return true;
  });
}
