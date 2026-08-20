import path from "node:path";
import { directoryExists, launchInTerminal, listSessions, posixShellQuote } from "./sessionService.js";
import { getUserPreferences, saveUserPreferences } from "./preferencesService.js";
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

/** Includes one extra path segment (the parent folder's own name) in the label — a bare repo name
 *  alone can be ambiguous or context-free, e.g. several checkouts sharing one parent folder (a
 *  plain `~/git/` full of projects) or a parent folder that's itself one of the options too
 *  (`~/git` and `~/git/hg-led-mainsite` showing up as bare "git" and "hg-led-mainsite" gives no
 *  hint they're related). Always shown with a forward slash regardless of platform, since this is
 *  a display label, not a filesystem path — `path.join`'s OS-specific separator would look
 *  inconsistent for the same reason. Falls back to the bare name when there's no meaningful
 *  parent segment (folderPath is already a filesystem root). */
function projectLabel(folderPath: string): string {
  const base = path.basename(folderPath);
  const parentBase = path.basename(path.dirname(folderPath));
  return parentBase ? `${parentBase}/${base}` : base;
}

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
 * The "new task" form's project select — reads *only* `userPreferences.json`'s
 * `recentProjectPaths` (see `recordUsedProjectPath` below), filtered to still-existing
 * directories. Deliberately does not touch `listSessions()`/git at all: this is called every time
 * the modal opens, and `recentProjectPaths` is kept up to date on every successful "new task"
 * launch — including a repo that has no session/`.jsonl` of its own yet, right after this app
 * just created its worktree — so there's nothing this function needs to (re-)derive from
 * sessions. `getKnownProjectFolders` below is the slower, exhaustive version — used by the
 * Cleanup scan, which does need every project this app has ever seen a session in, not just the
 * ones used via "new task".
 */
export async function getRecentProjectFolders(): Promise<ProjectFolderOption[]> {
  const preferences = await getUserPreferences();
  const existing = await Promise.all(
    preferences.recentProjectPaths.map(async (p) => ((await directoryExists(p)) ? p : null)),
  );
  return existing
    .filter((p): p is string => p !== null)
    .map((folderPath) => ({ path: folderPath, label: projectLabel(folderPath) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Every project folder this app has ever seen a session in — derived from existing sessions' own
 * working directories (there's no independent registry of project folders, see CLAUDE.md), deduped
 * by repo root rather than raw directory so a worktree-backed session collapses onto the same
 * option as its main checkout instead of appearing as a separate entry. The label always comes
 * from the repo root's own directory name (plus one parent segment, see `projectLabel`), never
 * `session.project` — that field is just `path.basename(workingDirectory)` (see `resolveProject`
 * in sessionService.ts), so for a worktree-backed session it'd be the worktree/branch name (e.g.
 * `fix-PROJ-123`) rather than the repo's name.
 *
 * This is the slow, exhaustive path (a `listSessions()` scan plus one `git rev-parse` per unique
 * working directory) — only used by the Cleanup scan, which needs the full picture regardless of
 * "new task" history. The "new task" modal's own dropdown uses `getRecentProjectFolders` above
 * instead, precisely to avoid paying this cost every time it's opened.
 */
export async function getKnownProjectFolders(): Promise<ProjectFolderOption[]> {
  const [sessions, preferences] = await Promise.all([listSessions(), getUserPreferences()]);
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

  // Folds in repo roots used via "new task" before (see `recordUsedProjectPath`), so a repo shows
  // up here even before it has a session/`.jsonl` of its own — e.g. right after this app just
  // created its worktree but the CLI hasn't written the first transcript line yet. Filtered to
  // still-existing directories so a since-deleted project doesn't linger as a dead option.
  const recentExisting = await Promise.all(
    preferences.recentProjectPaths.map(async (p) => ((await directoryExists(p)) ? p : null)),
  );
  recentExisting.forEach((p) => {
    if (p) options.add(p);
  });

  return [...options]
    .map((folderPath) => ({ path: folderPath, label: projectLabel(folderPath) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

const MAX_RECENT_PROJECT_PATHS = 20;

/**
 * Best-effort remembers `repoRoot` as used, most-recent first — called from `launchTaskTerminal`
 * right after a successful launch. Never throws: a failure here (disk full, malformed existing
 * file) must not undo/fail the task that was just actually created, same reasoning as the
 * `branchTypes` auto-remember in `NewTaskModal.tsx`.
 */
async function recordUsedProjectPath(repoRoot: string): Promise<void> {
  try {
    const preferences = await getUserPreferences();
    const withoutRepoRoot = preferences.recentProjectPaths.filter((p) => p !== repoRoot);
    const recentProjectPaths = [repoRoot, ...withoutRepoRoot].slice(0, MAX_RECENT_PROJECT_PATHS);
    await saveUserPreferences({ ...preferences, recentProjectPaths });
  } catch {
    // Best-effort — the project folder just won't be pre-offered as quickly next time.
  }
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
 *
 * `repoRoot` (from the earlier `getRepoInfo` step) is only used to remember the project folder
 * for next time (`recordUsedProjectPath`, best-effort, after a successful launch) — passing "" is
 * fine and just skips that, since it's a UX nice-to-have, not something the launch itself needs.
 */
export async function launchTaskTerminal(
  worktreePath: string,
  prompt: string,
  permissionModeAuto: boolean,
  repoRoot: string,
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

  const trimmedRepoRoot = repoRoot.trim();
  if (trimmedRepoRoot) {
    await recordUsedProjectPath(trimmedRepoRoot);
  }
}
