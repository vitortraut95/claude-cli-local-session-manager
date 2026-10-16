import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { REPO_ROOT } from "./repoRoot.js";

/**
 * This app's own per-session/per-task data, in one gitignored sidecar file at the repo root
 * (`tasks.json`) — same convention as `userPreferences.json`, so it's visible/editable/deletable
 * right alongside the project instead of buried in a dotfolder under the home directory. Never
 * written to `~/.claude/projects/`: that's the Claude CLI's own data.
 *
 * Three sections, each keyed the way its data is actually identified:
 * - `tasks[<ticket key>]` — a task (usually a Jira ticket, e.g. `PROJ-123`) that may span several
 *   repos and sessions: just its metadata (`link`). Which repos and sessions belong to it is
 *   recorded on those entries' own `taskKey`, below, so deleting a branch also drops it from its
 *   task without a second place to keep in sync.
 * - `sessions[<session id>]` — what this app knows about one session:
 *   - `nickname`: a purely local label shown alongside the session's real (auto-derived) title,
 *     never replacing it and with no effect outside this app (e.g. a Warp tab's title, which
 *     Claude Code itself controls — see CLAUDE.md).
 *   - `origin`/`destination`: the base/task branches set by hand on the card or recorded by
 *     "New task" at launch — one session's view of its branches (e.g. correcting a stale
 *     transcript-recorded `gitBranch`), not a fact about the branch itself. Either may be null.
 *   - `taskKey`: the task this session belongs to, when set by "New task"/"add repo" or by hand.
 *     null = not set (the key is then inferred, see `taskKeys.ts`); "" = explicitly none, which
 *     stops the inference.
 * - `repoBranches[<repo root>][<branch>]` — facts about a branch: the base a "New task" branch was
 *   created off, the task it belongs to (`taskKey`) and the worktree it was created in, if any. Keyed by `(repoRoot, branch)` rather than worktree path or session id: the session
 *   id doesn't exist yet when the branch is created, and a "skip worktree" task checks its branch
 *   out directly in the shared repo root, while a branch name is unique within a repo either way.
 *   `baseBranch` is only set when it differs from the repo's own default (`getDefaultBaseBranch`);
 *   the whole entry is forgotten once the branch itself is deleted (the three call sites in
 *   sessionService.ts).
 *
 * Replaces three older files (`custom-titles.json`, `session-branches.json`,
 * `task-base-branches.json`) — `migrateLegacySidecars` below folds them in once, unattended, the
 * first time this file is missing (see CLAUDE.md's "Update safety policy": users only ever get
 * changes through the forced "Update app", with no manual step). The old files are left on disk,
 * just no longer read or written.
 *
 * Every write goes through one in-process queue (read → mutate → atomic temp-file + rename), so two
 * requests landing close together can't each read the same "before" state and clobber one another
 * — this file has more writers than any one of the old ones did.
 */

export type TaskEntry = {
  link: string | null;
  createdAt: string;
};

export type SessionEntry = {
  nickname: string | null;
  origin: string | null;
  destination: string | null;
  taskKey: string | null;
};

export type RepoBranchEntry = {
  baseBranch: string | null;
  createdAt: string;
  taskKey: string | null;
  worktreePath: string | null;
};

export type TaskStore = {
  version: 1;
  tasks: Record<string, TaskEntry>;
  sessions: Record<string, SessionEntry>;
  repoBranches: Record<string, Record<string, RepoBranchEntry>>;
};

const STORE_FILE = "tasks.json";

function storePath(): string {
  return path.join(REPO_ROOT, STORE_FILE);
}

function emptyStore(): TaskStore {
  return { version: 1, tasks: {}, sessions: {}, repoBranches: {} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asTextOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Like `asTextOrNull`, but keeps "" — a session's "explicitly no task" marker. */
function asTaskKeyOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.trim();
}

function isEmptySession(entry: SessionEntry): boolean {
  return !entry.nickname && !entry.origin && !entry.destination && entry.taskKey === null;
}

function isEmptyRepoBranch(entry: RepoBranchEntry): boolean {
  return !entry.baseBranch && !entry.taskKey;
}

/** Tolerant of a hand-edited file: unknown fields are dropped, missing ones default to null. */
function normalizeStore(parsed: Record<string, unknown>): TaskStore {
  const store = emptyStore();

  if (isRecord(parsed.tasks)) {
    for (const [key, raw] of Object.entries(parsed.tasks)) {
      if (!isRecord(raw)) continue;
      store.tasks[key] = {
        link: asTextOrNull(raw.link),
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
        taskKey: asTaskKeyOrNull(raw.taskKey),
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

/**
 * Builds the store from the three files it replaces, read with the same tolerance their own
 * modules had (a missing or malformed file just contributes nothing). Returns null when none of
 * them exists — a fresh clone, nothing to migrate.
 */
async function buildFromLegacyFiles(): Promise<TaskStore | null> {
  const [nicknames, branches, bases] = await Promise.all([
    readJsonRecord(path.join(REPO_ROOT, "custom-titles.json")),
    readJsonRecord(path.join(REPO_ROOT, "session-branches.json")),
    readJsonRecord(path.join(REPO_ROOT, "task-base-branches.json")),
  ]);
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
 * Runs at most once per process: when `tasks.json` doesn't exist yet, fills it from the older
 * sidecar files. Idempotent across restarts (an existing `tasks.json` is never rebuilt), and
 * awaited by every read/write below, so nothing can see — or write over — a half-migrated state.
 * Also kicked off at server start (`server/index.ts`) just to log what it did.
 */
export function migrateLegacySidecars(): Promise<MigrationResult> {
  migration ??= (async () => {
    const existing = await readFile(storePath(), "utf8").catch((err: NodeJS.ErrnoException) =>
      err.code === "ENOENT" ? null : "",
    );
    if (existing !== null) return { migrated: false, sessions: 0, branches: 0 };

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

/**
 * A `tasks.json` that exists but can't be parsed is moved aside (`tasks.json.broken-<time>`)
 * before anything is written over it, so a bad hand edit is recoverable instead of silently
 * replaced by an empty store.
 */
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

/** One read of the whole store — for `listSessions`, which needs every section at once. */
export function getTaskStore(): Promise<TaskStore> {
  return readStore();
}

function updateRepoBranch(
  repoRoot: string,
  branchName: string,
  patch: Partial<RepoBranchEntry>,
): Promise<void> {
  return mutateStore((store) => {
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
  });
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

/** null = back to inferring the key; "" = explicitly no task. */
export function setSessionTaskKey(id: string, taskKey: string | null): Promise<void> {
  return updateSession(id, { taskKey });
}

/** Creates the task entry if missing; a non-blank `link` replaces the stored one. */
export function upsertTask(key: string, link: string | null): Promise<void> {
  return mutateStore((store) => {
    const current = store.tasks[key];
    const trimmedLink = asTextOrNull(link);
    if (current && (!trimmedLink || current.link === trimmedLink)) return false;
    store.tasks[key] = {
      link: trimmedLink ?? current?.link ?? null,
      createdAt: current?.createdAt ?? new Date().toISOString(),
    };
    return true;
  });
}
