import type { Response } from "express";

/**
 * Base for server errors that carry a stable, machine-readable `code` alongside the human
 * (English) `message` — routes attach `code` to the JSON error body (`sendErrorResponse` below)
 * so the frontend can look up a translated message (`resolveApiErrorMessage` in
 * `src/utils/apiClient.ts`) instead of showing the raw English text in a pt/es UI. See CLAUDE.md's
 * i18n to-do: most of this codebase's `throw new Error(...)` sites don't have a code yet — this is
 * the shared piece the incremental, file-by-file conversion builds on.
 */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * Maps a caught error to an HTTP response. Any `AppError` gets its `code` included in the body;
 * `statusFor` lets each route decide which of its own `AppError` subclasses map to which status
 * (404/409/...) — anything it returns `null` for, or a plain (non-`AppError`) `Error`, falls back
 * to 500. Replaces what used to be a repeated `if (err instanceof X) { res.status(...).json(...) }`
 * chain in every route handler.
 */
export function sendErrorResponse(
  res: Response,
  err: unknown,
  statusFor: (err: AppError) => number | null = () => null,
): void {
  if (err instanceof AppError) {
    const status = statusFor(err) ?? 500;
    res.status(status).json({ success: false, error: err.message, code: err.code });
    return;
  }
  res.status(500).json({
    success: false,
    error: err instanceof Error ? err.message : String(err),
  });
}
