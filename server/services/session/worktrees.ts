import path from "node:path";
import type { TerminalLayout } from "../preferencesService.js";
import { readSessionRecap } from "../../utils/claudeProjects.js";
import { markWorktreeTrustAccepted } from "../../utils/claudeTrust.js";
import {
  getRepoRoot,
  isLinkedWorktree,
  removeWorktreeAndBranch,
  sanitizeWorktreeDirName,
} from "../../utils/git.js";
import { BadRequestError } from "../../utils/httpError.js";
import { forgetRepoBranch } from "../../utils/taskStore.js";
import {
  notAWorktreeSessionError,
  SessionActiveError,
  SessionNotFoundError,
  sessionDirectoryMissingError,
} from "./errors.js";
import { listSessions } from "./listing.js";
import { findSessionCwd, resolveMissingWorktreeRepoRoot } from "./lookup.js";
import { directoryExists, posixShellQuote } from "./shell.js";
import { launchInTerminal } from "./terminal.js";

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
