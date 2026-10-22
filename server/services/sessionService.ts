import { spawn } from "node:child_process";
import { accessSync, constants, realpathSync } from "node:fs";
import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  RootStatus,
  Session,
  SessionPreview,
  WorktreeToRootPreview,
} from "../types/session.js";
import {
  listPreviewServers,
  previewsFor,
  stopPreviewsIn,
  type PreviewServer,
} from "./previewService.js";
import {
  findJsonlFiles,
  forgetCachedSession,
  getClaudeProjectsDir,
  readFullSessionPrompts,
  readSessionActiveTimeMs,
  readSessionHead,
  readSessionLatestGitBranch,
  readSessionPrompts,
  readSessionRecap,
  type SessionHead,
} from "../utils/claudeProjects.js";
import { inferTaskKey } from "../utils/taskKeys.js";
import { collectTaskRepos } from "../utils/taskRepos.js";
import {
  assertRootFreeFor,
  getRootLock,
  lockRootForCheckout,
  lockRootForCopy,
  taskKeyForBranch,
} from "./rootLockService.js";
import {
  forgetRepoBranch,
  forgetSession,
  getTaskStore,
  moveSessionTaskKeyToBranch,
  setNickname,
  setSessionBranchOverride,
  setSessionStatus,
  type WorkStatus,
} from "../utils/taskStore.js";
import { markWorktreeTrustAccepted } from "../utils/claudeTrust.js";
import { getUserPreferences, type TerminalLayout } from "./preferencesService.js";
import { focusLimuxSession, isLimuxAvailable, launchInLimuxGrid } from "./limuxGridService.js";
import {
  AppError,
  BadRequestError,
  ConflictError,
  errorMessage,
  NotFoundError,
} from "../utils/httpError.js";
import { recordEvent } from "../utils/history.js";
import {
  belongsTo,
  readHistory,
  summarize,
  type HistoryEvent,
  type HistorySummary,
  type HistoryTarget,
} from "./historyService.js";
import { REPO_ROOT } from "../utils/repoRoot.js";
import { sanitizedSpawnEnv } from "../utils/spawnEnv.js";
import {
  applyFileDiff,
  checkoutExistingBranch,
  computeFileDiff,
  deleteLocalBranch,
  discardWorkingTreeChanges,
  forceRemoveWorktree,
  getDefaultBaseBranch,
  getGitDirs,
  getGitHostInfo,
  getRepoRoot,
  getStatusFiles,
  isLinkedWorktree,
  listAppStashes,
  getWorktreeBranch,
  listWorktrees,
  nestedWorktreeRelativePaths,
  removeWorktreeAndBranch,
  removeWorktreeKeepBranch,
  runGit,
  sanitizeWorktreeDirName,
} from "../utils/git.js";

const UNTITLED = "Untitled";
const TITLE_MAX_LENGTH = 100;

function cleanTitle(raw: string): string {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  if (!collapsed) return UNTITLED;
  return collapsed.length > TITLE_MAX_LENGTH
    ? `${collapsed.slice(0, TITLE_MAX_LENGTH - 1)}…`
    : collapsed;
}

/** `aiTitle` > `summaryTitle` > the CLI's away-summary recap > the first prompt. */
function resolveTitle(head: SessionHead, recap: string | null): string {
  const source = head.aiTitle ?? head.summaryTitle ?? recap ?? head.firstUserText;
  return source ? cleanTitle(source) : UNTITLED;
}

function resolveProject(head: SessionHead, filePath: string): string {
  if (head.cwd) return path.basename(head.cwd);
  const projectDir = path.basename(path.dirname(filePath));
  return projectDir.replace(/^-/, "") || projectDir;
}

/** Worktrees live at `<repoRoot>/.claude/worktrees/<name>`; once one is gone, splitting the
 *  recorded `cwd` is the only way left to recover its repo root. */
const WORKTREE_PATH_SEGMENT = "/.claude/worktrees/";

function repoRootFromMissingWorktreePath(cwd: string): string | null {
  const index = cwd.indexOf(WORKTREE_PATH_SEGMENT);
  return index === -1 ? null : cwd.slice(0, index);
}

type BuiltSession = Omit<
  Session,
  | "isActive"
  | "nickname"
  | "baseBranch"
  | "isAppRepo"
  | "savedOriginBranch"
  | "savedDestinationBranch"
  | "defaultBranch"
>;

async function buildSession(filePath: string): Promise<BuiltSession | null> {
  try {
    const [head, fileStat, prompts, activeTimeMs, recap, latestGitBranch] = await Promise.all([
      readSessionHead(filePath),
      stat(filePath),
      readSessionPrompts(filePath),
      readSessionActiveTimeMs(filePath),
      readSessionRecap(filePath),
      readSessionLatestGitBranch(filePath),
    ]);
    const id = head.sessionId ?? path.basename(filePath, ".jsonl");
    // An unknown cwd isn't treated as missing.
    const directoryMissing = head.cwd ? !(await directoryExists(head.cwd)) : false;
    const repoRootGuess =
      directoryMissing && head.cwd ? repoRootFromMissingWorktreePath(head.cwd) : null;
    const missingWorktreeRepoRoot =
      repoRootGuess && (await directoryExists(repoRootGuess)) ? repoRootGuess : null;

    return {
      id,
      title: resolveTitle(head, recap),
      project: resolveProject(head, filePath),
      path: filePath,
      workingDirectory: head.cwd,
      // The last branch logged: a session can switch branches mid-way.
      gitBranch: latestGitBranch ?? head.gitBranch,
      // Placeholder; listSessions() fills it in once per unique workingDirectory.
      isWorktree: false,
      updatedAt: fileStat.mtime.toISOString(),
      prompts,
      directoryMissing,
      missingWorktreeRepoRoot,
      sizeBytes: fileStat.size,
      activeTimeMs,
    };
  } catch {
    return null;
  }
}

/**
 * Active sessions come from the CLI's state files `~/.claude/sessions/<pid>.json`
 * (`{pid, sessionId, ...}`, removed on clean exit), confirmed with a signal-0 `kill` since a dead
 * pid's file is a leftover. `ps` can't be used: the CLI hides its args.
 */
