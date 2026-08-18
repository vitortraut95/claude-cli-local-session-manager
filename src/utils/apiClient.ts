import axios from "axios";
import type { TranslationKey } from "../i18n/translations";

type ErrorResponseBody = { error?: unknown; code?: unknown };

/** An `Error` re-thrown by `withServerErrorMessage`, optionally carrying the server's own
 *  machine-readable `code` (see `server/utils/httpError.ts`'s `AppError`) — present once a given
 *  backend throw site has been converted to it, absent (falls back to the raw English message)
 *  otherwise. See CLAUDE.md's i18n to-do for which backend files are converted so far. */
export type ApiError = Error & { code?: string };

/** Re-throws with the server's specific error message (e.g. "session is active") instead of
 *  axios's generic "Request failed with status code 409", so callers' existing
 *  `resolveApiErrorMessage`/`err instanceof Error ? err.message : ...` catch blocks surface
 *  something actually useful. Shared by every `src/services/*Api.ts` file — each one used to
 *  carry its own byte-identical copy of this function. */
export async function withServerErrorMessage<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (err) {
    if (axios.isAxiosError<ErrorResponseBody>(err) && typeof err.response?.data?.error === "string") {
      const code = typeof err.response.data.code === "string" ? err.response.data.code : undefined;
      const apiError: ApiError = new Error(err.response.data.error, { cause: err });
      if (code) apiError.code = code;
      throw apiError;
    }
    throw err;
  }
}

/** Maps a server `AppError` code (see `server/utils/httpError.ts`) to the translation key that
 *  should be shown instead of the raw English message it always travels with as a fallback.
 *  Deliberately small and grown one code at a time as backend files get converted — an
 *  unrecognized (or absent) code just falls through to the English message below, same as before
 *  this mechanism existed, so a route that hasn't been converted yet never breaks. */
const SERVER_ERROR_CODE_KEYS: Partial<Record<string, TranslationKey>> = {
  SESSION_NOT_FOUND: "apiError.sessionNotFound",
  SESSION_ACTIVE: "apiError.sessionActive",
  INVALID_SESSION_ID: "apiError.invalidSessionId",
};

/**
 * Drop-in replacement for the `err instanceof Error ? err.message : t(fallbackKey)` pattern
 * repeated across every hook/component that calls a `*Api.ts` function — translates the error via
 * its server-issued `code` when one is recognized, otherwise falls back to the raw (English)
 * server message, and finally to `fallbackKey` for a non-`Error` throw (e.g. a plain string).
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
