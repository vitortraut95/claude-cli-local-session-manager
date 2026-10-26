import type { ResumeOpenResult, Session } from "../../../shared/session.js";
import { getUserPreferences, type TerminalLayout } from "../preferencesService.js";
import { focusLimuxSession, isLimuxAvailable } from "../limuxGridService.js";
import { runGit } from "../../utils/git.js";
import { recordEvent } from "../../utils/history.js";
import { AppError, errorMessage } from "../../utils/httpError.js";
import {
  findActiveSessionPid,
  getActiveResumeSessionIds,
  isProcessAlive,
  waitForProcessExit,
} from "./activeSessions.js";
import {
  branchNameRequiredError,
  invalidSessionIdError,
  SessionActiveError,
  SessionNotFoundError,
  sessionDirectoryMissingError,
} from "./errors.js";
import { listSessions } from "./listing.js";
import { findSessionCwd, isSafeSessionId } from "./lookup.js";
import { directoryExists } from "./shell.js";
import { launchInTerminal } from "./terminal.js";

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

/** Statuses "Resume open tasks" brings back: work left mid-way (not "to do": never started). */
const RESUMABLE_STATUSES = new Set(["in_progress", "waiting_user"]);

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
