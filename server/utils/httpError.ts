import type { ErrorRequestHandler, Response } from "express";

/**
 * Server error with a stable `code` alongside the English `message`; the code is sent in the JSON
 * error body so the frontend can show a translated message (`resolveApiErrorMessage`). `status`
 * is the HTTP status it's answered with (500 unless a subclass says otherwise).
 */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AppError";
  }

  // A getter, not a field: a field set in this constructor would hide a subclass's getter.
  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  get status(): number {
    return 500;
  }

  /** Extra fields for the JSON error body. */
  body(): Record<string, unknown> {
    return {};
  }
}

/** The caller's fault: a missing or malformed field. */
export class BadRequestError extends AppError {
  override get status(): number {
    return 400;
  }
}

export class NotFoundError extends AppError {
  override get status(): number {
    return 404;
  }
}

/** The current state doesn't allow it (already exists, busy, active elsewhere). */
export class ConflictError extends AppError {
  override get status(): number {
    return 409;
  }
}

/** The message of anything thrown. */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** `{ success: false, error, code? }` with the error's own status. */
export function sendErrorResponse(res: Response, err: unknown): void {
  if (err instanceof AppError) {
    res
      .status(err.status)
      .json({ success: false, error: err.message, code: err.code, ...err.body() });
    return;
  }
  res.status(500).json({ success: false, error: errorMessage(err) });
}

/** Express error middleware: every route's thrown/rejected error ends up here. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  sendErrorResponse(res, err);
};
