import type { QueueEntry, QueueGroupedTask, QueueKind } from "../services/tasksApi";
import type { Language } from "../../shared/preferences";

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

/** A Bitbucket pull request link: `…/<workspace>/<repo>/pull-requests/<id>`. */
const PR_LINK_PATTERN = /^https?:\/\/[^\s/]+\/[^\s/]+\/([^\s/]+)\/pull-requests\/(\d+)/i;

/** Pull requests out of a pasted list of links, as review entries' `repo#id` and link (without
 *  anything after the id, like `/diff`). A repeated one keeps its first place. */
export function parsePastedPullRequests(text: string): QueueGroupedTask[] {
  const entries: QueueGroupedTask[] = [];
  for (const token of text.split(/[\s,;]+/)) {
    const match = PR_LINK_PATTERN.exec(token);
    if (!match?.[1] || !match[2]) continue;
    const key = `${match[1]}#${match[2]}`;
    if (!entries.some((entry) => entry.key === key)) entries.push({ key, link: match[0] });
  }
  return entries;
}

/** The optional (older-backend) fields resolved, so the rows never deal with `undefined`. */
export type DraftEntry = Pick<QueueEntry, "key" | "link" | "repos"> & {
  groupedTasks: QueueGroupedTask[];
  kind: QueueKind;
  noRepo: boolean;
  multiRepo: boolean;
  branchPrefix: string | null;
  branch: string | null;
  baseBranch: string | null;
  useLocalBaseBranch: boolean;
  /** "" = none. */
  notes: string;
  launchedAt: string | null;
  sessionId: string | null;
  error: string | null;
};

/** Repo select value for "no repo": the session opens in the folder the repos live in. */
export const NO_REPO_VALUE = "__no_repo__";
/** Repo select value for "several repos": same folder, the session makes a branch in each. */
export const MULTI_REPO_VALUE = "__multi_repo__";

export function toDraft({
  key,
  link,
  groupedTasks,
  kind,
  repos,
  noRepo,
  multiRepo,
  branchPrefix,
  branch,
  baseBranch,
  useLocalBaseBranch,
  notes,
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
    multiRepo: multiRepo ?? false,
    branchPrefix: branchPrefix ?? null,
    branch: branch ?? null,
    baseBranch: baseBranch ?? null,
    useLocalBaseBranch: useLocalBaseBranch ?? false,
    notes: notes ?? "",
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

/** Only development needs setup: a test opens in the repos folder on the task's branch and a
 *  review's repo is found by the server. A dev task with no repo needs no prefix (no branch is
 *  made); a multi-repo one finds its repos itself. */
export function isMissingSetup(entry: DraftEntry): boolean {
  if (entry.noRepo || entry.kind !== "dev") return false;
  if (entry.multiRepo) return entry.branchPrefix === null;
  return entry.repos.length === 0 || entry.branchPrefix === null;
}

/** Mirrors the start of `composePrompt` (taskSchedulerService.ts), in the preferences' language;
 *  the automatic notes are only known at launch. */
const PREVIEW_TEXT = {
  en: {
    task: "Task",
    groupedTasks:
      "Tasks delivered together, in this one branch and a single PR (every commit names all " +
      "the keys):",
    notes: "Notes for this task:",
  },
  pt: {
    task: "Tarefa",
    groupedTasks:
      "Tarefas entregues juntas, nesta mesma branch e num PR só (todo commit cita todas as " +
      "chaves):",
    notes: "Observações desta tarefa:",
  },
};

/** What a development entry's session is sent, minus the notes added at launch. */
export function previewDevPrompt(
  entry: DraftEntry,
  defaultPrompt: string,
  language: Language,
): string {
  const text = PREVIEW_TEXT[language];
  const tasks = [{ key: entry.key, link: entry.link }, ...entry.groupedTasks];
  const notes = entry.notes.trim();
  return [
    tasks.length > 1
      ? [text.groupedTasks, ...tasks.map((task) => `- ${task.link ?? task.key}`)].join("\n")
      : `${text.task}: ${entry.link ?? entry.key}`,
    defaultPrompt.trim(),
    notes ? `${text.notes}\n${notes}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
