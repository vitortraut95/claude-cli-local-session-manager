import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  directoryExists,
  launchInTerminal,
  listSessions,
  posixShellQuote,
} from "./sessionService.js";
import { getUserPreferences, updateUserPreferences } from "./preferencesService.js";
import { getUserSkillsDir } from "./skillsHubService.js";
import { expandHome, findReposIn } from "./workspaceService.js";
import { prepareWorktreeBestEffort, type WorktreeSetupResult } from "./worktreeSetupService.js";
import { markWorktreeTrustAccepted } from "../utils/claudeTrust.js";
import {
  branchExists,
  checkoutNewBranch,
  createWorktreeWithBranch,
  getDefaultBaseBranch,
  getRepoRoot,
  getWorktreeBranch,
  resolveBaseBranchRef,
  sanitizeWorktreeDirName,
} from "../utils/git.js";
import { AppError, BadRequestError, ConflictError } from "../utils/httpError.js";
import {
  linkRepoBranchToTask,
  recordTaskBaseBranch,
  setNickname,
  setSessionBranchOverride,
  upsertTask,
} from "../utils/taskStore.js";

export type ProjectFolderOption = {
  path: string;
  label: string;
  /** In `recentProjectPaths` (vs. only found in a workspace dir). Only set by
   *  `getRecentProjectFolders`. */
  recent?: boolean;
};

/** `<parent>/<name>` display label (a bare repo name can be ambiguous); just the name when there's
 *  no parent segment. */
function projectLabel(folderPath: string): string {
  const base = path.basename(folderPath);
  const parentBase = path.basename(path.dirname(folderPath));
  return parentBase ? `${parentBase}/${base}` : base;
}

// Folder given, exists, and is a git repo — shared by the "new task" steps below.
function folderRequiredError(): AppError {
  return new BadRequestError("TASK_FOLDER_REQUIRED", "A project folder is required.");
}
function folderNotFoundError(folder: string): AppError {
  return new AppError("TASK_FOLDER_NOT_FOUND", `Folder "${folder}" does not exist.`);
}
function notGitRepoError(folder: string): AppError {
  return new AppError("TASK_NOT_GIT_REPO", `"${folder}" is not inside a git repository.`);
}

/**
 * The "new task" project select: `recentProjectPaths` (flagged `recent`) plus every workspace repo,
 * filtered to existing directories. Cheap (no `listSessions()`/git), since it runs on every open.
 */
export async function getRecentProjectFolders(): Promise<ProjectFolderOption[]> {
  const preferences = await getUserPreferences();
  const [existing, workspaceRepos] = await Promise.all([
    Promise.all(
      preferences.recentProjectPaths.map(async (p) => ((await directoryExists(p)) ? p : null)),
    ),
    Promise.all((preferences.workspaceDirs ?? []).map((dir) => findReposIn(expandHome(dir)))),
  ]);
  const recent = existing.filter((p): p is string => p !== null);
  const recentSet = new Set(recent.map((p) => path.resolve(p)));
  const others = [...new Set(workspaceRepos.flat())].filter((p) => !recentSet.has(path.resolve(p)));
  const byLabel = (a: ProjectFolderOption, b: ProjectFolderOption) =>
    a.label.localeCompare(b.label);
  return [
    ...recent
      .map((folderPath) => ({ path: folderPath, label: projectLabel(folderPath), recent: true }))
      .sort(byLabel),
    ...others
      .map((folderPath) => ({ path: folderPath, label: projectLabel(folderPath), recent: false }))
      .sort(byLabel),
  ];
}

/**
 * Every project folder any session ran in, deduped by repo root (so a worktree session collapses
 * onto its main checkout), plus `recentProjectPaths`. Slow (full `listSessions()` scan + a git call
 * per directory).
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
    // getRepoRoot fails for a worktree directory that's gone from disk: fall back to the repo root
    // derived from the session's recorded cwd rather than listing the dead path.
    const missingRoot = sessions.find((s) => s.workingDirectory === dir)?.missingWorktreeRepoRoot;
    options.add(missingRoot ?? dir);
  });

  // Repos used via "new task" show up even before they have a transcript of their own.
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

/** Best-effort remembers `repoRoot` as used, most-recent first. Never throws: the task was already
 *  created. */
