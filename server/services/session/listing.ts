import { realpathSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import type { ScanProgress, Session, SessionPreview } from "../../../shared/session.js";
import { listPreviewServers, previewsFor, type PreviewServer } from "../previewService.js";
import {
  belongsTo,
  readHistory,
  summarize,
  type HistoryEvent,
  type HistorySummary,
  type HistoryTarget,
} from "../historyService.js";
import {
  findJsonlFiles,
  getClaudeProjectsDir,
  readFullSessionPrompts,
  readSessionCustomTitle,
  readSessionHead,
  readSessionLatestGitBranch,
  readSessionPrompts,
  readSessionRecap,
  type SessionHead,
} from "../../utils/claudeProjects.js";
import { getDefaultBaseBranch, getGitDirs } from "../../utils/git.js";
import { REPO_ROOT } from "../../utils/repoRoot.js";
import { inferTaskKey } from "../../utils/taskKeys.js";
import { collectTaskRepos } from "../../utils/taskRepos.js";
import { getTaskStore, moveSessionTaskKeyToBranch } from "../../utils/taskStore.js";
import { getActiveResumeSessionIds } from "./activeSessions.js";
import { invalidSessionIdError, SessionNotFoundError } from "./errors.js";
import { findSessionFilePath, isSafeSessionId, repoRootFromMissingWorktreePath } from "./lookup.js";
import { directoryExists } from "./shell.js";

const UNTITLED = "Untitled";
const TITLE_MAX_LENGTH = 100;

function cleanTitle(raw: string): string {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  if (!collapsed) return UNTITLED;
  return collapsed.length > TITLE_MAX_LENGTH
    ? `${collapsed.slice(0, TITLE_MAX_LENGTH - 1)}…`
    : collapsed;
}

/** `customTitle` > `aiTitle` > `summaryTitle` > the CLI's away-summary recap > the first prompt. */
function resolveTitle(head: SessionHead, customTitle: string | null, recap: string | null): string {
  const source = customTitle ?? head.aiTitle ?? head.summaryTitle ?? recap ?? head.firstUserText;
  return source ? cleanTitle(source) : UNTITLED;
}

function resolveProject(head: SessionHead, filePath: string): string {
  if (head.cwd) return path.basename(head.cwd);
  const projectDir = path.basename(path.dirname(filePath));
  return projectDir.replace(/^-/, "") || projectDir;
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
    const [head, fileStat, prompts, customTitle, recap, latestGitBranch] = await Promise.all([
      readSessionHead(filePath),
      stat(filePath),
      readSessionPrompts(filePath),
      readSessionCustomTitle(filePath),
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
      title: resolveTitle(head, customTitle, recap),
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
    };
  } catch {
    return null;
  }
}

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

/** Untruncated prompts of one session (`Session.prompts` is truncated). */
export async function getSessionPrompts(id: string): Promise<string[]> {
  const filePath = await findSessionFilePath(id);
  if (!filePath) throw new SessionNotFoundError(id);
  return readFullSessionPrompts(filePath);
}
