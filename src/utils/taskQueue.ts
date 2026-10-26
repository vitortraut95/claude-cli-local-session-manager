import type { QueueEntry, QueueKind } from "../services/tasksApi";

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

/** The optional (older-backend) fields resolved, so the rows never deal with `undefined`. */
export type DraftEntry = Pick<QueueEntry, "key" | "link" | "repos"> & {
  kind: QueueKind;
  noRepo: boolean;
  branchPrefix: string | null;
  branch: string | null;
  baseBranch: string | null;
  useLocalBaseBranch: boolean;
  launchedAt: string | null;
  sessionId: string | null;
  error: string | null;
};

/** Repo select value for "no repo": the session opens in the folder the repos live in. */
export const NO_REPO_VALUE = "__no_repo__";

export function toDraft({
  key,
  link,
  kind,
  repos,
  noRepo,
  branchPrefix,
  branch,
  baseBranch,
  useLocalBaseBranch,
  launchedAt,
  sessionId,
  error,
}: QueueEntry): DraftEntry {
  return {
    key,
    link,
    kind: kind ?? "dev",
    repos,
    noRepo: noRepo ?? false,
    branchPrefix: branchPrefix ?? null,
    branch: branch ?? null,
    baseBranch: baseBranch ?? null,
    useLocalBaseBranch: useLocalBaseBranch ?? false,
    launchedAt: launchedAt ?? null,
    sessionId: sessionId ?? null,
    error: error ?? null,
  };
}

export function branchNameFor(entry: { key: string; branchPrefix?: string | null }): string {
  return entry.branchPrefix ? `${entry.branchPrefix}/${entry.key}` : entry.key;
}

/** A test needs no branch prefix (it tests the branch the task already has), and neither does a
 *  task with no repo (no branch is made). */
export function isMissingSetup(entry: DraftEntry): boolean {
  if (entry.noRepo) return false;
  return entry.repos.length === 0 || (entry.kind === "dev" && entry.branchPrefix === null);
}
