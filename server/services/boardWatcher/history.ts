import { appendFile, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  historySubject,
  matchesHistoryFilter,
  type HistoryFilter,
  type WatcherActionEntry,
  type WatcherHistoryGroup,
  type WatcherHistoryPage,
} from "../../../shared/boardWatcher.js";
import { REPO_ROOT } from "../../utils/repoRoot.js";
import { ACTIONS_FILE } from "./simulation.js";

/**
 * The Board panel's history: the actions log grouped per ticket/PR and served a page at a time
 * (search and filter applied here, so paging stays right). Entries older than `KEEP_DAYS` are
 * moved to the gitignored `boardWatcher-actions-archive.jsonl`, keeping the log the digest and
 * the day's usage read small; the history still shows both.
 */

export const ARCHIVE_FILE = path.join(REPO_ROOT, "boardWatcher-actions-archive.jsonl");
const KEEP_DAYS = 90;

function parseLines(raw: string): WatcherActionEntry[] {
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as WatcherActionEntry);
}

/** Moves entries older than `KEEP_DAYS` to the archive. Only call it while nothing else is
 *  appending to the log (a line appended mid-rotation would be lost). */
export async function rotateActions(now = new Date()): Promise<number> {
  const raw = await readFile(ACTIONS_FILE, "utf8").catch(() => "");
  const cutoff = now.getTime() - KEEP_DAYS * 24 * 60 * 60_000;
  const lines = raw.split("\n").filter(Boolean);
  const old = lines.filter(
    (line) => Date.parse((JSON.parse(line) as WatcherActionEntry).ts) < cutoff,
  );
  if (old.length === 0) return 0;
  await appendFile(ARCHIVE_FILE, `${old.join("\n")}\n`, "utf8");
  const kept = lines.slice(old.length);
  const tmp = `${ACTIONS_FILE}.tmp`;
  await writeFile(tmp, kept.length ? `${kept.join("\n")}\n` : "", "utf8");
  await rename(tmp, ACTIONS_FILE);
  return old.length;
}

/** `lastTs|subject`: groups are ordered by it, newest first. */
function cursorOf(group: WatcherHistoryGroup): string {
  return `${group.lastTs}|${group.subject}`;
}

function isAfterCursor(group: WatcherHistoryGroup, cursor: string): boolean {
  const [ts = "", subject = ""] = cursor.split("|");
  return group.lastTs < ts || (group.lastTs === ts && group.subject > subject);
}

export async function historyPage(options: {
  filter?: HistoryFilter;
  query?: string;
  cursor?: string | null;
  limit?: number;
}): Promise<WatcherHistoryPage> {
  const { filter = "all", query = "", cursor = null, limit = 30 } = options;
  const [archived, recent] = await Promise.all(
    [ARCHIVE_FILE, ACTIONS_FILE].map((file) => readFile(file, "utf8").catch(() => "")),
  );
  const bySubject = new Map<string, WatcherHistoryGroup>();
  for (const entry of [...parseLines(archived ?? ""), ...parseLines(recent ?? "")]) {
    const subject = historySubject(entry);
    const group = bySubject.get(subject) ?? {
      subject,
      title: "",
      lastTs: entry.ts,
      live: false,
      entries: [],
    };
    group.entries.unshift(entry);
    if (entry.ts > group.lastTs) group.lastTs = entry.ts;
    if (entry.title) group.title = entry.title;
    group.live ||= Boolean(entry.live);
    bySubject.set(subject, group);
  }
  const needle = query.trim().toLowerCase();
  const groups = [...bySubject.values()]
    .filter((g) => g.entries.some((e) => matchesHistoryFilter(e, filter)))
    .filter(
      (g) =>
        !needle ||
        g.subject.toLowerCase().includes(needle) ||
        g.title.toLowerCase().includes(needle),
    )
    .sort((a, b) =>
      a.lastTs === b.lastTs ? (a.subject < b.subject ? -1 : 1) : a.lastTs < b.lastTs ? 1 : -1,
    )
    .filter((g) => !cursor || isAfterCursor(g, cursor));
  const page = groups.slice(0, limit);
  const last = page.at(-1);
  return { groups: page, nextCursor: groups.length > limit && last ? cursorOf(last) : null };
}
