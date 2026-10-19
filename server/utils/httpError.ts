import type { Response } from "express";

/**
 * Server error with a stable `code` alongside the English `message`; the code is sent in the JSON
 * error body so the frontend can show a translated message (`resolveApiErrorMessage`).
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
}

/** An `AppError` the caller caused (a missing or malformed field); answered with 400 unless the
 *  route maps it otherwise. */
export class BadRequestError extends AppError {
  constructor(code: string, message: string, options?: ErrorOptions) {
    super(code, message, options);
    this.name = "BadRequestError";
  }
}

/** The error's `code` when it's an `AppError`, for routes that build their own error body. */
export function errorCode(err: unknown): string | undefined {
  return err instanceof AppError ? err.code : undefined;
}

/**
 * Maps a caught error to an HTTP response. Any `AppError` gets its `code` included in the body;
 * `statusFor` lets each route decide which of its own `AppError` subclasses map to which status
 * (404/409/...); `null` falls back to 400 for a `BadRequestError` and 500 otherwise.
 */
export function sendErrorResponse(
  res: Response,
  err: unknown,
  statusFor: (err: AppError) => number | null = () => null,
): void {
  if (err instanceof AppError) {
    const status = statusFor(err) ?? (err instanceof BadRequestError ? 400 : 500);
    res.status(status).json({ success: false, error: err.message, code: err.code });
    return;
  }
  res.status(500).json({
    success: false,
    error: err instanceof Error ? err.message : String(err),
  });
}
