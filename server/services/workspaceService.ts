import { readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getUserPreferences } from "./preferencesService.js";
import { directoryExists } from "./sessionService.js";
import { getKnownProjectFolders } from "./taskService.js";

/**
 * "Workspace dirs" — the folders a user keeps their repos in (e.g. `~/git`), stored as
 * `userPreferences.json`'s `workspaceDirs`. Each is scanned exactly one level deep: a direct child
 * holding a `.git` entry (folder for a normal clone, file for a linked worktree/submodule) counts as
 * a repo. Deliberately shallow — cheap enough to run on demand, and nested layouts are covered by
 * just adding the nested folder as another workspace dir.
 */

export function expandHome(dir: string): string {
  const trimmed = dir.trim();
  return path.resolve(trimmed.replace(/^~(?=$|\/)/, os.homedir()));
}

/** Absolute paths of every repo directly inside `dir` (hidden folders skipped), sorted. */
export async function findReposIn(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const repos = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map(async (entry) => {
        const repoPath = path.join(dir, entry.name);
        try {
          await stat(path.join(repoPath, ".git"));
          return repoPath;
        } catch {
          return null;
        }
      }),
  );
  return repos.filter((repo): repo is string => repo !== null).sort();
}

export type WorkspaceDirSuggestion = {
  dir: string;
  /** Repos found inside it right now. */
  repoCount: number;
  /** How many repos you've already used with Claude (sessions / "New task") live directly in it. */
  knownRepoCount: number;
  /** Preselected in the UI — see `suggestWorkspaceDirs`. */
  recommended: boolean;
};

/**
 * Parent folders of the repos this app already knows about (from sessions and "New task" history),
 * most-used first. The home directory itself is offered but never preselected — a repo sitting
 * right in `~` (e.g. a one-off clone) is usually the exception, not the user's repos folder.
 */
export async function suggestWorkspaceDirs(): Promise<WorkspaceDirSuggestion[]> {
  const folders = await getKnownProjectFolders();
  const counts = new Map<string, number>();
  for (const folder of folders) {
    const parent = path.dirname(folder.path);
    counts.set(parent, (counts.get(parent) ?? 0) + 1);
  }
  const home = os.homedir();
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const suggestions = await Promise.all(
    ranked.map(async ([dir, knownRepoCount]) =>
      (await directoryExists(dir))
        ? { dir, knownRepoCount, repoCount: (await findReposIn(dir)).length }
        : null,
    ),
  );
  // A known "project" can be a non-repo folder a session merely ran in (e.g. `~` itself), whose
  // parent then holds no repos at all — not worth suggesting.
  const existing = suggestions.filter(
    (s): s is Omit<WorkspaceDirSuggestion, "recommended"> => s !== null && s.repoCount > 0,
  );
  const top = existing.find((s) => s.dir !== home);
  return existing.map((s) => ({
    ...s,
    recommended: s.dir !== home && (s === top || s.knownRepoCount >= 2),
  }));
}

export type WorkspaceDirStatus = { dir: string; exists: boolean; repoCount: number };

/** Normalizes (`~` expanded, absolute) and checks each folder — powers the editor's per-row
 *  "N repos" / "doesn't exist" hint, so a typo is caught before it's saved. */
export async function inspectWorkspaceDirs(dirs: string[]): Promise<WorkspaceDirStatus[]> {
  return Promise.all(
    dirs.map(async (raw) => {
      const dir = expandHome(raw);
      const exists = await directoryExists(dir);
      return { dir, exists, repoCount: exists ? (await findReposIn(dir)).length : 0 };
    }),
  );
}

/** Every repo directly inside any of the user's `workspaceDirs` (none when never set). */
export async function getWorkspaceRepos(): Promise<string[]> {
  const { workspaceDirs } = await getUserPreferences();
  const lists = await Promise.all((workspaceDirs ?? []).map((dir) => findReposIn(expandHome(dir))));
  return [...new Set(lists.flat())];
}

/** `folders` plus every workspace repo not already in it (compared by resolved path) — for scans
 *  that should also cover repos never used with Claude here (Cleanup, session import). */
export async function withWorkspaceRepos<T extends { path: string }>(
  folders: T[],
  toFolder: (repoPath: string) => T,
): Promise<T[]> {
  const known = new Set(folders.map((f) => path.resolve(f.path)));
  const extra = (await getWorkspaceRepos()).filter((repo) => !known.has(path.resolve(repo)));
  return [...folders, ...extra.map(toFolder)];
}