function getClaudeSessionsDir(): string {
  return path.join(os.homedir(), ".claude", "sessions");
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function getActiveResumeSessionIds(): Promise<Set<string>> {
  const dir = getClaudeSessionsDir();
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return new Set();
  }

  const ids = new Set<string>();
  await Promise.all(
    entries
      .filter((name) => name.endsWith(".json"))
      .map(async (name) => {
        try {
          const raw = await readFile(path.join(dir, name), "utf-8");
          const data = JSON.parse(raw) as { pid?: number; sessionId?: string };
          if (data.pid && data.sessionId && isProcessAlive(data.pid)) {
            ids.add(data.sessionId);
          }
        } catch {
          // Ignore unreadable/malformed session state files.
        }
      }),
  );
  return ids;
}

/** The live pid running `sessionId`, if any. */
async function findActiveSessionPid(sessionId: string): Promise<number | null> {
  const dir = getClaudeSessionsDir();
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return null;
  }

  for (const name of entries.filter((n) => n.endsWith(".json"))) {
    try {
      const raw = await readFile(path.join(dir, name), "utf-8");
      const data = JSON.parse(raw) as { pid?: number; sessionId?: string };
      if (data.sessionId === sessionId && data.pid && isProcessAlive(data.pid)) {
        return data.pid;
      }
    } catch {
      // Ignore unreadable/malformed session state files.
    }
  }
  return null;
}

/** Polls until `pid` is gone or `timeoutMs` elapses. */
function waitForProcessExit(pid: number, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (!isProcessAlive(pid) || Date.now() - start > timeoutMs) {
        clearInterval(interval);
        resolve();
      }
    }, 200);
  });
}

export type ScanProgress = { total: number; done: number; scanning: boolean };

/** Progress of the in-flight `listSessions` scan (slow on a cold cache). Process-wide: a second
 *  concurrent scan overwrites it. */
const scanProgress: ScanProgress = { total: 0, done: 0, scanning: false };

export function getScanProgress(): ScanProgress {
  return { ...scanProgress };
}

export async function listSessions(): Promise<Session[]> {
  scanProgress.total = 0;
  scanProgress.done = 0;
  scanProgress.scanning = true;
  try {
    return await listSessionsUncached();
  } finally {
    scanProgress.scanning = false;
  }
}