async function recordUsedProjectPath(repoRoot: string): Promise<void> {
  try {
    await updateUserPreferences((preferences) => {
      const withoutRepoRoot = preferences.recentProjectPaths.filter((p) => p !== repoRoot);
      const recentProjectPaths = [repoRoot, ...withoutRepoRoot].slice(0, MAX_RECENT_PROJECT_PATHS);
      return { ...preferences, recentProjectPaths };
    });
  } catch {
    // Best-effort.
  }
}

export type RepoInfo = {
  repoRoot: string;
  defaultBaseBranch: string;
  /** A session is active with its working directory exactly at `repoRoot` (not a worktree) — the
   *  one case where checking the branch out in the root would collide. Drives the worktree
   *  checkbox's default. */
  hasActiveSessionInRoot: boolean;
};

/** Prefills the "new task" source-branch field and the worktree checkbox's default. */
export async function getRepoInfo(folderPath: string): Promise<RepoInfo> {
  const trimmed = folderPath.trim();
  if (!trimmed) throw folderRequiredError();
  if (!(await directoryExists(trimmed))) {
    throw folderNotFoundError(trimmed);
  }

  const repoRoot = await getRepoRoot(trimmed);
  if (!repoRoot) throw notGitRepoError(trimmed);

  const [defaultBaseBranch, sessions] = await Promise.all([
    getDefaultBaseBranch(repoRoot),
    listSessions(),
  ]);
  const hasActiveSessionInRoot = sessions.some(
    (s) => s.workingDirectory === repoRoot && s.isActive,
  );
  return { repoRoot, defaultBaseBranch, hasActiveSessionInRoot };
}

/** Narrower than git's branch-name rules; a leading `-` is rejected since git would read it as a
 *  flag. */
const SAFE_BRANCH_NAME = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

/** "New task" step: resolves the new branch's starting ref — a freshly fetched
 *  `origin/<baseBranch>` unless `useLocalBranch`. */
export async function resolveBaseBranch(
  folderPath: string,
  baseBranch: string,
  useLocalBranch = false,
): Promise<{ baseBranchRef: string }> {
  const trimmedFolder = folderPath.trim();
  const trimmedBase = baseBranch.trim();
  if (!trimmedFolder) throw folderRequiredError();
  if (!trimmedBase)
    throw new BadRequestError("TASK_BASE_BRANCH_REQUIRED", "A source branch is required.");

  const repoRoot = await getRepoRoot(trimmedFolder);
  if (!repoRoot) throw notGitRepoError(trimmedFolder);

  const baseBranchRef = await resolveBaseBranchRef(repoRoot, trimmedBase, useLocalBranch);
  return { baseBranchRef };
}

/** Best-effort: records `baseBranch` against `(repoRoot, branchName)` for "Open PR", only when it
 *  differs from the repo's default. Never throws. */
async function recordTaskBaseBranchIfNonDefault(
  repoRoot: string,
  branchName: string,
  baseBranch: string,
): Promise<void> {
  try {
    const trimmedBase = baseBranch.trim();
    if (!trimmedBase) return;
    const defaultBase = await getDefaultBaseBranch(repoRoot);
    if (trimmedBase === defaultBase) return;
    await recordTaskBaseBranch(repoRoot, branchName, trimmedBase);
  } catch {
    // Best-effort.
  }
}

/**
 * Creates the task branch off `baseBranchRef` in a new worktree at
 * `<repoRoot>/.claude/worktrees/<branchName>`, or — when `useWorktree` is false — checks it out
 * directly in the repo root (then `worktreePath` is `repoRoot`). `baseBranch` is the raw typed
 * name, used only for recording. `taskKey` (normalized) links the branch to that task,
 * best-effort. A new worktree also gets the repo's `worktreeSetup` (linked `node_modules`, copied
 * `.env*`), reported in `setup`.
 */
