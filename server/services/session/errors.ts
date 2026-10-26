import { AppError, BadRequestError, ConflictError, NotFoundError } from "../../utils/httpError.js";

export class SessionNotFoundError extends NotFoundError {
  constructor(id: string) {
    super("SESSION_NOT_FOUND", `Session "${id}" not found`);
    this.name = "SessionNotFoundError";
  }
}

export class SessionActiveError extends ConflictError {
  constructor(message: string) {
    super("SESSION_ACTIVE", message);
    this.name = "SessionActiveError";
  }
}

export function invalidSessionIdError(id: string): AppError {
  return new BadRequestError("INVALID_SESSION_ID", `Invalid session id "${id}"`);
}

export function sessionDirectoryMissingError(cwd: string): AppError {
  return new AppError(
    "SESSION_DIRECTORY_MISSING",
    `This session's original directory no longer exists ("${cwd}").`,
  );
}

export function notAWorktreeSessionError(): AppError {
  return new AppError("NOT_A_WORKTREE_SESSION", "This session isn't running in a git worktree.");
}

export function branchNameRequiredError(): AppError {
  return new BadRequestError("TASK_BRANCH_NAME_REQUIRED", "A branch name is required.");
}
