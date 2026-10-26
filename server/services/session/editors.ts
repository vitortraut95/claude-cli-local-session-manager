import { AppError } from "../../utils/httpError.js";
import { findSessionCwd, resolveMissingWorktreeRepoRoot } from "./lookup.js";
import { directoryExists, trySpawnDetached } from "./shell.js";

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

/** Opens an orphaned worktree session's repo root in VS Code. */
export async function openMissingWorktreeRootInVSCode(id: string): Promise<void> {
  const { repoRoot } = await resolveMissingWorktreeRepoRoot(id);
  await openDirInVSCode(repoRoot);
}