export async function createTaskWorktree(
  folderPath: string,
  branchName: string,
  baseBranchRef: string,
  baseBranch: string,
  useWorktree: boolean,
  taskKey: string | null = null,
  taskLink: string | null = null,
): Promise<{ worktreePath: string; repoRoot: string; setup: WorktreeSetupResult }> {
  const trimmedFolder = folderPath.trim();
  const trimmedBranch = branchName.trim();
  const trimmedRef = baseBranchRef.trim();

  if (!trimmedFolder) throw folderRequiredError();
  if (!trimmedBranch)
    throw new BadRequestError("TASK_BRANCH_NAME_REQUIRED", "A branch name is required.");
  if (!SAFE_BRANCH_NAME.test(trimmedBranch)) {
    throw new BadRequestError(
      "TASK_INVALID_BRANCH_NAME",
      `"${trimmedBranch}" isn't a valid branch name (letters, numbers, "-", "_", "." and "/" ` +
        `only, must start with a letter or number).`,
    );
  }
  if (!trimmedRef)
    throw new BadRequestError(
      "TASK_BASE_BRANCH_REF_REQUIRED",
      "A resolved base branch is required.",
    );

  if (!(await directoryExists(trimmedFolder))) {
    throw folderNotFoundError(trimmedFolder);
  }
  const repoRoot = await getRepoRoot(trimmedFolder);
  if (!repoRoot) throw notGitRepoError(trimmedFolder);

  if (await branchExists(repoRoot, trimmedBranch)) {
    throw new ConflictError("TASK_BRANCH_EXISTS", `Branch "${trimmedBranch}" already exists.`);
  }

  if (!useWorktree) {
    await checkoutNewBranch(repoRoot, trimmedBranch, trimmedRef);
    await recordTaskBaseBranchIfNonDefault(repoRoot, trimmedBranch, baseBranch);
    await linkBranchToTaskBestEffort(repoRoot, trimmedBranch, null, taskKey, taskLink);
    return { worktreePath: repoRoot, repoRoot, setup: { linked: [], copied: [] } };
  }

  const worktreeDirName = sanitizeWorktreeDirName(trimmedBranch);
  const worktreePath = path.join(repoRoot, ".claude", "worktrees", worktreeDirName);

  // The folder can be occupied even when `branchExists` found nothing: by a worktree whose branch
  // was deleted, or by a different branch whose name sanitizes to the same folder name
  // ("feature/PROJ-123" vs "feature-PROJ-123").
  if (await directoryExists(worktreePath)) {
    const occupyingBranch = await getWorktreeBranch(worktreePath, repoRoot);
    const message =
      occupyingBranch && occupyingBranch !== trimmedBranch
        ? `The worktree folder for "${worktreeDirName}" is already in use by a different branch ` +
          `("${occupyingBranch}") — its name sanitizes to the same folder name. Rename this ` +
          `branch, or remove that worktree first.`
        : `A worktree named "${worktreeDirName}" already exists.`;
    throw new ConflictError("TASK_WORKTREE_EXISTS", message);
  }

  await createWorktreeWithBranch(repoRoot, worktreePath, trimmedBranch, trimmedRef);
  // Without pre-accepted trust, `claude` in this new directory fails with no way to detect it.
  await markWorktreeTrustAccepted(worktreePath);
  const setup = await prepareWorktreeBestEffort(repoRoot, worktreePath);
  await recordTaskBaseBranchIfNonDefault(repoRoot, trimmedBranch, baseBranch);
  await linkBranchToTaskBestEffort(repoRoot, trimmedBranch, worktreePath, taskKey, taskLink);
  return { worktreePath, repoRoot, setup };
}

async function linkBranchToTaskBestEffort(
  repoRoot: string,
  branchName: string,
  worktreePath: string | null,
  taskKey: string | null,
  taskLink: string | null,
): Promise<void> {
  if (!taskKey) return;
  try {
    await upsertTask(taskKey, taskLink);
    await linkRepoBranchToTask(repoRoot, branchName, taskKey, worktreePath);
  } catch {
    // Best-effort: never fails the git work that already happened.
  }
}

/**
 * Opens a terminal in `worktreePath` running `claude <prompt>` (a positional prompt is sent as the
 * first message; blank = plain interactive `claude`). `repoRoot` is only remembered for next time
 * ("" skips that).
 *
 * When `nickname` or `originBranch`/`destinationBranch` is given, a `--session-id` is
 * pre-generated and they're recorded in `tasks.json` before the terminal opens — there's no other
 * way to learn the new session's id. Returns that id, or null when none was needed.
 */
