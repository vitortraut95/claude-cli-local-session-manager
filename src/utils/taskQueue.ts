import type { QueueEntry, QueueGroupedTask, QueueKind } from "../services/tasksApi";

/** Same loose match as the server's `normalizeTaskKey`: a bare key or one inside a ticket URL. */
const KEY_PATTERN = /([A-Za-z][A-Za-z0-9]+-\d+)/;

export type PastedTask = QueueGroupedTask & { groupedTasks: QueueGroupedTask[] };

/**
 * Tickets out of a pasted list — links or bare keys, separated by lines, spaces, commas or
 * semicolons; tickets joined by "+" (`A-1 + A-2`) become one entry, done together. Tokens with no
 * key are skipped; a key repeated keeps its first place and the first link found.
 */
export function parsePastedTasks(text: string): PastedTask[] {
  const entries: PastedTask[] = [];
  const byKey = new Map<string, QueueGroupedTask>();
  for (const token of text.replace(/\s*\+\s*/g, "+").split(/[\s,;]+/)) {
    let entry: PastedTask | null = null;
    for (const part of token.split("+")) {
      const match = KEY_PATTERN.exec(part);
      if (!match?.[1]) continue;
      const key = match[1].toUpperCase();
      const link = /^https?:\/\//i.test(part) ? part : null;
      const current = byKey.get(key);
      if (current) {
        if (!current.link && link) current.link = link;
        continue;
      }
      if (entry) {
        const task = { key, link };
        entry.groupedTasks.push(task);
        byKey.set(key, task);
      } else {
        entry = { key, link, groupedTasks: [] };
        entries.push(entry);
        byKey.set(key, entry);
      }
    }
  }
  return entries;
}

/** The optional (older-backend) fields resolved, so the rows never deal with `undefined`. */
export type DraftEntry = Pick<QueueEntry, "key" | "link" | "repos"> & {
  groupedTasks: QueueGroupedTask[];
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
  groupedTasks,
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
    groupedTasks: groupedTasks ?? [],
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

/** Every key in the entry: its own and the grouped ones. */
export function entryKeys(entry: Pick<DraftEntry, "key" | "groupedTasks">): string[] {
  return [entry.key, ...entry.groupedTasks.map((task) => task.key)];
}

/** Same as the server's `queueEntryBranch`: `<prefix>/<every key joined by "-">`. */
export function branchNameFor(
  entry: Pick<DraftEntry, "key" | "groupedTasks" | "branchPrefix">,
): string {
  const keys = entryKeys(entry).join("-");
  return entry.branchPrefix ? `${entry.branchPrefix}/${keys}` : keys;
}

/** A test needs no branch prefix (it tests the branch the task already has), and neither does a
 *  task with no repo (no branch is made). */
export function isMissingSetup(entry: DraftEntry): boolean {
  if (entry.noRepo) return false;
  return entry.repos.length === 0 || (entry.kind === "dev" && entry.branchPrefix === null);
}
