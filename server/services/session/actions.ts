import { unlink } from "node:fs/promises";
import { stopPreviewsIn } from "../previewService.js";
import { forgetCachedSession } from "../../utils/claudeProjects.js";
import { deleteLocalBranch, forceRemoveWorktree } from "../../utils/git.js";
import { AppError, BadRequestError } from "../../utils/httpError.js";
import {
  forgetRepoBranch,
  forgetSession,
  getTaskStore,
  setNickname,
  setSessionBranchOverride,
  setSessionStatus,
  type WorkStatus,
} from "../../utils/taskStore.js";
import { TEST_WORK_STATUSES } from "../../../shared/session.js";
import { getActiveResumeSessionIds } from "./activeSessions.js";
import {
  branchNameRequiredError,
  invalidSessionIdError,
  SessionActiveError,
  SessionNotFoundError,
  sessionDirectoryMissingError,
} from "./errors.js";
import { findSessionCwd, findSessionFilePath, isSafeSessionId } from "./lookup.js";
import { directoryExists } from "./shell.js";

/** Never deletable through "delete branch" (also hidden client-side in SessionsPage.tsx). */
const PROTECTED_BRANCHES = new Set(["main", "master"]);

function protectedBranchDeleteError(branch: string): AppError {
  return new AppError(
    "PROTECTED_BRANCH_DELETE_FORBIDDEN",
    `Refusing to delete "${branch}" — it looks like the repo's primary branch.`,
  );
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
 *  A test session is in progress, waiting (on someone else; its worktrees stay) or done; done +
 *  closed removes its worktrees (`cleanupFinishedTests`). */
export async function setSessionWorkStatus(id: string, status: WorkStatus | null): Promise<void> {
  if (!isSafeSessionId(id)) throw invalidSessionIdError(id);
  const isTest = Boolean((await getTaskStore()).sessions[id]?.test);
  if (isTest && (status === null || !TEST_WORK_STATUSES.includes(status))) {
    throw new BadRequestError(
      "TEST_STATUS_INVALID",
      'A test session is "in_progress", "waiting_user" or "done".',
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
