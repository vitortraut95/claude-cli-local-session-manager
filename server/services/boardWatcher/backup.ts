import { copyFile, mkdir, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { REPO_ROOT } from "../../utils/repoRoot.js";

/**
 * A daily copy of the watcher's local files (config, state, history, votes) outside the repo,
 * since they're gitignored and something like a hard reset + clean of the clone erases them. The
 * last `KEEP_DAYS` days are kept. At start, files missing from the repo are put back from the
 * newest copy that has them; an existing file is never overwritten.
 */

const FILES = [
  "boardWatcher.json",
  "boardWatcher-state.json",
  "boardWatcher-actions.jsonl",
  "boardWatcher-actions-archive.jsonl",
  "boardWatcher-feedback.jsonl",
];
const KEEP_DAYS = 7;

export const BACKUP_DIR = path.join(
  process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local", "share"),
  "claude-session-manager",
  "board-watcher-backups",
);

const exists = (file: string) =>
  stat(file).then(
    () => true,
    () => false,
  );

/** Newest first: the backup folders, named by day ("YYYY-MM-DD"). */
async function backupDays(): Promise<string[]> {
  const entries = await readdir(BACKUP_DIR).catch(() => []);
  return entries
    .filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name))
    .sort()
    .reverse();
}

/** Copies today's files (once a day: a folder already there is left alone) and drops old days. */
export async function backupWatcherFiles(day: string): Promise<boolean> {
  const target = path.join(BACKUP_DIR, day);
  if (await exists(target)) return false;
  const present = (
    await Promise.all(
      FILES.map(async (file) => ((await exists(path.join(REPO_ROOT, file))) ? file : null)),
    )
  ).filter((file): file is string => file !== null);
  if (present.length === 0) return false;
  await mkdir(target, { recursive: true });
  for (const file of present) await copyFile(path.join(REPO_ROOT, file), path.join(target, file));
  for (const old of (await backupDays()).slice(KEEP_DAYS)) {
    await rm(path.join(BACKUP_DIR, old), { recursive: true, force: true });
  }
  return true;
}

/** Puts back the files missing from the repo from the newest backup that has each; returns
 *  what was restored and from which day. */
export async function restoreMissingWatcherFiles(): Promise<{ file: string; day: string }[]> {
  const restored: { file: string; day: string }[] = [];
  const days = await backupDays();
  for (const file of FILES) {
    if (await exists(path.join(REPO_ROOT, file))) continue;
    for (const day of days) {
      const source = path.join(BACKUP_DIR, day, file);
      if (!(await exists(source))) continue;
      await copyFile(source, path.join(REPO_ROOT, file));
      restored.push({ file, day });
      break;
    }
  }
  return restored;
}
