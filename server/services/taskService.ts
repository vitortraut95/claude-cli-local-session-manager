import path from "node:path";
import { directoryExists, launchInTerminal, listSessions, posixShellQuote } from "./sessionService.js";
import { markWorktreeTrustAccepted } from "../utils/claudeTrust.js";
import {
  branchExists,
  checkoutNewBranch,
  createWorktreeWithBranch,
  getDefaultBaseBranch,
  getRepoRoot,
  resolveBaseBranchRef,
  sanitizeWorktreeDirName,
} from "../utils/git.js";
import { AppError } from "../utils/httpError.js";

export type ProjectFolderOption = {
  path: string;
  label: string;
};

// Shared by every "new task" step below — the same three checks (folder given, folder exists,
// folder's actually a git repo) repeat across getRepoInfo/resolveBaseBranch/createTaskWorktree.
function folderRequiredError(): AppError {
  return new AppError("TASK_FOLDER_REQUIRED", "A project folder is required.");
}
function folderNotFoundError(folder: string): AppError {
  return new AppError("TASK_FOLDER_NOT_FOUND", `Folder "${folder}" does not exist.`);
}
function notGitRepoError(folder: string): AppError {
  return new AppError("TASK_NOT_GIT_REPO", `"${folder}" is not inside a git repository.`);
}

/**
 * Folder choices for the "new task" form's project select — derived from existing sessions' own
 * working directories (there's no independent registry of project folders, see CLAUDE.md), deduped
 * by repo root rather than raw directory so a worktree-backed session collapses onto the same
 * option as its main checkout instead of appearing as a separate entry. The label always comes
 * from the repo root's own directory name, never `session.project` — that field is just
 * `path.basename(workingDirectory)` (see `resolveProject` in sessionService.ts), so for a
 * worktree-backed session it'd be the worktree/branch name (e.g. `fix-PROJ-123`) rather than the
 * repo's name.
 */