async function listSessionsUncached(): Promise<Session[]> {
  const files = await findJsonlFiles(getClaudeProjectsDir());
  scanProgress.total = files.length;
  const [built, activeIds, store] = await Promise.all([
    Promise.all(
      files.map(async (file) => {
        const result = await buildSession(file);
        scanProgress.done += 1;
        return result;
      }),
    ),
    getActiveResumeSessionIds(),
    getTaskStore(),
  ]);

  const sessions = built.filter((session): session is BuiltSession => session !== null);

  // Once per unique workingDirectory, not per session.
  const uniqueDirs = [
    ...new Set(sessions.map((s) => s.workingDirectory).filter((d) => d !== null)),
  ];
  const gitDirsList = await Promise.all(uniqueDirs.map((dir) => getGitDirs(dir)));
  const gitDirsByDir = new Map(uniqueDirs.map((dir, i) => [dir, gitDirsList[i]]));
  // git reports real paths, so compare against REPO_ROOT's real path too (symlinked checkout).
  const appRepoRoot = realpathSync(REPO_ROOT);
  // Once per repo: the base shown for a task branched off the default (never recorded).
  const uniqueRepoRoots = [
    ...new Set(gitDirsList.filter((d) => d !== null).map((d) => path.dirname(d.commonGitDir))),
  ];
  const defaultBranches = await Promise.all(
    uniqueRepoRoots.map((root) => getDefaultBaseBranch(root).catch(() => null)),
  );
  const defaultBranchByRoot = new Map(uniqueRepoRoots.map((root, i) => [root, defaultBranches[i]]));

  const decorated = sessions
    .map((session) => {
      const gitDirs = session.workingDirectory ? gitDirsByDir.get(session.workingDirectory) : null;
      const isWorktree = gitDirs ? gitDirs.gitDir !== gitDirs.commonGitDir : false;
      // The repo root's name, so worktree sessions group with their main checkout (also for a
      // worktree whose directory is gone, via missingWorktreeRepoRoot).
      const project = gitDirs
        ? path.basename(path.dirname(gitDirs.commonGitDir))
        : session.missingWorktreeRepoRoot
          ? path.basename(session.missingWorktreeRepoRoot)
          : session.project;
      // The transcript's branch only counts while the directory is still a git repo.
      const gitBranch = gitDirs ? session.gitBranch : null;
      const repoRoot = gitDirs ? path.dirname(gitDirs.commonGitDir) : null;
      const saved = store.sessions[session.id];
      const branchEntry = repoRoot && gitBranch ? store.repoBranches[repoRoot]?.[gitBranch] : null;
      const nickname = saved?.nickname ?? null;
      // A session's own key is from older versions: moved onto its branch (best-effort) and
      // still honored until then, e.g. for a session outside any git repo.
      if (saved?.taskKey && repoRoot && gitBranch) {
        void moveSessionTaskKeyToBranch(session.id, repoRoot, gitBranch).catch(() => undefined);
      }
      // Recorded beats inferred from the task branch. A test session has no task here (the task
      // is someone else's): its status is its own.
      const testKey = saved?.test?.key ?? null;
      const recordedTaskKey = testKey ? null : (saved?.taskKey ?? branchEntry?.taskKey ?? null);
      const inferredTaskKey =
        recordedTaskKey === null && !testKey ? inferTaskKey(saved?.destination ?? gitBranch) : null;
      return {
        ...session,
        project,
        gitBranch,
        nickname,
        isActive: activeIds.has(session.id),
        isWorktree,
        baseBranch: branchEntry?.baseBranch ?? null,
        isAppRepo: repoRoot === appRepoRoot,
        savedOriginBranch: saved?.origin ?? null,
        savedDestinationBranch: saved?.destination ?? null,
        defaultBranch: repoRoot ? (defaultBranchByRoot.get(repoRoot) ?? null) : null,
        repoRoot,
        taskKey: recordedTaskKey ?? inferredTaskKey,
        taskKeyInferred: inferredTaskKey !== null,
        testKey,
        status:
          store.tasks[recordedTaskKey ?? inferredTaskKey ?? ""]?.status ?? saved?.status ?? null,
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  // Second pass: a task's repos depend on every session carrying its key.
  const reposByTask = collectTaskRepos(store, decorated);
  // Recorded repos with no session in this listing still need their default branch.
  const missingRoots = [
    ...new Set(
      [...reposByTask.values()]
        .flat()
        .map((repo) => repo.repoRoot)
        .filter((root) => !defaultBranchByRoot.has(root)),
    ),
  ];
  const missingDefaults = await Promise.all(
    missingRoots.map((root) => getDefaultBaseBranch(root).catch(() => null)),
  );
  missingRoots.forEach((root, i) => defaultBranchByRoot.set(root, missingDefaults[i]));
  for (const repo of [...reposByTask.values()].flat()) {
    repo.defaultBranch = defaultBranchByRoot.get(repo.repoRoot) ?? null;
  }
  const [history, servers] = await Promise.all([readHistory(), listPreviewServers()]);
  return decorated.map((session) => {
    const withRepos = session.taskKey
      ? { ...session, taskRepos: reposByTask.get(session.taskKey) ?? [] }
      : session;
    const target = historyTargetOf(withRepos);
    return {
      ...withRepos,
      hasHistory: history.some((event) => belongsTo(event, target)),
      previews: sessionPreviews(withRepos, servers),
    };
  });
}

/** Previews serving the session's folder, plus its task's other worktrees (a multi-repo task's
 *  cart preview shows on its card too). */
function sessionPreviews(session: Session, servers: PreviewServer[]): SessionPreview[] {
  if (servers.length === 0 || session.directoryMissing) return [];
  const folders = new Set<string>();
  if (session.workingDirectory) folders.add(session.workingDirectory);
  for (const repo of session.taskRepos ?? []) if (repo.worktreePath) folders.add(repo.worktreePath);
  const found = new Map<string, SessionPreview>();
  for (const folder of folders) {
    for (const server of previewsFor(servers, folder)) {
      found.set(server.id, {
        kind: server.kind,
        id: server.id,
        name: server.name,
        port: server.port,
        url: server.url,
        inWorktree: folder.includes(`${path.sep}.claude${path.sep}worktrees${path.sep}`),
        running: server.running,
      });
    }
  }
  return [...found.values()].sort((a, b) => a.port - b.port);
}

function historyTargetOf(session: Session): HistoryTarget {
  return {
    sessionId: session.id,
    taskKey: session.taskKey ?? null,
    worktreePath: session.isWorktree ? session.workingDirectory : null,
  };
}

/** The card's "info": this session's (and its task's) history events and their summary. */
export async function getSessionHistory(
  id: string,
): Promise<{ events: HistoryEvent[]; summary: HistorySummary }> {
  if (!isSafeSessionId(id)) throw invalidSessionIdError(id);
  const [sessions, history] = await Promise.all([listSessions(), readHistory()]);
  const session = sessions.find((s) => s.id === id);
  if (!session) throw new SessionNotFoundError(id);
  const target = historyTargetOf(session);
  const events = history.filter((event) => belongsTo(event, target));
  return { events, summary: summarize(events, history) };
}

/** Session ids are UUID-shaped; reject anything that looks like a path segment. */
export function isSafeSessionId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

export async function findSessionFilePath(id: string): Promise<string | null> {
  if (!isSafeSessionId(id)) return null;
  const files = await findJsonlFiles(getClaudeProjectsDir());
  const match = files.find((file) => path.basename(file, ".jsonl") === id);
  return match ?? null;
}

/** The CLI ties a session to the exact directory it started in, so `claude --resume` must run
 *  from that same `cwd` or it reports the session as not found. */
async function findSessionCwd(id: string): Promise<string | null> {
  const filePath = await findSessionFilePath(id);
  if (!filePath) return null;
  const head = await readSessionHead(filePath);
  return head.cwd;
}

export class SessionNotFoundError extends NotFoundError {
  constructor(id: string) {
    super("SESSION_NOT_FOUND", `Session "${id}" not found`);
    this.name = "SessionNotFoundError";
  }
}

export class SessionActiveError extends ConflictError {
  constructor(message: string) {
    super("SESSION_ACTIVE", message);
    this.name = "SessionActiveError";
  }
}

export function invalidSessionIdError(id: string): AppError {
  return new BadRequestError("INVALID_SESSION_ID", `Invalid session id "${id}"`);
}

function sessionDirectoryMissingError(cwd: string): AppError {
  return new AppError(
    "SESSION_DIRECTORY_MISSING",
    `This session's original directory no longer exists ("${cwd}").`,
  );
}

function notAWorktreeSessionError(): AppError {
  return new AppError("NOT_A_WORKTREE_SESSION", "This session isn't running in a git worktree.");
}

function branchNameRequiredError(): AppError {
  return new BadRequestError("TASK_BRANCH_NAME_REQUIRED", "A branch name is required.");
}

/** Never deletable through "delete branch" (also hidden client-side in SessionsPage.tsx). */
const PROTECTED_BRANCHES = new Set(["main", "master"]);

function protectedBranchDeleteError(branch: string): AppError {
  return new AppError(
    "PROTECTED_BRANCH_DELETE_FORBIDDEN",
    `Refusing to delete "${branch}" — it looks like the repo's primary branch.`,
  );
}

/** Untruncated prompts of one session (`Session.prompts` is truncated). */
export async function getSessionPrompts(id: string): Promise<string[]> {
  const filePath = await findSessionFilePath(id);
  if (!filePath) throw new SessionNotFoundError(id);
  return readFullSessionPrompts(filePath);
}

/**
 * New-PR URL for a session's branch, opened in the user's browser (no API token). Null when there's
 * no known cwd or no github.com/bitbucket.org `origin`. Without `explicitBase` the host compares
 * against the repo's default branch.
 */
export async function getSessionPrUrl(
  id: string,
  branch: string,
  explicitBase?: string,
): Promise<string | null> {
  const trimmedBranch = branch.trim();
  if (!trimmedBranch) return null;
  const trimmedBase = explicitBase?.trim() ?? "";

  const filePath = await findSessionFilePath(id);
  if (!filePath) throw new SessionNotFoundError(id);
  const head = await readSessionHead(filePath);
  if (!head.cwd) return null;
  return buildPrUrl(head.cwd, trimmedBranch, trimmedBase);
}

/** The new-PR page for `branch` in the repo at `cwd` (github.com/bitbucket.org `origin` only);
 *  `base` "" = the host's own default. Also used for a task's repos that have no session. */
export async function buildPrUrl(
  cwd: string,
  trimmedBranch: string,
  trimmedBase: string,
): Promise<string | null> {
  const hostInfo = await getGitHostInfo(cwd);
  if (!hostInfo) return null;

  const encodedBranch = encodeURIComponent(trimmedBranch);
  if (hostInfo.host === "github") {
    const compareRef = trimmedBase
      ? `${encodeURIComponent(trimmedBase)}...${trimmedBranch}`
      : trimmedBranch;
    return `https://github.com/${hostInfo.slug}/compare/${compareRef}?expand=1`;
  }

  const destParam = trimmedBase ? `&dest=${encodeURIComponent(trimmedBase)}` : "";
  return `https://bitbucket.org/${hostInfo.slug}/pull-requests/new?source=${encodedBranch}${destParam}&t=1`;
}

/** Refuses while the session is active: the running CLI is still writing its `.jsonl`. */
export async function deleteSession(id: string): Promise<void> {
  const activeIds = await getActiveResumeSessionIds();
  if (activeIds.has(id)) {
    throw new SessionActiveError(
      `Session "${id}" is currently active in a terminal — close it before deleting.`,
    );
  }

  const filePath = await findSessionFilePath(id);
  if (!filePath) throw new SessionNotFoundError(id);
  await unlink(filePath);
  forgetCachedSession(filePath);
  // A test session's disposable worktrees go with it, done or not (its entry is what lists them).
  const testWorktrees = (await getTaskStore()).sessions[id]?.test?.worktrees ?? [];
  if (testWorktrees.length > 0) {
    await stopPreviewsIn(testWorktrees, "removed").catch(() => undefined);
    for (const worktree of testWorktrees) {
      await forceRemoveWorktree(worktree).catch(() => undefined);
    }
  }
  // Best-effort: the transcript is already gone, a leftover entry is just clutter.
  await forgetSession(id).catch(() => undefined);
}

/** Deletes a local branch in a (non-worktree) session's directory. */
export async function deleteSessionBranch(id: string, branch: string): Promise<void> {
  const trimmedBranch = branch.trim();
  if (!trimmedBranch) {
    throw branchNameRequiredError();
  }
  if (PROTECTED_BRANCHES.has(trimmedBranch)) {
    throw protectedBranchDeleteError(trimmedBranch);
  }

  const cwd = await findSessionCwd(id);
  if (!cwd) throw new SessionNotFoundError(id);
  if (!(await directoryExists(cwd))) {
    throw sessionDirectoryMissingError(cwd);
  }

  await deleteLocalBranch(cwd, trimmedBranch);
  // Best-effort; for a non-worktree session `cwd` is the repo root.
  await forgetRepoBranch(cwd, trimmedBranch).catch(() => undefined);
}

/** Local only (`tasks.json`), never touches the `.jsonl`, so no active-session gate. */
export async function setSessionNickname(id: string, nickname: string): Promise<void> {
  await setNickname(id, nickname);
}

/** For a session with no task — a task's status is set on the task (`PUT /tasks/by-key/:key/status`).
 *  A test session only goes in progress or done; done + closed removes its worktrees
 *  (`cleanupFinishedTests`). */
export async function setSessionWorkStatus(id: string, status: WorkStatus | null): Promise<void> {
  if (!isSafeSessionId(id)) throw invalidSessionIdError(id);
  const isTest = Boolean((await getTaskStore()).sessions[id]?.test);
  if (isTest && status !== "in_progress" && status !== "done") {
    throw new BadRequestError(
      "TEST_STATUS_INVALID",
      'A test session is either "in_progress" or "done".',
    );
  }
  await setSessionStatus(id, status);
  if (status === "done") {
    // Done: its worktree's preview servers only hold memory now (background, best-effort).
    const cwd = await findSessionCwd(id);
    if (cwd) void stopPreviewsIn([cwd], "done").catch(() => undefined);
  }
}

/** Local only (`tasks.json`), so no active-session gate. */
export async function setSessionBranches(
  id: string,
  origin: string,
  destination: string,
): Promise<void> {
  await setSessionBranchOverride(id, origin, destination);
}

/** Time to wait for an immediate spawn failure (e.g. binary missing) before assuming success. */
const SPAWN_ERROR_GRACE_PERIOD_MS = 300;

/**
 * Terminal emulators, tried in order. Argv-style (`bash -c <cmd>`): most exec their payload
 * without a shell. Duplicated in `open-terminal.sh` (must work without Node); keep both in sync
 * (`scripts/check-terminal-launchers-sync.mjs` checks it).
 */
const TERMINAL_LAUNCHERS: { bin: string; buildArgs: (shellCmd: string) => string[] }[] = [
  { bin: "x-terminal-emulator", buildArgs: (c) => ["-e", "bash", "-c", c] },
  { bin: "gnome-terminal", buildArgs: (c) => ["--", "bash", "-c", c] },
  { bin: "konsole", buildArgs: (c) => ["-e", "bash", "-c", c] },
  { bin: "xfce4-terminal", buildArgs: (c) => ["-x", "bash", "-c", c] },
  { bin: "xterm", buildArgs: (c) => ["-e", "bash", "-c", c] },
];

function trySpawnDetached(bin: string, args: string[], cwd?: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(bin, args, {
      detached: true,
      stdio: "ignore",
      cwd,
      env: sanitizedSpawnEnv(),
    });

    const timer = setTimeout(() => {
      child.removeListener("error", onError);
      child.unref();
      resolve(true);
    }, SPAWN_ERROR_GRACE_PERIOD_MS);

    function onError() {
      clearTimeout(timer);
      resolve(false);
    }

    child.once("error", onError);
  });
}

export async function directoryExists(dir: string): Promise<boolean> {
  try {
    return (await stat(dir)).isDirectory();
  } catch {
    return false;
  }
}

/** True when `bin` is an executable in some `PATH` entry (like `which`, without spawning). */
function commandExists(bin: string): boolean {
  const dirs = (process.env.PATH ?? "").split(path.delimiter);

  for (const dir of dirs) {
    try {
      accessSync(path.join(dir, bin), constants.X_OK);
      return true;
    } catch {
      // Not in this PATH entry — keep looking.
    }
  }
  return false;
}

/** Warp's Linux XDG tab-config dir; `WARP_DATA_DIR` overrides it. */
function getWarpTabConfigsDir(): string {
  if (process.env.WARP_DATA_DIR) {
    return path.join(process.env.WARP_DATA_DIR, "tab_configs");
  }
  const dataHome = process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local", "share");
  return path.join(dataHome, "warp-terminal", "tab_configs");
}

const WARP_TAB_CONFIG_PREFIX = "claude-session-manager-";
/** Long enough that a slow cold-start Warp has certainly read the file. */
const WARP_TAB_CONFIG_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * Deletes this app's tab configs older than `WARP_TAB_CONFIG_MAX_AGE_MS` (they'd pile up in Warp's
 * list). A just-opened one can't be deleted right away: `xdg-open` returning doesn't mean Warp has
 * read it yet. Only touches files with our own prefix.
 */
