/** Same loose match as the server's `normalizeTaskKey`: a bare key or one inside a ticket URL. */
const KEY_PATTERN = /([A-Za-z][A-Za-z0-9]+-\d+)/;

export type PastedTask = { key: string; link: string | null };

/**
 * Tickets out of a pasted list — links or bare keys, separated by lines, spaces, commas or
 * semicolons. Tokens with no key are skipped; a key repeated keeps the first link found.
 */
export function parsePastedTasks(text: string): PastedTask[] {
  const byKey = new Map<string, PastedTask>();
  for (const token of text.split(/[\s,;]+/)) {
    const match = KEY_PATTERN.exec(token);
    if (!match?.[1]) continue;
    const key = match[1].toUpperCase();
    const link = /^https?:\/\//i.test(token) ? token : null;
    const current = byKey.get(key);
    if (!current) byKey.set(key, { key, link });
    else if (!current.link && link) current.link = link;
  }
  return [...byKey.values()];
}