type LaunchTaskOptions = {
  worktreePath: string;
  prompt: string;
  permissionModeAuto: boolean;
  repoRoot: string;
  nickname?: string;
  originBranch?: string;
  destinationBranch?: string;
  /** Other folders the session gets tool access to (`--add-dir`); each must exist. */
  addDirs?: string[];
};

export async function launchTaskTerminal({
  worktreePath,
  prompt,
  permissionModeAuto,
  repoRoot,
  nickname = "",
  originBranch = "",
  destinationBranch = "",
  addDirs = [],
}: LaunchTaskOptions): Promise<{ sessionId: string | null }> {
  const trimmedWorktreePath = worktreePath.trim();
  const trimmedPrompt = prompt.trim();
  if (!trimmedWorktreePath)
    throw new BadRequestError("TASK_WORKTREE_PATH_REQUIRED", "A worktree path is required.");

  const trimmedNickname = nickname.trim();
  let sessionIdFlag = "";
  let newSessionId: string | null = null;
  const hasBranches = Boolean(originBranch.trim() || destinationBranch.trim());
  if (trimmedNickname || hasBranches) {
    newSessionId = randomUUID();
    if (trimmedNickname) await setNickname(newSessionId, trimmedNickname);
    if (hasBranches) await setSessionBranchOverride(newSessionId, originBranch, destinationBranch);
    sessionIdFlag = `--session-id ${newSessionId} `;
  }

  const permissionFlag = permissionModeAuto ? "--permission-mode auto " : "";
  // A blank prompt (the "New session" modal allows one) just opens an interactive session.
  const promptArg = trimmedPrompt ? posixShellQuote(trimmedPrompt) : "";
  const dirs = addDirs.map((dir) => dir.trim()).filter(Boolean);
  for (const dir of dirs) {
    if (!(await directoryExists(dir))) throw folderNotFoundError(dir);
  }
  // After the prompt: `--add-dir` is variadic and would swallow a following prompt as a directory.
  const addDirArgs = dirs.length > 0 ? ` --add-dir ${dirs.map(posixShellQuote).join(" ")}` : "";
  await launchInTerminal(
    `claude ${sessionIdFlag}${permissionFlag}${promptArg}`.trimEnd() + addDirArgs,
    trimmedWorktreePath,
  );

  const trimmedRepoRoot = repoRoot.trim();
  if (trimmedRepoRoot) {
    await recordUsedProjectPath(trimmedRepoRoot);
  }
  return { sessionId: newSessionId };
}

/** A skill folder name as `/<name>` takes it — also keeps it from smuggling anything into the
 *  shell command or out of the skills folder. */
const SKILL_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

/** "Test task": opens a terminal in the first existing workspace dir (else `~`) running
 *  `claude "/<taskTestSkill> <ticket link>"`. The skill finds the project itself and only reads. */
export async function launchTaskTest(
  ticketLink: string,
  permissionModeAuto: boolean,
  nickname = "",
): Promise<void> {
  const link = ticketLink.trim();
  if (!link) throw new BadRequestError("TASK_TEST_LINK_REQUIRED", "A ticket link is required.");

  const prefs = await getUserPreferences();
  const skill = prefs.taskTestSkill.trim();
  if (!skill || !SKILL_NAME_PATTERN.test(skill)) {
    throw new AppError("TASK_TEST_SKILL_NOT_CONFIGURED", "No task test skill is configured.");
  }
  try {
    await stat(path.join(getUserSkillsDir(), skill, "SKILL.md"));
  } catch (err) {
    throw new AppError(
      "TASK_TEST_SKILL_NOT_INSTALLED",
      `The task test skill "${skill}" isn't installed in ${getUserSkillsDir()}.`,
      { cause: err },
    );
  }

  let cwd = os.homedir();
  for (const dir of prefs.workspaceDirs ?? []) {
    const expanded = expandHome(dir);
    if (await directoryExists(expanded)) {
      cwd = expanded;
      break;
    }
  }

  await launchTaskTerminal({
    worktreePath: cwd,
    prompt: `/${skill} ${link}`,
    permissionModeAuto,
    repoRoot: "",
    nickname,
  });
}