async function pruneStaleWarpTabConfigs(dir: string): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }

  const now = Date.now();
  await Promise.all(
    entries
      .filter((name) => name.startsWith(WARP_TAB_CONFIG_PREFIX) && name.endsWith(".toml"))
      .map(async (name) => {
        const filePath = path.join(dir, name);
        try {
          const fileStat = await stat(filePath);
          if (now - fileStat.mtimeMs > WARP_TAB_CONFIG_MAX_AGE_MS) {
            await unlink(filePath);
          }
        } catch {
          // Best-effort cleanup — ignore races with a concurrent delete, permission errors, etc.
        }
      }),
  );
}

/**
 * Escapes `value` for a TOML basic (double-quoted) string. Backslash goes first, since the other
 * replacements add backslashes. A basic string can't hold a raw newline, so `\n`/`\r` must be
 * escaped or Warp rejects the whole tab config.
 */
function toTomlBasicString(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

/** Warp has no flag to run a command on launch: writes a Tab Config TOML and opens it via
 *  `warp://tab_config/<name>`. False when Warp isn't installed. */
async function launchWarp(command: string, cwd?: string): Promise<boolean> {
  if (!commandExists("warp-terminal")) return false;

  const name = `${WARP_TAB_CONFIG_PREFIX}${Date.now()}`;
  const toml =
    `name = "${name}"\n\n[[panes]]\nid = "main"\ntype = "terminal"\n` +
    (cwd ? `directory = "${toTomlBasicString(cwd)}"\n` : "") +
    `commands = ["${toTomlBasicString(command)}"]\n`;

  const dir = getWarpTabConfigsDir();
  await mkdir(dir, { recursive: true });
  await pruneStaleWarpTabConfigs(dir);
  await writeFile(path.join(dir, `${name}.toml`), toml, "utf8");

  // No `?new_window=true`: on a cold start it opens a second window besides Warp's own.
  return trySpawnDetached("xdg-open", [`warp://tab_config/${encodeURIComponent(name)}`]);
}

/** Wraps `value` in single quotes for a POSIX shell, escaping any embedded ones. */
export function posixShellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Opens `dir` in a new VS Code window (`--new-window`, so an open window isn't swapped out). */
async function openDirInVSCode(dir: string): Promise<void> {
  if (!(await directoryExists(dir))) {
    throw new AppError("DIRECTORY_MISSING", `This directory no longer exists ("${dir}").`);
  }

  if (!(await trySpawnDetached("code", ["--new-window", dir]))) {
    throw new AppError(
      "VSCODE_COMMAND_NOT_FOUND",
      `Could not open VS Code — the "code" command wasn't found on PATH. In VS Code, run ` +
        `"Shell Command: Install 'code' command in PATH" from the Command Palette.`,
    );
  }
}

/** Opens a single file in VS Code (not a folder window). */
export async function openFileInVSCode(filePath: string): Promise<void> {
  if (!(await trySpawnDetached("code", [filePath]))) {
    throw new AppError(
      "VSCODE_COMMAND_NOT_FOUND",
      `Could not open VS Code — the "code" command wasn't found on PATH. In VS Code, run ` +
        `"Shell Command: Install 'code' command in PATH" from the Command Palette.`,
    );
  }
}

export async function openInVSCode(id: string): Promise<void> {
  const cwd = await findSessionCwd(id);
  if (!cwd) {
    throw new AppError(
      "SESSION_NO_WORKING_DIRECTORY",
      "This session has no known working directory to open.",
    );
  }
  try {
    await openDirInVSCode(cwd);
  } catch {
    throw new AppError(
      "SESSION_DIRECTORY_MISSING",
      `This session's original directory no longer exists ("${cwd}"). Recreate the folder ` +
        `(or a symlink) at the old path before opening it in VS Code.`,
    );
  }
}

/** Opens `dir` in a new Cursor window. `--classic`: otherwise Cursor opens the Agents panel
 *  instead of the editor view. */
async function openDirInCursor(dir: string): Promise<void> {
  if (!(await directoryExists(dir))) {
    throw new AppError("DIRECTORY_MISSING", `This directory no longer exists ("${dir}").`);
  }

  if (!(await trySpawnDetached("cursor", ["--new-window", "--classic", dir]))) {
    throw new AppError(
      "CURSOR_COMMAND_NOT_FOUND",
      `Could not open Cursor — the "cursor" command wasn't found on PATH. In Cursor, run ` +
        `"Shell Command: Install 'cursor' command in PATH" from the Command Palette.`,
    );
  }
}

/** Opens a session's working directory in Cursor (no git involved). */
export async function openInCursor(id: string): Promise<void> {
  const cwd = await findSessionCwd(id);
  if (!cwd) {
    throw new AppError(
      "SESSION_NO_WORKING_DIRECTORY",
      "This session has no known working directory to open.",
    );
  }
  try {
    await openDirInCursor(cwd);
  } catch {
    throw new AppError(
      "SESSION_DIRECTORY_MISSING",
      `This session's original directory no longer exists ("${cwd}"). Recreate the folder ` +
        `(or a symlink) at the old path before opening it in Cursor.`,
    );
  }
}

/** Opens a worktree session's repo root (not the worktree) in VS Code. */
export async function openWorktreeRootInVSCode(id: string): Promise<void> {
  const { repoRoot } = await resolveWorktreeAndRepoRoot(id);
  await openDirInVSCode(repoRoot);
}

/** Repo root of an orphaned worktree session, derived from its recorded `cwd` (the worktree is
 *  gone, so git can't tell); must still exist. */
async function resolveMissingWorktreeRepoRoot(
  id: string,
): Promise<{ head: SessionHead; filePath: string; repoRoot: string }> {
  const filePath = await findSessionFilePath(id);
  if (!filePath) throw new SessionNotFoundError(id);

  const head = await readSessionHead(filePath);
  if (!head.cwd) {
    throw new AppError(
      "SESSION_NO_WORKING_DIRECTORY",
      "This session has no known working directory.",
    );
  }
  const repoRoot = repoRootFromMissingWorktreePath(head.cwd);
  if (!repoRoot) {
    throw new AppError(
      "NOT_APP_WORKTREE",
      "This session's directory doesn't look like one of this app's own worktrees.",
    );
  }
  if (!(await directoryExists(repoRoot))) {
    throw new AppError(
      "PROJECT_ROOT_MISSING",
      `The project's root folder no longer exists either ("${repoRoot}").`,
    );
  }
  return { head, filePath, repoRoot };
}

/** Opens an orphaned worktree session's repo root in VS Code. */
export async function openMissingWorktreeRootInVSCode(id: string): Promise<void> {
  const { repoRoot } = await resolveMissingWorktreeRepoRoot(id);
  await openDirInVSCode(repoRoot);
}

/**
 * Starts a new `claude` conversation in an orphaned worktree session's repo root (it can't be
 * resumed: its directory is gone), seeded with the old session's recap or title.
 */
export async function startFreshSessionAtMissingWorktreeRoot(
  id: string,
  layout?: TerminalLayout,
): Promise<void> {
  const { head, filePath, repoRoot } = await resolveMissingWorktreeRepoRoot(id);

  const sessions = await listSessions();
  if (sessions.some((s) => s.workingDirectory === repoRoot && s.isActive)) {
    throw new SessionActiveError(
      "A session is already active in the root project directory — resume that one instead.",
    );
  }

  const recap = await readSessionRecap(filePath);
  const seed = recap ?? head.summaryTitle ?? head.aiTitle ?? head.firstUserText;
  const prompt = seed
    ? `Continuing a previous session that ran in a git worktree now merged into this folder. ` +
      `Here's a recap of that session:\n\n${seed}\n\nPlease continue from here.`
    : "Continuing a previous session that ran in a git worktree now merged into this folder. " +
      "(No recap of that session was recorded — take a look around before continuing.)";

  await launchInTerminal(`claude ${posixShellQuote(prompt)}`, repoRoot, null, layout);
}

/**
 * Runs a Claude session's `command` where `layout` (default: the `terminalLayout` preference)
 * says: a pane of the Limux grid (`limuxGridService`), or a terminal of its own. Without Limux the
 * grid falls back to a terminal.
 */
export async function launchInTerminal(
  command: string,
  cwd?: string,
  taskKey: string | null = null,
  layout?: TerminalLayout,
): Promise<void> {
  const terminalLayout = layout ?? (await getUserPreferences()).terminalLayout;
  if (terminalLayout === "limux-grid") {
    if (await isLimuxAvailable()) {
      await launchInLimuxGrid(command, cwd, taskKey);
      return;
    }
    console.warn(
      "[terminal] terminalLayout is limux-grid but limux isn't installed — using a tab.",
    );
  }
  await openTerminalWindow(command, cwd);
}

/** Runs `command` in a new terminal: Warp when installed, else the first `TERMINAL_LAUNCHERS`
 *  entry that starts. */
export async function openTerminalWindow(command: string, cwd?: string): Promise<void> {
  if (await launchWarp(command, cwd)) {
    return;
  }

  // These emulators close the window as soon as `bash -c` exits (Warp tabs stay open).
  const shellCmd = `${command}; echo; read -p "Press Enter to close..." _`;

  for (const launcher of TERMINAL_LAUNCHERS) {
    const started = await trySpawnDetached(launcher.bin, launcher.buildArgs(shellCmd), cwd);
    if (started) return;
  }

  throw new AppError(
    "TERMINAL_LAUNCH_FAILED",
    `No terminal emulator found (tried: ${TERMINAL_LAUNCHERS.map((l) => l.bin).join(", ")}).`,
  );
}

/** "Resume" on a session already running in the Limux grid: shows its pane instead of a second
 *  terminal. False when the grid isn't the layout or no pane runs it (the caller handles the
 *  active-session conflict as usual). */
export async function focusSessionInGrid(id: string): Promise<boolean> {
  if (!isSafeSessionId(id)) throw invalidSessionIdError(id);
  const { terminalLayout } = await getUserPreferences();
  if (terminalLayout !== "limux-grid" || !(await isLimuxAvailable())) return false;
  return focusLimuxSession(id);
}

/** Refuses an active session: a second `claude --resume` would race the first one's writes. */
/** `taskKey` (when the caller knows it) lets the grid reuse a Limux tab named after the task;
 *  `layout` overrides the `terminalLayout` preference for this resume. */
export async function continueSession(
  id: string,
  taskKey: string | null = null,
  layout?: TerminalLayout,
): Promise<void> {
  const activeIds = await getActiveResumeSessionIds();
  if (activeIds.has(id)) {
    throw new SessionActiveError(`Session "${id}" is already open in a terminal.`);
  }

  const cwd = await findSessionCwd(id);
  if (cwd && !(await directoryExists(cwd))) {
    throw new AppError(
      "SESSION_DIRECTORY_MISSING",
      `This session's original directory no longer exists ("${cwd}"). Since the Claude CLI ` +
        `resolves sessions by working directory, it can't be resumed from here — recreate the ` +
        `folder (or a symlink) at the old path pointing to the project's current location.`,
    );
  }

  // `id` is validated above, so it's safe to interpolate.
  await launchInTerminal(`claude --resume ${id}`, cwd ?? undefined, taskKey, layout);
  recordEvent("session.resumed", { sessionId: id, cwd });
}

/**
 * Starts a new `claude --worktree <name>` conversation in `id`'s project (a past transcript can't
 * be resumed from another directory). The CLI creates and locks `<repo>/.claude/worktrees/<name>`
 * on a new `worktree-<name>` branch.
 */
export async function createSessionWorktree(
  id: string,
  requestedName: string,
  layout?: TerminalLayout,
): Promise<void> {
  const name = requestedName.trim();
  if (!name) {
    throw new BadRequestError("WORKTREE_NAME_REQUIRED", "A worktree name is required.");
  }

  const cwd = await findSessionCwd(id);
  if (!cwd) throw new SessionNotFoundError(id);
  if (!(await directoryExists(cwd))) {
    throw sessionDirectoryMissingError(cwd);
  }

  // Pre-trusts the path the CLI will create (`<repoRoot>/.claude/worktrees/<name>`), so later
  // `claude` launches there don't stop at the trust dialog. A wrong guess has no effect.
  const repoRoot = await getRepoRoot(cwd);
  if (repoRoot) {
    const worktreeDirName = sanitizeWorktreeDirName(name);
    await markWorktreeTrustAccepted(path.join(repoRoot, ".claude", "worktrees", worktreeDirName));
  }

  await launchInTerminal(`claude --worktree ${posixShellQuote(name)}`, cwd, null, layout);
}

/** Removes the worktree `id` runs in and its branch; refused while any session is active in it. */
export async function deleteSessionWorktree(id: string): Promise<void> {
  const cwd = await findSessionCwd(id);
  if (!cwd) throw new SessionNotFoundError(id);
  if (!(await directoryExists(cwd))) {
    throw sessionDirectoryMissingError(cwd);
  }
  if (!(await isLinkedWorktree(cwd))) {
    throw notAWorktreeSessionError();
  }

  const sessions = await listSessions();
  const stillActive = sessions.some((s) => s.workingDirectory === cwd && s.isActive);
  if (stillActive) {
    throw new SessionActiveError(
      "A session is still active in this worktree — close its terminal before deleting it.",
    );
  }

  // Captured before removal, while git can still be asked about the worktree.
  const repoRootForCleanup = await getRepoRoot(cwd);
  const branchForCleanup = sessions.find((s) => s.workingDirectory === cwd)?.gitBranch ?? null;

  await removeWorktreeAndBranch(cwd);
  // Best-effort: a failure only leaves an orphaned `tasks.json` entry.
  if (repoRootForCleanup && branchForCleanup) {
    await forgetRepoBranch(repoRootForCleanup, branchForCleanup).catch(() => undefined);
  }
}

/** Resolves a worktree session's cwd and repo root, or throws. */
async function resolveWorktreeAndRepoRoot(id: string): Promise<{ cwd: string; repoRoot: string }> {
  const cwd = await findSessionCwd(id);
  if (!cwd) throw new SessionNotFoundError(id);
  if (!(await directoryExists(cwd))) {
    throw sessionDirectoryMissingError(cwd);
  }
  if (!(await isLinkedWorktree(cwd))) {
    throw notAWorktreeSessionError();
  }

  const repoRoot = await getRepoRoot(cwd);
  if (!repoRoot) {
    throw new AppError("REPO_ROOT_UNRESOLVED", `Could not resolve the repo root for "${cwd}".`);
  }

  return { cwd, repoRoot };
}

/** Read-only preview for the "worktree → root" modal. The mutating steps re-check everything
 *  themselves rather than trusting it. */
export async function getWorktreeToRootPreview(id: string): Promise<WorktreeToRootPreview> {
  const { cwd, repoRoot } = await resolveWorktreeAndRepoRoot(id);

  const entries = await listWorktrees(repoRoot);
  const excludePaths = nestedWorktreeRelativePaths(repoRoot, entries);
  const [rootDirtyFiles, fileDiff, sessions, rootLock] = await Promise.all([
    getStatusFiles(repoRoot, excludePaths),
    computeFileDiff(cwd, repoRoot),
    listSessions(),
    getRootLock(repoRoot),
  ]);

  const resolvedRepoRoot = path.resolve(repoRoot);
  const resolvedCwd = path.resolve(cwd);
  const rootBranch = entries.find((e) => path.resolve(e.path) === resolvedRepoRoot)?.branch ?? null;
  const worktreeBranch = entries.find((e) => path.resolve(e.path) === resolvedCwd)?.branch ?? null;

  return {
    repoRoot,
    rootBranch,
    worktreeBranch,
    rootDirtyFiles,
    fileDiff,
    rootHasActiveSession: sessions.some((s) => s.workingDirectory === repoRoot && s.isActive),
    worktreeHasActiveSession: sessions.some((s) => s.workingDirectory === cwd && s.isActive),
    // Another task holding the root; this worktree's own copy doesn't count.
    rootLock:
      rootLock && !(rootLock.mode === "copy" && rootLock.worktreePath === cwd) ? rootLock : null,
  };
}

/** Root's branch, dirty files and this app's stashes, without the preview's file diff. */
export async function getRootStatus(id: string): Promise<RootStatus> {
  const { repoRoot } = await resolveWorktreeAndRepoRoot(id);
  const entries = await listWorktrees(repoRoot);
  const excludePaths = nestedWorktreeRelativePaths(repoRoot, entries);
  const [rootDirtyFiles, appStashes] = await Promise.all([
    getStatusFiles(repoRoot, excludePaths),
    listAppStashes(repoRoot),
  ]);
  const resolvedRepoRoot = path.resolve(repoRoot);
  const rootBranch = entries.find((e) => path.resolve(e.path) === resolvedRepoRoot)?.branch ?? null;

  return { repoRoot, rootBranch, rootDirtyFiles, appStashes };
}

/**
 * Stashes every uncommitted change in the main checkout (nested worktrees excluded), refused while
 * a session is active there. Returns the stash SHA, or null when root was clean.
 *
 * As the first step of "worktree → root" it's also refused while another task holds the root
 * (`rootLockService`), so it can't stash that task's copy away; `force` (the standalone "Reset
 * root") is the user deliberately freeing it.
 */
export async function resetRootWorkingTree(id: string, force = false): Promise<string | null> {
  const { cwd, repoRoot } = await resolveWorktreeAndRepoRoot(id);
  if (!force) await assertRootFreeFor(repoRoot, cwd);

  const sessions = await listSessions();
  if (sessions.some((s) => s.workingDirectory === repoRoot && s.isActive)) {
    throw new SessionActiveError(
      "A session is active in the root project directory — close its terminal before continuing.",
    );
  }

  const entries = await listWorktrees(repoRoot);
  const excludePaths = nestedWorktreeRelativePaths(repoRoot, entries);
  const stashRef = await discardWorkingTreeChanges(repoRoot, excludePaths);
  // A copy lock goes with the files; a moved branch keeps it until root leaves that branch.
  await getRootLock(repoRoot);
  return stashRef;
}

/** Copies the worktree's files onto root, recomputing the diff fresh (never the client's copy).
 *  The worktree itself is left untouched. */
export async function applyWorktreeCopyToRoot(id: string): Promise<void> {
  const { cwd, repoRoot } = await resolveWorktreeAndRepoRoot(id);

  const sessions = await listSessions();
  if (sessions.some((s) => s.workingDirectory === repoRoot && s.isActive)) {
    throw new SessionActiveError(
      "A session is active in the root project directory — close its terminal before continuing.",
    );
  }

  await assertRootFreeFor(repoRoot, cwd);
  const diff = await computeFileDiff(cwd, repoRoot);
  await applyFileDiff(cwd, repoRoot, diff);
  const branch = await getWorktreeBranch(cwd, repoRoot);
  if (branch) await lockRootForCopy(repoRoot, cwd, branch);
}

/**
 * Removes the worktree (keeping its branch) and checks that branch out in root, as one server-side
 * operation so a dropped request can't leave the worktree gone with root on its old branch.
 * Returns root's previous branch (null for a detached HEAD) and the new one.
 */
export async function removeWorktreeAndCheckoutRoot(
  id: string,
): Promise<{ previousRootBranch: string | null; newBranch: string }> {
  const { cwd, repoRoot } = await resolveWorktreeAndRepoRoot(id);

  const sessions = await listSessions();
  if (sessions.some((s) => s.workingDirectory === cwd && s.isActive)) {
    throw new SessionActiveError(
      "A session is still active in this worktree — close its terminal before removing it.",
    );
  }
  if (sessions.some((s) => s.workingDirectory === repoRoot && s.isActive)) {
    throw new SessionActiveError(
      "A session is active in the root project directory — close its terminal before checking " +
        "out a branch there.",
    );
  }

  await assertRootFreeFor(repoRoot, cwd);
  const resolvedRepoRoot = path.resolve(repoRoot);
  const entriesBefore = await listWorktrees(repoRoot);
  const previousRootBranch =
    entriesBefore.find((e) => path.resolve(e.path) === resolvedRepoRoot)?.branch ?? null;
  const worktreeBranch = await getWorktreeBranch(cwd, repoRoot);
  // Read before the worktree goes: removing it forgets the branch's task link.
  const taskKey = worktreeBranch ? await taskKeyForBranch(repoRoot, worktreeBranch) : null;

  const branch = await removeWorktreeKeepBranch(cwd);
  if (!branch) {
    throw new AppError(
      "WORKTREE_BRANCH_UNKNOWN",
      "Could not determine the worktree's branch before removing it.",
    );
  }
  // Best-effort, whether or not the checkout below succeeds.
  await forgetRepoBranch(repoRoot, branch).catch(() => undefined);

  try {
    await checkoutExistingBranch(repoRoot, branch);
  } catch (err) {
    const message = errorMessage(err);
    throw new AppError(
      "WORKTREE_TO_ROOT_CHECKOUT_FAILED",
      `The worktree was removed, but "git checkout ${branch}" failed in ${repoRoot}: ${message} ` +
        `The branch's commits are safe — finish the checkout by hand from a terminal in ${repoRoot}.`,
      { cause: err },
    );
  }

  await lockRootForCheckout(repoRoot, branch, taskKey);
  return { previousRootBranch, newBranch: branch };
}

/** Statuses "Resume open tasks" brings back: work left mid-way (not "to do": never started). */
const RESUMABLE_STATUSES = new Set(["in_progress", "waiting_user"]);

export type ResumeOpenResult = {
  resumed: { id: string; taskKey: string | null }[];
  /** Left out because the session limit (`orchestrator.maxSessions`) was reached. */
  skippedForLimit: number;
  failed: { id: string; message: string }[];
};

/**
 * "Resume open tasks": for each task (or task-less session) in progress or waiting on the user
 * with nothing of it running, resumes its most recently updated session — in the grid when that's
 * the terminal layout — up to the session limit, so a day's work comes back in one click.
 */
export async function resumeOpenTasks(): Promise<ResumeOpenResult> {
  const [sessions, prefs] = await Promise.all([listSessions(), getUserPreferences()]);
  const groupOf = (s: Session) => s.taskKey ?? `session:${s.id}`;
  const activeGroups = new Set(sessions.filter((s) => s.isActive).map(groupOf));

  const seen = new Set<string>();
  const candidates: Session[] = [];
  // Newest first, so the first one per group is its latest session.
  for (const session of sessions) {
    const group = groupOf(session);
    if (seen.has(group)) continue;
    seen.add(group);
    if (activeGroups.has(group) || session.directoryMissing) continue;
    if (session.status && RESUMABLE_STATUSES.has(session.status)) candidates.push(session);
  }

  const room = Math.max(
    0,
    prefs.orchestrator.maxSessions - (await getActiveResumeSessionIds()).size,
  );
  const result: ResumeOpenResult = {
    resumed: [],
    skippedForLimit: Math.max(0, candidates.length - room),
    failed: [],
  };
  for (const session of candidates.slice(0, room)) {
    try {
      await continueSession(session.id, session.taskKey ?? null);
      result.resumed.push({ id: session.id, taskKey: session.taskKey ?? null });
    } catch (err) {
      result.failed.push({ id: session.id, message: errorMessage(err) });
    }
  }
  recordEvent("sessions.resumeOpen", {
    resumed: result.resumed,
    skippedForLimit: result.skippedForLimit,
    failed: result.failed,
  });
  return result;
}

/**
 * Stops `siblingSessionId`'s process (SIGTERM, then SIGKILL after a timeout), checks out `branch`
 * in the shared directory and resumes `id` there, as one call so a partial failure is one error.
 * Can discard the other terminal's unsaved work.
 */
export async function stopSiblingAndResume(
  id: string,
  siblingSessionId: string,
  requestedBranch: string,
  layout?: TerminalLayout,
): Promise<void> {
  if (!isSafeSessionId(siblingSessionId)) throw invalidSessionIdError(siblingSessionId);
  const branch = requestedBranch.trim();
  if (!branch) {
    throw branchNameRequiredError();
  }

  const cwd = await findSessionCwd(id);
  if (!cwd) throw new SessionNotFoundError(id);
  if (!(await directoryExists(cwd))) {
    throw sessionDirectoryMissingError(cwd);
  }

  const pid = await findActiveSessionPid(siblingSessionId);
  if (pid) {
    process.kill(pid, "SIGTERM");
    await waitForProcessExit(pid, 5000);
    if (isProcessAlive(pid)) {
      process.kill(pid, "SIGKILL");
      await waitForProcessExit(pid, 2000);
    }
  }

  await runGit(["checkout", branch], cwd);
  await continueSession(id, null, layout);
}
