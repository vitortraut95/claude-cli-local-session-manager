import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { accessSync, constants } from "node:fs";
import { access, mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  RootStatus,
  Session,
  SessionRepoInsights,
  SubagentDetail,
  WorktreeToRootPreview,
} from "../types/session.js";
import {
  findJsonlFiles,
  findSubagentFiles,
  getClaudeProjectsDir,
  mergeRawModelUsage,
  readFullSessionPrompts,
  readSessionActiveTimeMs,
  readSessionHead,
  readSessionPrompts,
  readSessionRecap,
  readSessionUsage,
  readSubagentMeta,
  readSubagentSummary,
  type SessionHead,
} from "../utils/claudeProjects.js";
import { summarizeUsage } from "../utils/pricing.js";
import { getNicknames, setNickname } from "../utils/nicknames.js";
import {
  findContinuedBy,
  getContinuations,
  linkContinuation,
} from "../utils/sessionContinuations.js";
import { runClaudeHeadlessSummary } from "../utils/claudeCli.js";
import { markWorktreeTrustAccepted } from "../utils/claudeTrust.js";
import { AppError } from "../utils/httpError.js";
import {
  applyFileDiff,
  checkoutExistingBranch,
  computeFileDiff,
  deleteLocalBranch,
  discardWorkingTreeChanges,
  getGitDirs,
  getGitHostInfo,
  getRepoRoot,
  getStatusFiles,
  isLinkedWorktree,
  listAppStashes,
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

/**
 * `recap` (the CLI's own auto-generated "what we did / what's next" away-summary, see
 * `readSessionRecap`) is preferred over `firstUserText`: both are prose fallbacks for when there's
 * no proper `aiTitle`/`summaryTitle`, but the recap describes the session's actual outcome instead
 * of just repeating whatever the user originally typed.
 */
function resolveTitle(head: SessionHead, recap: string | null): string {
  const source = head.aiTitle ?? head.summaryTitle ?? recap ?? head.firstUserText;
  return source ? cleanTitle(source) : UNTITLED;
}

function resolveProject(head: SessionHead, filePath: string): string {
  if (head.cwd) return path.basename(head.cwd);
  const projectDir = path.basename(path.dirname(filePath));
  return projectDir.replace(/^-/, "") || projectDir;
}

/** This app always creates its own worktrees at `<repoRoot>/.claude/worktrees/<name>` (see
 *  createSessionWorktree below). Once a worktree-backed session's original directory is gone
 *  (directoryMissing), that's the only way left to recover its repo root — the worktree itself no
 *  longer exists for git to tell us, so this is a plain string split on the recorded `cwd`, not a
 *  git call. */
const WORKTREE_PATH_SEGMENT = "/.claude/worktrees/";

function repoRootFromMissingWorktreePath(cwd: string): string | null {
  const index = cwd.indexOf(WORKTREE_PATH_SEGMENT);
  return index === -1 ? null : cwd.slice(0, index);
}

type BuiltSession = Omit<
  Session,
  "isActive" | "nickname" | "continuesFromSessionId" | "continuedBySessionId"
>;

async function buildSession(filePath: string): Promise<BuiltSession | null> {
  try {
    const [head, fileStat, prompts, rawUsage, subagentFiles, activeTimeMs, recap] =
      await Promise.all([
        readSessionHead(filePath),
        stat(filePath),
        readSessionPrompts(filePath),
        readSessionUsage(filePath),
        findSubagentFiles(filePath),
        readSessionActiveTimeMs(filePath),
        readSessionRecap(filePath),
      ]);
    const id = head.sessionId ?? path.basename(filePath, ".jsonl");
    // Unknown cwd (older session, or head parse didn't find one) isn't treated as missing —
    // only flag it once we actually know the original directory and it's gone.
    const directoryMissing = head.cwd ? !(await directoryExists(head.cwd)) : false;
    // Only surfaced once the repo root itself is confirmed to still exist — otherwise the UI
    // would offer "code ."/"resume" actions against a folder that's also gone.
    const repoRootGuess =
      directoryMissing && head.cwd ? repoRootFromMissingWorktreePath(head.cwd) : null;
    const missingWorktreeRepoRoot =
      repoRootGuess && (await directoryExists(repoRootGuess)) ? repoRootGuess : null;

    // Subagent token usage otherwise vanishes from the parent session's totals entirely (see
    // findSubagentFiles) — fold it into `usage`, and separately surface how much of that total
    // came from subagents so the UI can call it out rather than silently inflate the main number.
    const subagentRawUsageLists = await Promise.all(subagentFiles.map(readSessionUsage));
    const usage = summarizeUsage(mergeRawModelUsage([rawUsage, ...subagentRawUsageLists]));
    const subagentCostUsd =
      subagentFiles.length > 0
        ? summarizeUsage(mergeRawModelUsage(subagentRawUsageLists)).totalCostUsd
        : null;

    return {
      id,
      title: resolveTitle(head, recap),
      project: resolveProject(head, filePath),
      path: filePath,
      workingDirectory: head.cwd,
      gitBranch: head.gitBranch,
      // Placeholder — listSessions() fills in the real value once, memoized per unique
      // workingDirectory, rather than re-running `git rev-parse` for every session that shares one.
      isWorktree: false,
      updatedAt: fileStat.mtime.toISOString(),
      prompts,
      directoryMissing,
      missingWorktreeRepoRoot,
      sizeBytes: fileStat.size,
      subagentCount: subagentFiles.length,
      activeTimeMs,
      usage: { ...usage, subagentCostUsd },
    };
  } catch {
    return null;
  }
}

/**
 * Finds every session id currently running in a live `claude` process.
 *
 * Used to key off `ps -eo args=` output for a `claude --resume <id>` command line, but the CLI
 * (>=2.1.210) now hides its args from `ps`/`/proc/<pid>/cmdline` — every process shows up as bare
 * `claude`, so that regex never matches anymore. Instead, read the CLI's own state files at
 * `~/.claude/sessions/<pid>.json` (`{pid, sessionId, ...}`, one per running instance, written on
 * start and removed on clean exit) and confirm the pid is still alive with a signal-0 `kill` — a
 * dead pid means the file is a leftover from an unclean exit (e.g. `kill -9`) and its sessionId
 * should not count as active. `process.kill(pid, 0)` works the same way on Windows as on
 * Linux/macOS, so this also lifts the previous win32 restriction.
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

async function getActiveResumeSessionIds(): Promise<Set<string>> {
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

/** Finds the live pid backing a specific active session id, if any — used by
 *  `stopSiblingAndResume` to know what to signal. */
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

/** Polls until `pid` is gone or `timeoutMs` elapses — gives a just-signaled process a chance to
 *  actually exit (and release its worktree lock) before the caller moves on to `git checkout`. */
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

export async function listSessions(): Promise<Session[]> {
  const files = await findJsonlFiles(getClaudeProjectsDir());
  const [built, activeIds, nicknames, continuations] = await Promise.all([
    Promise.all(files.map(buildSession)),
    getActiveResumeSessionIds(),
    getNicknames(),
    getContinuations(),
  ]);

  const sessions = built.filter((session): session is BuiltSession => session !== null);

  // Many sessions share the same workingDirectory — run `git rev-parse` once per unique
  // directory rather than once per session (buildSession itself only sets a false placeholder).
  const uniqueDirs = [...new Set(sessions.map((s) => s.workingDirectory).filter((d) => d !== null))];
  const gitDirsList = await Promise.all(uniqueDirs.map((dir) => getGitDirs(dir)));
  const gitDirsByDir = new Map(uniqueDirs.map((dir, i) => [dir, gitDirsList[i]]));

  return sessions
    .map((session) => {
      const gitDirs = session.workingDirectory ? gitDirsByDir.get(session.workingDirectory) : null;
      const isWorktree = gitDirs ? gitDirs.gitDir !== gitDirs.commonGitDir : false;
      // A worktree-backed session's own `project` (derived from its cwd's basename, see
      // `resolveProject`) is the worktree/branch folder name, not the repo's — override it with
      // the shared repo root's basename so worktree sessions collapse onto the same "project" as
      // their main checkout, matching how the "new task" modal's `getKnownProjectFolders` already
      // dedups by repo root instead of raw directory. `gitDirs` is null (no live git call possible)
      // for an orphaned worktree whose directory no longer exists — fall back to
      // `missingWorktreeRepoRoot` there instead of session.project's raw (dead) worktree folder name.
      const project = gitDirs
        ? path.basename(path.dirname(gitDirs.commonGitDir))
        : session.missingWorktreeRepoRoot
          ? path.basename(session.missingWorktreeRepoRoot)
          : session.project;
      // `session.gitBranch` comes from the CLI's historical transcript log, not live git state —
      // if the directory isn't a git repo right now (deleted/moved since the session ran), null it
      // out so callers (e.g. the "delete branch" checkbox) don't act on a branch that doesn't exist.
      const gitBranch = gitDirs ? session.gitBranch : null;
      return {
        ...session,
        project,
        gitBranch,
        nickname: nicknames[session.id] ?? null,
        isActive: activeIds.has(session.id),
        isWorktree,
        continuesFromSessionId: continuations[session.id]?.continuesFrom ?? null,
        continuedBySessionId: findContinuedBy(continuations, session.id),
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Session ids are UUID-shaped; reject anything that looks like a path segment. */
function isSafeSessionId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

async function findSessionFilePath(id: string): Promise<string | null> {
  if (!isSafeSessionId(id)) return null;
  const files = await findJsonlFiles(getClaudeProjectsDir());
  const match = files.find((file) => path.basename(file, ".jsonl") === id);
  return match ?? null;
}

/**
 * The Claude CLI scopes sessions to the working directory they were started in
 * (`~/.claude/projects/<encoded-cwd>/`). To resume one, the new shell must start
 * in that same directory, or `claude --resume` looks in the wrong project and
 * reports the session as not found.
 */
async function findSessionCwd(id: string): Promise<string | null> {
  const filePath = await findSessionFilePath(id);
  if (!filePath) return null;
  const head = await readSessionHead(filePath);
  return head.cwd;
}

export class SessionNotFoundError extends AppError {
  constructor(id: string) {
    super("SESSION_NOT_FOUND", `Session "${id}" not found`);
    this.name = "SessionNotFoundError";
  }
}

export class SessionActiveError extends AppError {
  constructor(message: string) {
    super("SESSION_ACTIVE", message);
    this.name = "SessionActiveError";
  }
}

/** Shared by every `isSafeSessionId` guard below — same code regardless of which function's
 *  check failed, so the frontend only needs one translated message for all of them. */
function invalidSessionIdError(id: string): AppError {
  return new AppError("INVALID_SESSION_ID", `Invalid session id "${id}"`);
}

/**
 * Fetched on demand when the prompt-preview modal opens for a single session, rather than
 * embedded in `listSessions()` — see `readFullSessionPrompts` for why (it's untruncated, unlike
 * the copy already sitting in `Session.prompts`, which stays capped for the list payload).
 */
export async function getSessionPrompts(id: string): Promise<string[]> {
  const filePath = await findSessionFilePath(id);
  if (!filePath) throw new SessionNotFoundError(id);
  return readFullSessionPrompts(filePath);
}

export type CompactionDraft = {
  oldSessionId: string;
  oldTitle: string;
  gitBranch: string | null;
  /** Untruncated first user message — where a "New task"-launched session's Jira link and
   *  instructions live (see taskService.ts's `launchTaskTerminal`). Included verbatim in the
   *  pt2 prompt below whenever it isn't already covered by the generated summary. */
  firstPrompt: string | null;
  summary: string;
};

const COMPACT_SUMMARY_INSTRUCTION =
  "Summarize this session for continuation in a brand-new, lighter session: what was done, key " +
  "decisions made, the current state of the code, and what's left to do. Be specific — name " +
  "files, branches, and decisions. Reply with only the summary, no extra commentary.";

/**
 * Generates the draft shown in the "Compact & continue" modal before anything is launched. The
 * summary itself comes from a real, non-interactive turn against the session's own transcript
 * (`runClaudeHeadlessSummary`) — grounded in the whole conversation, not just its most recent
 * away-summary — falling back down the same chain `resolveTitle` uses (recap, then title, then
 * the first message) if that call fails, times out, or the session has no known `cwd` to run it
 * in. Never throws over the summary step itself; only a missing/invalid session id is fatal.
 */
export async function getCompactionDraft(id: string): Promise<CompactionDraft> {
  if (!isSafeSessionId(id)) {
    throw invalidSessionIdError(id);
  }
  const filePath = await findSessionFilePath(id);
  if (!filePath) throw new SessionNotFoundError(id);

  const [head, recap, prompts] = await Promise.all([
    readSessionHead(filePath),
    readSessionRecap(filePath),
    readFullSessionPrompts(filePath),
  ]);
  const oldTitle = resolveTitle(head, recap);
  const firstPrompt = prompts[0] ?? null;

  const headlessSummary = head.cwd
    ? await runClaudeHeadlessSummary(id, head.cwd, COMPACT_SUMMARY_INSTRUCTION)
    : null;
  const summary = headlessSummary ?? recap ?? head.aiTitle ?? head.summaryTitle ?? head.firstUserText ?? "";

  return { oldSessionId: id, oldTitle, gitBranch: head.gitBranch, firstPrompt, summary };
}

/** Composes the pt2 session's opening message — old session's title/id/branch for traceability,
 *  the original task text (if any, and if the summary doesn't already subsume it), then the
 *  (possibly user-edited) summary, so the new conversation starts with as close to the old one's
 *  full context as a single message can carry. */
function composeContinuationPrompt(draft: CompactionDraft, summary: string): string {
  const branchSuffix = draft.gitBranch ? `, branch: ${draft.gitBranch}` : "";
  const parts = [
    `Continuing the previous session "${draft.oldTitle}" (id: ${draft.oldSessionId}${branchSuffix}).`,
  ];

  const trimmedFirstPrompt = draft.firstPrompt?.trim();
  const trimmedSummary = summary.trim();
  if (trimmedFirstPrompt && trimmedFirstPrompt !== trimmedSummary) {
    parts.push(`Original task:\n${trimmedFirstPrompt}`);
  }
  if (trimmedSummary) {
    parts.push(`Summary of work already done:\n${trimmedSummary}`);
  }
  parts.push("Continue from here.");
  return parts.join("\n\n");
}

/**
 * Launches a brand-new (never `--resume`d) session in the old session's own working directory,
 * seeded with `composeContinuationPrompt`'s summary, and links it back to `id` in
 * `session-continuations.json` — *before* opening the terminal, since `--session-id` lets this
 * app choose the new session's id up front instead of having to discover it after the fact (see
 * sessionContinuations.ts's own doc comment for why that matters). `summary` is the modal's
 * (possibly user-edited) draft text, not re-generated here.
 */
export async function startCompactedContinuation(
  id: string,
  summary: string,
): Promise<{ newSessionId: string }> {
  if (!isSafeSessionId(id)) {
    throw invalidSessionIdError(id);
  }

  const activeIds = await getActiveResumeSessionIds();
  if (activeIds.has(id)) {
    throw new SessionActiveError(`Session "${id}" is already open in a terminal.`);
  }

  const filePath = await findSessionFilePath(id);
  if (!filePath) throw new SessionNotFoundError(id);

  const [head, recap, prompts] = await Promise.all([
    readSessionHead(filePath),
    readSessionRecap(filePath),
    readFullSessionPrompts(filePath),
  ]);
  if (!head.cwd) {
    throw new Error("This session has no known working directory to continue in.");
  }
  if (!(await directoryExists(head.cwd))) {
    throw new Error(
      `This session's original directory no longer exists ("${head.cwd}"). Recreate the folder ` +
        `(or a symlink) at the old path before continuing there.`,
    );
  }

  const draft: CompactionDraft = {
    oldSessionId: id,
    oldTitle: resolveTitle(head, recap),
    gitBranch: head.gitBranch,
    firstPrompt: prompts[0] ?? null,
    summary,
  };
  const prompt = composeContinuationPrompt(draft, summary);
  const newSessionId = randomUUID();
  const displayName = cleanTitle(`${draft.oldTitle} (pt2)`);

  await linkContinuation(newSessionId, id);
  await launchInTerminal(
    `claude --session-id ${newSessionId} --name ${posixShellQuote(displayName)} ${posixShellQuote(prompt)}`,
    head.cwd,
  );

  return { newSessionId };
}

/** `agent-<id>.jsonl` and its sibling `agent-<id>.meta.json` share a directory and id. */
function subagentMetaPath(jsonlPath: string): string {
  const agentId = path.basename(jsonlPath, ".jsonl").replace(/^agent-/, "");
  return path.join(path.dirname(jsonlPath), `agent-${agentId}.meta.json`);
}

/**
 * Fetched on demand (mirrors getSessionPrompts above) rather than embedded in listSessions() —
 * each subagent's own transcript has to be read in full to find its last assistant text (see
 * readSubagentSummary), which would be too heavy to do for every session up front.
 */
export async function getSessionSubagents(id: string): Promise<SubagentDetail[]> {
  const filePath = await findSessionFilePath(id);
  if (!filePath) throw new SessionNotFoundError(id);

  const subagentFiles = await findSubagentFiles(filePath);
  const details = await Promise.all(
    subagentFiles.map(async (jsonlPath): Promise<SubagentDetail> => {
      const agentId = path.basename(jsonlPath, ".jsonl").replace(/^agent-/, "");
      const metaPath = subagentMetaPath(jsonlPath);
      const [meta, summary, rawUsage] = await Promise.all([
        readSubagentMeta(metaPath),
        readSubagentSummary(jsonlPath),
        readSessionUsage(jsonlPath),
      ]);

      return {
        agentId,
        agentType: meta.agentType,
        description: meta.description,
        resultText: summary.resultText,
        startedAt: summary.startedAt,
        endedAt: summary.endedAt,
        usage: summarizeUsage(rawUsage),
      };
    }),
  );

  return details.sort((a, b) => (a.startedAt ?? "").localeCompare(b.startedAt ?? ""));
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Supplies the two repo-side facts the Insights panel can't get from a session's own data: does
 * its project already document itself (a CLAUDE.md), and what did this session's Explore
 * subagents have to go dig up (each one is a candidate topic to add there). Tip wording/severity
 * logic lives client-side in src/utils/sessionInsights.ts — this only reports facts.
 */
export async function getSessionRepoInsights(id: string): Promise<SessionRepoInsights> {
  const filePath = await findSessionFilePath(id);
  if (!filePath) throw new SessionNotFoundError(id);

  const [head, subagentFiles] = await Promise.all([
    readSessionHead(filePath),
    findSubagentFiles(filePath),
  ]);

  const [hasClaudeMd, metas] = await Promise.all([
    head.cwd ? fileExists(path.join(head.cwd, "CLAUDE.md")) : Promise.resolve(null),
    Promise.all(subagentFiles.map((jsonlPath) => readSubagentMeta(subagentMetaPath(jsonlPath)))),
  ]);

  const exploreTopics = metas
    .filter((meta) => meta.agentType === "Explore" && meta.description)
    .map((meta) => meta.description!);

  return { hasClaudeMd, exploreTopics };
}

/**
 * Builds a PR/compare URL for a session's branch, for an "Open PR" button — no API token needed,
 * since the caller just opens this in the user's own browser, which already carries that
 * provider's own session. `branch` comes from the client (the session's own `gitBranch` field),
 * same convention as `deleteSessionBranch`/`stopSiblingAndResume` — returns null (not a throw)
 * whenever a PR link can't be built: no known working directory, or `origin` isn't a recognized
 * github.com/bitbucket.org remote (see `getGitHostInfo`).
 *
 * - GitHub's compare page pre-fills the "Create pull request" form against the repo's default
 *   branch when only one ref is given, so this doesn't need to know the base branch at all.
 * - Bitbucket has no exact equivalent — `pull-requests/new?source=<branch>` opens the "create
 *   pull request" form for that branch, and if one's already open for it, Bitbucket itself shows
 *   a banner linking to the existing PR rather than this app trying to look up its number (that
 *   would need the Bitbucket API and its own credentials — see CLAUDE.md's Jenkins-integration
 *   to-do for the same tradeoff on a different provider).
 */
export async function getSessionPrUrl(id: string, branch: string): Promise<string | null> {
  const trimmedBranch = branch.trim();
  if (!trimmedBranch) return null;

  const cwd = await findSessionCwd(id);
  if (!cwd) throw new SessionNotFoundError(id);

  const hostInfo = await getGitHostInfo(cwd);
  if (!hostInfo) return null;

  const encodedBranch = encodeURIComponent(trimmedBranch);
  return hostInfo.host === "github"
    ? `https://github.com/${hostInfo.slug}/compare/${trimmedBranch}?expand=1`
    : `https://bitbucket.org/${hostInfo.slug}/pull-requests/new?source=${encodedBranch}&t=1`;
}

/**
 * Deleting a session that's actively `claude --resume`d would pull the `.jsonl` file out from
 * under a running process mid-write — reject it server-side too, not just via the disabled
 * Delete button in the UI, in case a session becomes active between page load and this request
 * landing (same defense-in-depth reasoning as `setSessionNickname`/`continueSession` below).
 */
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
}

/**
 * Deletes a local git branch in the session's own working directory — offered as an option
 * alongside session deletion (see routes/sessions.ts `DELETE /:id/branch`) for sessions that
 * aren't worktree-backed; a worktree's own "clean up worktree" checkbox already deletes its
 * branch as part of `removeWorktreeAndBranch`, so this is the non-worktree equivalent. `branch`
 * comes from the client (the session's own `gitBranch` field) rather than being re-derived here,
 * same as `stopSiblingAndResume`'s `branch` param.
 */
export async function deleteSessionBranch(id: string, branch: string): Promise<void> {
  if (!isSafeSessionId(id)) {
    throw invalidSessionIdError(id);
  }
  const trimmedBranch = branch.trim();
  if (!trimmedBranch) {
    throw new Error("A branch name is required.");
  }

  const cwd = await findSessionCwd(id);
  if (!cwd) throw new SessionNotFoundError(id);
  if (!(await directoryExists(cwd))) {
    throw new Error(`This session's original directory no longer exists ("${cwd}").`);
  }

  await deleteLocalBranch(cwd, trimmedBranch);
}

/**
 * Nicknames are purely local (see `nicknames.ts`), but still gated on the session being
 * inactive for consistency with the other mutating actions — not for data-race reasons (nothing
 * here touches the session's own `.jsonl`), just so a session can't be relabeled while someone
 * might be actively working in it, mirroring `deleteSession`/`continueSession` above.
 */
export async function setSessionNickname(id: string, nickname: string): Promise<void> {
  if (!isSafeSessionId(id)) {
    throw invalidSessionIdError(id);
  }

  const activeIds = await getActiveResumeSessionIds();
  if (activeIds.has(id)) {
    throw new SessionActiveError(
      `Session "${id}" is currently active in a terminal — close it before changing its nickname.`,
    );
  }

  await setNickname(id, nickname);
}

/** Time to wait for an immediate spawn failure (e.g. binary missing) before assuming success. */
const SPAWN_ERROR_GRACE_PERIOD_MS = 300;

/**
 * Candidate terminal emulators, tried in order until one launches. Each is invoked as
 * `<bin> ...flag, "bash", "-c", shellCmd` — argv-style rather than a single shell string, since
 * most of these emulators exec their `-e`/`--` payload directly instead of passing it through a shell.
 *
 * `open-terminal.sh` (repo root) duplicates this exact list by hand, as a plain Bash array — it
 * has to work before Node/yarn are guaranteed to even be on PATH (see CLAUDE.md), so it can't
 * import this. `yarn lint` runs `scripts/check-terminal-launchers-sync.mjs` to catch the two
 * drifting apart; update both if you touch this list.
 */
const TERMINAL_LAUNCHERS: { bin: string; buildArgs: (shellCmd: string) => string[] }[] = [
  { bin: "x-terminal-emulator", buildArgs: (c) => ["-e", "bash", "-c", c] },
  { bin: "gnome-terminal", buildArgs: (c) => ["--", "bash", "-c", c] },
  { bin: "konsole", buildArgs: (c) => ["-e", "bash", "-c", c] },
  { bin: "xfce4-terminal", buildArgs: (c) => ["-x", "bash", "-c", c] },
  { bin: "xterm", buildArgs: (c) => ["-e", "bash", "-c", c] },
];

const SNAP_ORIG_SUFFIX = "_VSCODE_SNAP_ORIG";

/**
 * When this server itself runs inside VS Code's integrated terminal and VS Code was installed
 * as a snap, its wrapper script overrides GTK/XDG/locale env vars (GTK_PATH, LOCPATH,
 * XDG_DATA_DIRS, ...) to point at libraries bundled in the snap, stashing each original value in
 * a `<VAR>_VSCODE_SNAP_ORIG` sibling. Those overrides leak to every child process; spawning a
 * separate GTK app like gnome-terminal under them causes glibc/GTK symbol mismatches (e.g.
 * `undefined symbol: __libc_pthread_init`) because it loads mismatched libraries from the snap.
 * Undo the override for the terminal we spawn by restoring (or deleting) each affected var.
 */
function sanitizedSpawnEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  if (process.platform !== "linux") return env;

  for (const key of Object.keys(env)) {
    if (!key.endsWith(SNAP_ORIG_SUFFIX)) continue;
    const originalVar = key.slice(0, -SNAP_ORIG_SUFFIX.length);
    const originalValue = env[key];
    if (originalValue) {
      env[originalVar] = originalValue;
    } else {
      delete env[originalVar];
    }
  }
  return env;
}

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

/**
 * Pure-Node PATH lookup — same job as `which`/`where`, but without shelling out to a binary
 * that doesn't exist by that name on every OS (Windows has `where`, not `which`). Checks each
 * `PATH` entry for `bin` (plus every `PATHEXT` suffix on Windows, since `foo` there really
 * means `foo.exe`/`foo.cmd`/etc).
 */
function commandExists(bin: string): boolean {
  const dirs = (process.env.PATH ?? "").split(path.delimiter);
  const extensions =
    process.platform === "win32" ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(path.delimiter) : [""];

  for (const dir of dirs) {
    for (const ext of extensions) {
      try {
        accessSync(path.join(dir, bin + ext), constants.X_OK);
        return true;
      } catch {
        // Not in this PATH entry — keep looking.
      }
    }
  }
  return false;
}

/**
 * `WARP_DATA_DIR` lets this be overridden outright — useful on macOS/Windows, where Warp's data
 * directory isn't the Linux XDG one below and hasn't been mapped out here yet (see project notes
 * for cross-platform work still to do). Without the override, this only targets Linux.
 */
function getWarpTabConfigsDir(): string {
  if (process.env.WARP_DATA_DIR) {
    return path.join(process.env.WARP_DATA_DIR, "tab_configs");
  }
  const dataHome = process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local", "share");
  return path.join(dataHome, "warp-terminal", "tab_configs");
}

const WARP_TAB_CONFIG_PREFIX = "claude-session-manager-";
/**
 * Long enough that a slow cold-start Warp launch has certainly read the file by the time the
 * *next* one is written — see `pruneStaleWarpTabConfigs`'s doc comment for why this can't just
 * delete the file it opens right after opening it.
 */
const WARP_TAB_CONFIG_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * Each `launchWarp` call writes a new, uniquely-named tab config and never cleans it up on its
 * own — they'd otherwise accumulate forever in Warp's own "Tab Config" list (every past resume
 * shows up as a separate entry). Deleting the file right after opening it isn't safe: `xdg-open`
 * returning success only means the URI was handed off, not that Warp has actually read the file
 * yet (cold-start, when Warp isn't already running, can take a noticeable moment). Instead, each
 * new launch sweeps up *old* ones first — anything past `WARP_TAB_CONFIG_MAX_AGE_MS` old is
 * certainly already consumed, so there's no race. Only touches files with our own naming prefix,
 * never a user's own hand-made tab configs living in the same directory.
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
 * Escapes `value` to sit inside a TOML basic (double-quoted, single-line) string. Backslash must
 * be escaped first — the other replacements each introduce a fresh backslash of their own, which
 * would get double-escaped if this ran after them. Newline/carriage-return escaping matters more
 * here than it looks: a TOML basic string can't contain a raw newline at all (only a multi-line
 * `"""..."""` string can), so a multi-paragraph "new task" prompt with blank lines between
 * sections used to produce a `commands = [...]` value invalid enough that Warp refused to even
 * load the tab config ("TOML parse error ... invalid basic string").
 */
function toTomlBasicString(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

/**
 * Warp has no `-e`/`--` flag to run a command on launch — the only way in is writing a "Tab
 * Config" TOML file and opening it through Warp's own `warp://tab_config/<name>` URI scheme
 * (verified working: the pane respects `directory` and runs `commands` on open, unlike the
 * older/deprecated Launch Configuration YAML format, where external triggers are known to
 * silently drop the command).
 *
 * Linux-only for now: Warp's real data directory on macOS/Windows (and even its CLI binary name
 * there) hasn't been verified against a real install. Guessing wrong would fail silently — Warp
 * would still open, just without ever finding the tab config, since it'd be looking in the wrong
 * folder — which is worse than skipping straight to the plain-terminal fallback below. See
 * CLAUDE.md.
 */
async function launchWarp(command: string, cwd?: string): Promise<boolean> {
  if (process.platform !== "linux") return false;
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

  // No `?new_window=true`: when Warp isn't already running, that flag forces a second window
  // on top of the one Warp opens on its own during startup. Without it, the tab config opens in
  // whichever window is already active (the one just opened, or an existing one).
  return trySpawnDetached("xdg-open", [`warp://tab_config/${encodeURIComponent(name)}`]);
}

/** Wraps `value` in single quotes for a POSIX shell, escaping any embedded ones. */
export function posixShellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Escapes `value` to sit inside an AppleScript double-quoted string literal. */
function escapeForAppleScript(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * NOT YET SMOKE-TESTED ON A REAL MAC — written from documented `osascript`/Terminal.app
 * behavior, but nobody has run this on macOS yet. Verify before relying on it.
 *
 * `do script "<command>"` opens a new Terminal window, runs the command, and leaves the shell
 * at a fresh prompt afterwards (unlike the Linux emulators below, which close the instant their
 * wrapped `bash -c` exits) — so no "press enter to close" pause is needed here.
 */
async function launchMacTerminal(resumeCommand: string, cwd?: string): Promise<boolean> {
  // osascript's own `cwd` (a spawn option) only affects osascript itself, not the new Terminal
  // window Terminal.app creates — the working directory has to be part of the script's command.
  const shellCommand = cwd ? `cd ${posixShellQuote(cwd)} && ${resumeCommand}` : resumeCommand;
  const script =
    `tell application "Terminal"\n` +
    `  activate\n` +
    `  do script "${escapeForAppleScript(shellCommand)}"\n` +
    `end tell`;
  return trySpawnDetached("osascript", ["-e", script]);
}

/**
 * NOT YET SMOKE-TESTED ON A REAL WINDOWS MACHINE — written from documented `wt.exe`/`cmd.exe`
 * behavior, but nobody has run this on Windows yet. Verify before relying on it, especially
 * `cwd` values containing characters cmd.exe treats specially (`&`, `%`, `^`, parentheses).
 *
 * Tries Windows Terminal first (falls back to a plain `cmd.exe` window via `start`, which every
 * Windows install has). `/k` (vs. `/c`) keeps the window open with an interactive prompt after
 * the command exits — the same "stay open" job the Linux branch's `read -p` pause does.
 */
async function launchWindowsTerminal(resumeCommand: string, cwd?: string): Promise<boolean> {
  // Like macOS above: the new window's starting directory has to be requested explicitly
  // (`-d`/`/d`), since it isn't reliably inherited from the process we spawn here.
  if (
    await trySpawnDetached(
      "wt.exe",
      cwd ? ["-d", cwd, "cmd", "/k", resumeCommand] : ["cmd", "/k", resumeCommand],
    )
  ) {
    return true;
  }

  return trySpawnDetached("cmd.exe", [
    "/c",
    "start",
    ...(cwd ? ["/d", cwd] : []),
    "cmd",
    "/k",
    resumeCommand,
  ]);
}

/**
 * Opens `dir` in VS Code via its `code` CLI — no terminal involved: `code <dir>` already opens the
 * folder directly, so there's nothing to gain from wrapping it in a terminal window just to run
 * the same command and close again.
 *
 * `--new-window` forces a fresh window every time — without it, `code` reuses an already-open
 * window and swaps its folder out from under whatever the user was looking at there.
 */
async function openDirInVSCode(dir: string): Promise<void> {
  if (!(await directoryExists(dir))) {
    throw new Error(`This directory no longer exists ("${dir}").`);
  }

  if (!(await trySpawnDetached("code", ["--new-window", dir]))) {
    throw new Error(
      `Could not open VS Code — the "code" command wasn't found on PATH. In VS Code, run ` +
        `"Shell Command: Install 'code' command in PATH" from the Command Palette.`,
    );
  }
}

/**
 * Opens a session's own working directory in VS Code. Doesn't touch git at all; `gitBranch` on
 * the session is informational only (recorded when the CLI last logged an entry, may be stale),
 * and checking it out here could collide with another Claude session or terminal still working in
 * that same directory.
 */
export async function openInVSCode(id: string): Promise<void> {
  if (!isSafeSessionId(id)) {
    throw invalidSessionIdError(id);
  }

  const cwd = await findSessionCwd(id);
  if (!cwd) {
    throw new Error("This session has no known working directory to open.");
  }
  try {
    await openDirInVSCode(cwd);
  } catch {
    throw new Error(
      `This session's original directory no longer exists ("${cwd}"). Recreate the folder ` +
        `(or a symlink) at the old path before opening it in VS Code.`,
    );
  }
}

/**
 * Opens a worktree-backed session's *repo root* (not the worktree itself) in VS Code — backs the
 * "Worktree → root" modal's "code ." button next to the root dirty-files list, so the user can
 * actually look at what's about to be discarded/overwritten before confirming. Reuses the same
 * session-id → repo-root resolution as the rest of the "worktree → root" flow.
 */
export async function openWorktreeRootInVSCode(id: string): Promise<void> {
  const { repoRoot } = await resolveWorktreeAndRepoRoot(id);
  await openDirInVSCode(repoRoot);
}

/** Shared by the two "orphaned worktree" recovery actions below: re-derives the repo root purely
 *  from the session's recorded `cwd` (the worktree itself is gone — there's nothing left for git
 *  to tell us) and confirms it still exists on disk. */
async function resolveMissingWorktreeRepoRoot(
  id: string,
): Promise<{ head: SessionHead; filePath: string; repoRoot: string }> {
  if (!isSafeSessionId(id)) {
    throw invalidSessionIdError(id);
  }
  const filePath = await findSessionFilePath(id);
  if (!filePath) throw new SessionNotFoundError(id);

  const head = await readSessionHead(filePath);
  if (!head.cwd) {
    throw new Error("This session has no known working directory.");
  }
  const repoRoot = repoRootFromMissingWorktreePath(head.cwd);
  if (!repoRoot) {
    throw new Error("This session's directory doesn't look like one of this app's own worktrees.");
  }
  if (!(await directoryExists(repoRoot))) {
    throw new Error(`The project's root folder no longer exists either ("${repoRoot}").`);
  }
  return { head, filePath, repoRoot };
}

/** Opens the repo root in VS Code for an orphaned worktree session (its own directory is gone —
 *  see `missingWorktreeRepoRoot`). Unlike `openWorktreeRootInVSCode`, doesn't touch git at all;
 *  the worktree no longer exists for git to query. */
export async function openMissingWorktreeRootInVSCode(id: string): Promise<void> {
  const { repoRoot } = await resolveMissingWorktreeRepoRoot(id);
  await openDirInVSCode(repoRoot);
}

/**
 * Starts a brand-new `claude` conversation in an orphaned worktree session's repo root — not a
 * `claude --resume`: the CLI ties a transcript to the exact directory it was started in (see
 * `findSessionCwd`'s doc comment), and that directory is gone. Seeds the new conversation with the
 * old session's own away-summary recap (the CLI's "what we did / what's next" note, see
 * `readSessionRecap`) as its first message so it starts with real context instead of a blank
 * slate, falling back down the same title-resolution chain `resolveTitle` uses for sessions that
 * never triggered an away-summary.
 */
export async function startFreshSessionAtMissingWorktreeRoot(id: string): Promise<void> {
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

  await launchInTerminal(`claude ${posixShellQuote(prompt)}`, repoRoot);
}

/**
 * Shared by `continueSession` and `createSessionWorktree` — the only difference between resuming
 * a session and starting a fresh worktree-scoped one is the command string; the terminal-picking
 * cascade (Warp, then OS-specific, then the plain-emulator list) is identical either way. Always
 * tries Warp first (silently falls through to the OS-specific terminal launcher below when Warp
 * isn't installed, per `launchWarp`'s own `commandExists`/platform checks) — no user-facing toggle
 * for this anymore.
 */
export async function launchInTerminal(command: string, cwd?: string): Promise<void> {
  if (await launchWarp(command, cwd)) {
    return;
  }

  if (process.platform === "darwin") {
    if (await launchMacTerminal(command, cwd)) return;
    throw new Error("Could not open Terminal.app (osascript failed to launch).");
  }

  if (process.platform === "win32") {
    if (await launchWindowsTerminal(command, cwd)) return;
    throw new Error("Could not open a terminal (tried: Windows Terminal, cmd.exe).");
  }

  // Warp tabs stay open on their own after the command finishes, but the other emulators close
  // their window the instant the wrapped `bash -c` exits — so only these get the "press enter" pause.
  const shellCmd = `${command}; echo; read -p "Press Enter to close..." _`;

  for (const launcher of TERMINAL_LAUNCHERS) {
    const started = await trySpawnDetached(launcher.bin, launcher.buildArgs(shellCmd), cwd);
    if (started) return;
  }

  throw new Error(
    `No terminal emulator found (tried: ${TERMINAL_LAUNCHERS.map((l) => l.bin).join(", ")}).`,
  );
}

/**
 * Rejects an already-active session server-side too, not just via the disabled Continue button
 * in the UI: opening a second `claude --resume` for the same session would race with the first
 * process's own writes to that session's `.jsonl`.
 */
export async function continueSession(id: string): Promise<void> {
  if (!isSafeSessionId(id)) {
    throw invalidSessionIdError(id);
  }

  const activeIds = await getActiveResumeSessionIds();
  if (activeIds.has(id)) {
    throw new SessionActiveError(`Session "${id}" is already open in a terminal.`);
  }

  const cwd = await findSessionCwd(id);
  if (cwd && !(await directoryExists(cwd))) {
    throw new Error(
      `This session's original directory no longer exists ("${cwd}"). Since the Claude CLI ` +
        `resolves sessions by working directory, it can't be resumed from here — recreate the ` +
        `folder (or a symlink) at the old path pointing to the project's current location.`,
    );
  }

  // `id` is already validated above (alphanumeric/dash/underscore only), so it's safe to interpolate.
  await launchInTerminal(`claude --resume ${id}`, cwd ?? undefined);
}

/**
 * Opens a fresh `claude --worktree <name>` in `id`'s own project directory — not
 * `claude --resume <id>`: the CLI keys a session's transcript to the exact absolute path it was
 * started in (see `findSessionCwd`'s doc comment), so a past session can never be resumed from a
 * different directory, worktree or not. This is for starting a *second*, independent Claude
 * working in parallel on another branch, not for continuing this specific transcript elsewhere.
 *
 * Delegates the actual git worktree creation to the CLI's own `-w/--worktree [name]` flag rather
 * than driving `git worktree add` by hand: the CLI already creates the linked worktree at
 * `<repo>/.claude/worktrees/<name>` on a fresh `worktree-<name>` branch, locks it for the
 * session's lifetime, and starts the conversation there in one step — reimplementing that
 * wouldn't gain anything and would risk drifting from whatever the CLI does internally as it
 * evolves. `removeWorktreeAndBranch` (see git.ts) knows to unlock it again on delete.
 */
export async function createSessionWorktree(id: string, requestedName: string): Promise<void> {
  if (!isSafeSessionId(id)) {
    throw invalidSessionIdError(id);
  }
  const name = requestedName.trim();
  if (!name) {
    throw new Error("A worktree name is required.");
  }

  const cwd = await findSessionCwd(id);
  if (!cwd) throw new SessionNotFoundError(id);
  if (!(await directoryExists(cwd))) {
    throw new Error(`This session's original directory no longer exists ("${cwd}").`);
  }

  // Best-effort, ahead of the launch below rather than after: the CLI's own `--worktree` flag
  // (see markWorktreeTrustAccepted's doc comment) checks *this* directory's trust before it ever
  // creates the new one, so pre-trusting only the destination wouldn't help this specific call —
  // but pre-trusting the destination now means a *later* worktree op sourced from it (e.g.
  // another resume-conflict, chained off this one) won't hit the same wall. Predicts the CLI's
  // own `<repoRoot>/.claude/worktrees/<name>` convention (confirmed by direct reproduction); a
  // wrong guess just means this specific write has no effect; it can't ever break the launch below.
  const repoRoot = await getRepoRoot(cwd);
  if (repoRoot) {
    const worktreeDirName = sanitizeWorktreeDirName(name);
    await markWorktreeTrustAccepted(path.join(repoRoot, ".claude", "worktrees", worktreeDirName));
  }

  await launchInTerminal(`claude --worktree ${posixShellQuote(name)}`, cwd);
}

/**
 * Removes the linked worktree that `id`'s session runs in, and the branch git created for it.
 * Blocked (409, like the other mutating actions in this file) while *any* session rooted at that
 * same directory is still active — not just this one — since deleting the worktree out from
 * under a still-running `claude` process would pull its files out from under it.
 */
export async function deleteSessionWorktree(id: string): Promise<void> {
  if (!isSafeSessionId(id)) {
    throw invalidSessionIdError(id);
  }

  const cwd = await findSessionCwd(id);
  if (!cwd) throw new SessionNotFoundError(id);
  if (!(await directoryExists(cwd))) {
    throw new Error(`This session's directory no longer exists ("${cwd}").`);
  }
  if (!(await isLinkedWorktree(cwd))) {
    throw new Error("This session isn't running in a git worktree.");
  }

  const sessions = await listSessions();
  const stillActive = sessions.some((s) => s.workingDirectory === cwd && s.isActive);
  if (stillActive) {
    throw new SessionActiveError(
      "A session is still active in this worktree — close its terminal before deleting it.",
    );
  }

  await removeWorktreeAndBranch(cwd);
}

/** Shared validation for every "worktree → root" function below: resolves the session's worktree
 *  cwd and its repo root, throwing the same errors `deleteSessionWorktree` already uses for an
 *  unknown session / missing directory / non-worktree session. */
async function resolveWorktreeAndRepoRoot(id: string): Promise<{ cwd: string; repoRoot: string }> {
  if (!isSafeSessionId(id)) {
    throw invalidSessionIdError(id);
  }

  const cwd = await findSessionCwd(id);
  if (!cwd) throw new SessionNotFoundError(id);
  if (!(await directoryExists(cwd))) {
    throw new Error(`This session's directory no longer exists ("${cwd}").`);
  }
  if (!(await isLinkedWorktree(cwd))) {
    throw new Error("This session isn't running in a git worktree.");
  }

  const repoRoot = await getRepoRoot(cwd);
  if (!repoRoot) {
    throw new Error(`Could not resolve the repo root for "${cwd}".`);
  }

  return { cwd, repoRoot };
}

/**
 * Read-only snapshot for the "worktree → root" modal: both branches, root's dirty-file list (what
 * the shared "reset root" step would discard), and a plain filesystem diff between the two working
 * trees (for "copy" mode's preview). Informational only — `rootHasActiveSession`/
 * `worktreeHasActiveSession` let the modal warn before the user even picks a mode, but the actual
 * blocking check happens fresh again in each mutating function below, since this preview can sit
 * on screen for a while (the user picking a mode, reading the diff, ...) before anything runs.
 */
export async function getWorktreeToRootPreview(id: string): Promise<WorktreeToRootPreview> {
  const { cwd, repoRoot } = await resolveWorktreeAndRepoRoot(id);

  const entries = await listWorktrees(repoRoot);
  const excludePaths = nestedWorktreeRelativePaths(repoRoot, entries);
  const [rootDirtyFiles, fileDiff, sessions] = await Promise.all([
    getStatusFiles(repoRoot, excludePaths),
    computeFileDiff(cwd, repoRoot),
    listSessions(),
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
  };
}

/**
 * Read-only, cheap counterpart to `getWorktreeToRootPreview` — just root's branch and dirty-file
 * list, skipping the (comparatively expensive) file diff entirely. Backs the standalone "Reset
 * root" quick action's confirm dialog and the wizard's own final-confirm re-check, neither of
 * which needs anything more than this to show an accurate "here's what's about to be discarded."
 */
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
 * First step for both "worktree → root" modes: discards every uncommitted change in the repo's
 * main checkout so the copy/checkout step that follows starts from a clean, known state. Fresh
 * active-session check right here (not trusted from an earlier preview fetch) — same
 * zero-tolerance pattern as deleteSession/continueSession/setSessionNickname above, since this
 * would otherwise destroy uncommitted work in root. Not actually irreversible, though: returns
 * the stash SHA `discardWorkingTreeChanges` stores it under (null if root had nothing dirty), so
 * the caller can tell the user how to get it back.
 *
 * Excludes nested worktrees (see `nestedWorktreeRelativePaths`) from what gets stashed — root's
 * own `.claude/worktrees/<name>` entries are other sessions' git repositories, not uncommitted user
 * content, and stashing them would risk corrupting whatever is still using them.
 */
export async function resetRootWorkingTree(id: string): Promise<string | null> {
  const { repoRoot } = await resolveWorktreeAndRepoRoot(id);

  const sessions = await listSessions();
  if (sessions.some((s) => s.workingDirectory === repoRoot && s.isActive)) {
    throw new SessionActiveError(
      "A session is active in the root project directory — close its terminal before continuing.",
    );
  }

  const entries = await listWorktrees(repoRoot);
  const excludePaths = nestedWorktreeRelativePaths(repoRoot, entries);
  return discardWorkingTreeChanges(repoRoot, excludePaths);
}

/**
 * "Copy" mode's second (and last) step: recomputes the file diff fresh against root's *current*
 * state — never trusts whatever diff the client saw in an earlier preview fetch, since that
 * decides what gets deleted/overwritten here — and applies it. The worktree itself is never
 * touched (not deleted, nothing checked out).
 */
export async function applyWorktreeCopyToRoot(id: string): Promise<void> {
  const { cwd, repoRoot } = await resolveWorktreeAndRepoRoot(id);

  const sessions = await listSessions();
  if (sessions.some((s) => s.workingDirectory === repoRoot && s.isActive)) {
    throw new SessionActiveError(
      "A session is active in the root project directory — close its terminal before continuing.",
    );
  }

  const diff = await computeFileDiff(cwd, repoRoot);
  await applyFileDiff(cwd, repoRoot, diff);
}

/**
 * "Checkout" mode's second (and last) step: removes the linked worktree (unlocked first, its
 * branch kept alive via `removeWorktreeKeepBranch`) and checks that branch out in root, as one
 * operation. Deliberately not split into a separate "remove" call followed by a separate
 * "checkout" call the frontend awaits one after another — the gap between those two git commands
 * would leave the repo in an unrecoverable, hard-to-describe intermediate state (worktree gone,
 * root still on its old branch) if the second call never landed (tab closed, network blip), the
 * exact failure mode `stopSiblingAndResume` below was already written to avoid for a similar
 * reason. The branch itself is never deleted, so if the checkout fails after the worktree is
 * already gone, the error says so explicitly — the branch's commits are safe, the checkout just
 * needs finishing by hand. Returns the branch root was on before the switch (null for a detached
 * HEAD) alongside the one it's on now, so the caller can show a breadcrumb back — root switches
 * silently otherwise, and nothing else records what it used to be on.
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

  const resolvedRepoRoot = path.resolve(repoRoot);
  const entriesBefore = await listWorktrees(repoRoot);
  const previousRootBranch =
    entriesBefore.find((e) => path.resolve(e.path) === resolvedRepoRoot)?.branch ?? null;

  const branch = await removeWorktreeKeepBranch(cwd);
  if (!branch) {
    throw new Error("Could not determine the worktree's branch before removing it.");
  }

  try {
    await checkoutExistingBranch(repoRoot, branch);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `The worktree was removed, but "git checkout ${branch}" failed in ${repoRoot}: ${message} ` +
        `The branch's commits are safe — finish the checkout by hand from a terminal in ${repoRoot}.`,
      { cause: err },
    );
  }

  return { previousRootBranch, newBranch: branch };
}

/**
 * The alternative to creating a worktree when `id`'s project directory is already busy: end
 * `siblingSessionId`'s terminal process, check out `branch` in the (now free) shared directory,
 * and resume `id` there. Deliberately not exposed as three separate calls the frontend
 * orchestrates itself — a partial failure between "kill" and "resume" would leave the directory
 * on the wrong branch with nothing running in it, which is easier to reason about as one
 * operation's failure than three.
 *
 * SIGTERM first (a graceful "please exit" a well-behaved CLI can catch and clean up after,
 * releasing its worktree/session-file state); escalates to SIGKILL only if it's still alive after
 * a few seconds. Either way, this can discard unsaved state in whatever that other terminal was
 * doing — the confirmation this is gated behind client-side needs to say so plainly.
 */
export async function stopSiblingAndResume(
  id: string,
  siblingSessionId: string,
  requestedBranch: string,
): Promise<void> {
  if (!isSafeSessionId(id)) throw invalidSessionIdError(id);
  if (!isSafeSessionId(siblingSessionId)) throw invalidSessionIdError(siblingSessionId);
  const branch = requestedBranch.trim();
  if (!branch) {
    throw new Error("A branch name is required to check out.");
  }

  const cwd = await findSessionCwd(id);
  if (!cwd) throw new SessionNotFoundError(id);
  if (!(await directoryExists(cwd))) {
    throw new Error(`This session's original directory no longer exists ("${cwd}").`);
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
  await continueSession(id);
}
