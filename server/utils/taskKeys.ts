/**
 * Task keys are ticket keys (`PROJ-123`). Two levels of strictness on purpose:
 * - `normalizeTaskKey`, for text someone typed or pasted *as* a ticket (a bare key or a browse
 *   URL): case-insensitive, same as the "New task" modal's own `extractJiraId`.
 * - `inferTaskKey`, for text that merely *might* mention one (a branch name):
 *   uppercase-only (so `fix/utf-8` isn't read as ticket `UTF-8`), and only when exactly one
 *   distinct key appears — `env/PROJ-1-PROJ-2` is ambiguous and yields nothing rather than a guess.
 */

const LOOSE_KEY_PATTERN = /([A-Za-z][A-Za-z0-9]+-\d+)/;
const STRICT_KEY_PATTERN = /\b[A-Z][A-Z0-9]+-\d+\b/g;
const SAFE_TASK_KEY = /^[A-Z][A-Z0-9]+-\d+$/;

/** A ticket key out of a bare key or a ticket URL, uppercased; null when there's none. */
export function normalizeTaskKey(text: string): string | null {
  const match = LOOSE_KEY_PATTERN.exec(text.trim());
  return match?.[1] ? match[1].toUpperCase() : null;
}

/** For a route param that must already *be* a key — also keeps it safe as a JSON object key. */
export function isTaskKey(text: string): boolean {
  return SAFE_TASK_KEY.test(text);
}

function strictKeys(text: string | null): Set<string> {
  return new Set(text ? (text.match(STRICT_KEY_PATTERN) ?? []) : []);
}

/** The single key mentioned in `text`, or null when there's none or more than one. */
export function inferTaskKey(text: string | null): string | null {
  const keys = strictKeys(text);
  return keys.size === 1 ? ([...keys][0] ?? null) : null;
}
