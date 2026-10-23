import axios from "axios";
import type { TranslationKey } from "../i18n/translations";

type ErrorResponseBody = { error?: unknown; code?: unknown };

/** An `Error` re-thrown by `withServerErrorMessage`, with the server's `AppError` code if sent. */
export type ApiError = Error & { code?: string };

/** Re-throws with the server's own error message (and `code`) instead of axios's generic
 *  "Request failed with status code ...". */
export async function withServerErrorMessage<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (err) {
    if (
      axios.isAxiosError<ErrorResponseBody>(err) &&
      typeof err.response?.data?.error === "string"
    ) {
      const code = typeof err.response.data.code === "string" ? err.response.data.code : undefined;
      const apiError: ApiError = new Error(err.response.data.error, { cause: err });
      if (code) apiError.code = code;
      throw apiError;
    }
    throw err;
  }
}

/** Server `AppError` code → translation key. An unmapped code shows the server's English message. */
const SERVER_ERROR_CODE_KEYS: Partial<Record<string, TranslationKey>> = {
  SESSION_NOT_FOUND: "apiError.sessionNotFound",
  SESSION_ACTIVE: "apiError.sessionActive",
  INVALID_SESSION_ID: "apiError.invalidSessionId",
  TASK_FOLDER_REQUIRED: "apiError.taskFolderRequired",
  TASK_FOLDER_NOT_FOUND: "apiError.taskFolderNotFound",
  TASK_NOT_GIT_REPO: "apiError.taskNotGitRepo",
  TASK_BASE_BRANCH_REQUIRED: "apiError.taskBaseBranchRequired",
  TASK_BRANCH_NAME_REQUIRED: "apiError.taskBranchNameRequired",
  TASK_INVALID_BRANCH_NAME: "apiError.taskInvalidBranchName",
  TASK_BASE_BRANCH_REF_REQUIRED: "apiError.taskBaseBranchRefRequired",
  TASK_BRANCH_EXISTS: "apiError.taskBranchExists",
  TASK_WORKTREE_EXISTS: "apiError.taskWorktreeExists",
  TASK_WORKTREE_PATH_REQUIRED: "apiError.taskWorktreePathRequired",
  TASK_INVALID_KEY: "apiError.taskInvalidKey",
  LIMUX_NOT_INSTALLED: "apiError.limuxNotInstalled",
  LIMUX_UNSUPPORTED_ARCH: "apiError.limuxUnsupportedArch",
  // LIMUX_INSTALL_FAILED unmapped: its message carries the reason.
  TASK_REPO_NOT_FOUND: "apiError.taskRepoNotFound",
  TASK_TEST_LINK_REQUIRED: "apiError.taskTestLinkRequired",
  TASK_TEST_SKILL_NOT_CONFIGURED: "apiError.taskTestSkillNotConfigured",
  TASK_TEST_SKILL_NOT_INSTALLED: "apiError.taskTestSkillNotInstalled",
  MALFORMED_PREFERENCES: "apiError.malformedPreferences",
  SKILLS_HUB_NOT_FOUND: "apiError.skillsHubNotFound",
  SKILLS_HUB_REPO_URL_MISSING: "apiError.skillsHubRepoUrlMissing",
  SKILLS_HUB_INVALID_PATH: "apiError.skillsHubInvalidPath",
  SKILLS_HUB_CLONE_PARENT_MISSING: "apiError.skillsHubCloneParentMissing",
  SKILLS_HUB_CLONE_TARGET_EXISTS: "apiError.skillsHubCloneTargetExists",
  SKILLS_DIR_UNWRITABLE: "apiError.skillsDirUnwritable",
  SKILL_NOT_FOUND: "apiError.skillNotFound",
  SKILLS_FOLDER_OPEN_FAILED: "apiError.skillsFolderOpenFailed",
  PREVIEW_LIMIT: "apiError.previewLimit",
  // SKILLS_HUB_CLONE_FAILED unmapped: its message carries git's stderr, the useful part.
  USAGE_NO_CREDENTIALS: "apiError.usageNoCredentials",
  USAGE_CREDENTIALS_UNREADABLE: "apiError.usageCredentialsUnreadable",
  USAGE_NO_TOKEN: "apiError.usageNoToken",
  USAGE_ENDPOINT_UNREACHABLE: "apiError.usageEndpointUnreachable",
  USAGE_TOKEN_EXPIRED: "apiError.usageTokenExpired",
  USAGE_FETCH_FAILED: "apiError.usageFetchFailed",
  USAGE_RATE_LIMITED: "apiError.usageRateLimited",
  UPDATE_ALREADY_RUNNING: "apiError.updateAlreadyRunning",
  UPDATE_FETCH_FAILED: "apiError.updateFetchFailed",
  UPDATE_UNEXPECTED_GIT_OUTPUT: "apiError.updateUnexpectedGitOutput",
  UPDATE_GIT_PULL_FAILED: "apiError.updateGitPullFailed",
  UPDATE_YARN_INSTALL_FAILED: "apiError.updateYarnInstallFailed",
  CLEANUP_MISSING_TARGET: "apiError.cleanupMissingTarget",
  CLEANUP_TARGET_GONE: "apiError.cleanupTargetGone",
  CLEANUP_BRANCH_NOT_MERGED: "apiError.cleanupBranchNotMerged",
  CLEANUP_UNCOMMITTED_CHANGES: "apiError.cleanupUncommittedChanges",
  CLEANUP_BRANCH_HAS_COMMITS: "apiError.cleanupBranchHasCommits",
  CLEANUP_WORKTREE_HAS_SESSION: "apiError.cleanupWorktreeHasSession",
  MALFORMED_CLEANUP_FINDING: "apiError.malformedCleanupFinding",
  TASK_BASE_BRANCH_NOT_FOUND: "apiError.taskBaseBranchNotFound",
  NOT_A_GIT_WORKTREE: "apiError.notAGitWorktree",
  WORKTREE_UNCOMMITTED_CHANGES: "apiError.worktreeUncommittedChanges",
  SESSION_NO_WORKING_DIRECTORY: "apiError.sessionNoWorkingDirectory",
  SESSION_DIRECTORY_MISSING: "apiError.sessionDirectoryMissing",
  DIRECTORY_MISSING: "apiError.directoryMissing",
  VSCODE_COMMAND_NOT_FOUND: "apiError.vscodeCommandNotFound",
  CURSOR_COMMAND_NOT_FOUND: "apiError.cursorCommandNotFound",
  NOT_APP_WORKTREE: "apiError.notAppWorktree",
  PROJECT_ROOT_MISSING: "apiError.projectRootMissing",
  TERMINAL_LAUNCH_FAILED: "apiError.terminalLaunchFailed",
  WORKTREE_NAME_REQUIRED: "apiError.worktreeNameRequired",
  NOT_A_WORKTREE_SESSION: "apiError.notAWorktreeSession",
  PROTECTED_BRANCH_DELETE_FORBIDDEN: "apiError.protectedBranchDeleteForbidden",
  IMPORT_INVALID_BUNDLE: "apiError.importInvalidBundle",
  IMPORT_UNSUPPORTED_VERSION: "apiError.importUnsupportedVersion",
  IMPORT_TARGET_REQUIRED: "apiError.importTargetRequired",
  IMPORT_TARGET_MISSING: "apiError.importTargetMissing",
  IMPORT_CHECKOUT_BLOCKED_ACTIVE: "apiError.importCheckoutBlockedActive",
  IMPORT_SESSION_EXISTS: "apiError.importSessionExists",
  IMPORT_OVERWRITE_ACTIVE: "apiError.importOverwriteActive",
  MALFORMED_PREFERENCES_FILE: "apiError.malformedPreferencesFile",
  TASK_SESSION_HAS_NO_BRANCH: "apiError.taskSessionHasNoBranch",
  // IMPORT_CHECKOUT_FAILED unmapped: their messages carry git's reason.
};

/**
 * User-facing message for a caught API error: the translation of its server `code` if mapped,
 * else the error's message, else `fallbackKey` for a non-`Error` throw.
 */
export function resolveApiErrorMessage(
  err: unknown,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
  fallbackKey: TranslationKey,
): string {
  if (err instanceof Error) {
    const code = (err as ApiError).code;
    const key = code ? SERVER_ERROR_CODE_KEYS[code] : undefined;
    return key ? t(key) : err.message;
  }
  return t(fallbackKey);
}