export async function getKnownProjectFolders(): Promise<ProjectFolderOption[]> {
  const sessions = await listSessions();
  const uniqueDirs = [
    ...new Set(sessions.map((s) => s.workingDirectory).filter((d): d is string => d !== null)),
  ];

  const roots = await Promise.all(uniqueDirs.map((dir) => getRepoRoot(dir)));

  const options = new Set<string>();
  uniqueDirs.forEach((dir, i) => {
    if (roots[i]) {
      options.add(roots[i]);
      return;
    }
    // getRepoRoot shells out to `git rev-parse` in `dir` — fails for a worktree directory that no
    // longer exists on disk (orphaned after "Worktree → root" checkout, see
    // missingWorktreeRepoRoot). Fall back to the repo root already derived from the session's own
    // recorded cwd there instead of adding the dead worktree path itself as a "project".
    const missingRoot = sessions.find(
      (s) => s.workingDirectory === dir,
    )?.missingWorktreeRepoRoot;
    options.add(missingRoot ?? dir);
  });

  return [...options]
    .map((folderPath) => ({ path: folderPath, label: path.basename(folderPath) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export type RepoInfo = {
  repoRoot: string;
  defaultBaseBranch: string;
};

/** Used by the "new task" form to prefill the source-branch field once a folder is chosen/typed. */
export async function getRepoInfo(folderPath: string): Promise<RepoInfo> {
  const trimmed = folderPath.trim();
  if (!trimmed) throw folderRequiredError();
  if (!(await directoryExists(trimmed))) {
    throw folderNotFoundError(trimmed);
  }

  const repoRoot = await getRepoRoot(trimmed);
  if (!repoRoot) throw notGitRepoError(trimmed);

  const defaultBaseBranch = await getDefaultBaseBranch(repoRoot);
  return { repoRoot, defaultBaseBranch };
}

/** Only letters/digits/`-`/`_`/`.`/`/`, and must start with a letter or digit — same spirit as
 *  git's own branch-name rules, just narrower; rejects a leading `-` in particular since that could
 *  otherwise be read as a git flag once interpolated into an argv position. */
const SAFE_BRANCH_NAME = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

/**
 * The "new task" flow is split into separate steps (this, `createTaskWorktree`,
 * `launchTaskTerminal` — plus `getRepoInfo` above) rather than one function, so the client can
 * show live per-step progress and know exactly which step failed (this app used to run the whole
 * thing as one opaque call; see CLAUDE.md's Warp TOML-escaping incident for why "which step failed"
 * turned out to matter). Resolves the actual starting commit for the new branch — see
 * `resolveBaseBranchRef` for why this prefers a freshly fetched `origin/<baseBranch>`.
 */
export async function resolveBaseBranch(
  folderPath: string,
  baseBranch: string,
): Promise<{ baseBranchRef: string }> {
  const trimmedFolder = folderPath.trim();
  const trimmedBase = baseBranch.trim();
  if (!trimmedFolder) throw folderRequiredError();
  if (!trimmedBase) throw new AppError("TASK_BASE_BRANCH_REQUIRED", "A source branch is required.");

  const repoRoot = await getRepoRoot(trimmedFolder);
  if (!repoRoot) throw notGitRepoError(trimmedFolder);

  const baseBranchRef = await resolveBaseBranchRef(repoRoot, trimmedBase);
  return { baseBranchRef };
}

/**
 * Creates a new linked worktree at `<repoRoot>/.claude/worktrees/<branchName>` on a fresh branch
 * (custom name + custom base branch — unlike `createSessionWorktree`'s CLI-delegated
 * `worktree-<name>` naming). Uses a worktree (rather than checking out the branch directly in
 * `folderPath`) so starting a new task never collides with whatever session might already be
 * active in that folder. `baseBranchRef` comes from `resolveBaseBranch` above (a separate step),
 * not re-resolved here.
 *
 * `useWorktree` is the escape hatch behind the modal's "no worktree" checkbox (default off, so the
 * collision-free worktree path stays the default): when false, this instead checks out the new
 * branch directly in `folderPath` via `checkoutNewBranch`, and the returned "worktreePath" is just
 * `repoRoot` — the caller only ever uses it as "where to open the terminal", so no separate field
 * is needed for the two cases.
 */
export async function createTaskWorktree(
  folderPath: string,
  branchName: string,
  baseBranchRef: string,
  useWorktree: boolean,
): Promise<{ worktreePath: string }> {
  const trimmedFolder = folderPath.trim();
  const trimmedBranch = branchName.trim();
  const trimmedRef = baseBranchRef.trim();

  if (!trimmedFolder) throw folderRequiredError();
  if (!trimmedBranch) throw new AppError("TASK_BRANCH_NAME_REQUIRED", "A branch name is required.");
  if (!SAFE_BRANCH_NAME.test(trimmedBranch)) {
    throw new AppError(
      "TASK_INVALID_BRANCH_NAME",
      `"${trimmedBranch}" isn't a valid branch name (letters, numbers, "-", "_", "." and "/" ` +
        `only, must start with a letter or number).`,
    );
  }
  if (!trimmedRef) throw new AppError("TASK_BASE_BRANCH_REF_REQUIRED", "A resolved base branch is required.");

  if (!(await directoryExists(trimmedFolder))) {
    throw folderNotFoundError(trimmedFolder);
  }
  const repoRoot = await getRepoRoot(trimmedFolder);
  if (!repoRoot) throw notGitRepoError(trimmedFolder);

  if (await branchExists(repoRoot, trimmedBranch)) {
    throw new AppError("TASK_BRANCH_EXISTS", `Branch "${trimmedBranch}" already exists.`);
  }

  if (!useWorktree) {
    await checkoutNewBranch(repoRoot, trimmedBranch, trimmedRef);
    return { worktreePath: repoRoot };
  }

  const worktreeDirName = sanitizeWorktreeDirName(trimmedBranch);
  const worktreePath = path.join(repoRoot, ".claude", "worktrees", worktreeDirName);

  // Guards against reusing an existing worktree's name/folder even when its branch was already
  // deleted (or never existed) — the `branchExists` check above wouldn't catch that case, and
  // `git worktree add` would otherwise fail with a much less clear "already exists" error.
  if (await directoryExists(worktreePath)) {
    throw new AppError("TASK_WORKTREE_EXISTS", `A worktree named "${worktreeDirName}" already exists.`);
  }

  await createWorktreeWithBranch(repoRoot, worktreePath, trimmedBranch, trimmedRef);
  // Best-effort, non-blocking — see markWorktreeTrustAccepted's own doc comment for why this
  // specific directory is safe to pre-trust and what silently fails without it.
  await markWorktreeTrustAccepted(worktreePath);
  return { worktreePath };
}

/**
 * Opens a terminal in `worktreePath` running `claude <prompt>` — passing the composed prompt as a
 * positional argument starts an interactive session with it already sent as the first message, so
 * no temp file or stdin piping is needed. The final step of the "new task" flow.
 *
 * `permissionModeAuto` appends the CLI's own `--permission-mode auto` flag — the modal's
 * checkbox for reducing how often the launched session stops to ask for a permission approval.
 * Relevant specifically for this app's own terminal-launching flows: a backgrounded/unfocused
 * terminal window (Wayland blocks this app from stealing focus for one it spawns, see CLAUDE.md)
 * can't be answered until the user happens to notice it, so a session that never needs to ask
 * doesn't get stuck waiting on a prompt nobody saw.
 */
export async function launchTaskTerminal(
  worktreePath: string,
  prompt: string,
  permissionModeAuto: boolean,
): Promise<void> {
  const trimmedWorktreePath = worktreePath.trim();
  const trimmedPrompt = prompt.trim();
  if (!trimmedWorktreePath) throw new AppError("TASK_WORKTREE_PATH_REQUIRED", "A worktree path is required.");
  if (!trimmedPrompt) throw new AppError("TASK_PROMPT_REQUIRED", "A prompt is required to start Claude.");

  const permissionFlag = permissionModeAuto ? "--permission-mode auto " : "";
  await launchInTerminal(
    `claude ${permissionFlag}${posixShellQuote(trimmedPrompt)}`,
    trimmedWorktreePath,
  );
}
