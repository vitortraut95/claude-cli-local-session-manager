import path from "node:path";
import {
  findJsonlFiles,
  getClaudeProjectsDir,
  readSessionHead,
  type SessionHead,
} from "../../utils/claudeProjects.js";
import { AppError } from "../../utils/httpError.js";
import { SessionNotFoundError } from "./errors.js";
import { directoryExists } from "./shell.js";

/** Worktrees live at `<repoRoot>/.claude/worktrees/<name>`; once one is gone, splitting the
 *  recorded `cwd` is the only way left to recover its repo root. */
const WORKTREE_PATH_SEGMENT = "/.claude/worktrees/";

export function repoRootFromMissingWorktreePath(cwd: string): string | null {
  const index = cwd.indexOf(WORKTREE_PATH_SEGMENT);
  return index === -1 ? null : cwd.slice(0, index);
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
export async function findSessionCwd(id: string): Promise<string | null> {
  const filePath = await findSessionFilePath(id);
  if (!filePath) return null;
  const head = await readSessionHead(filePath);
  return head.cwd;
}

/** Repo root of an orphaned worktree session, derived from its recorded `cwd` (the worktree is
 *  gone, so git can't tell); must still exist. */
export async function resolveMissingWorktreeRepoRoot(
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
