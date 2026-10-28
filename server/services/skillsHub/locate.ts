import { readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { tryGit } from "../../utils/git.js";
import { getUserPreferences, type SkillsHubPreferences } from "../preferencesService.js";
import { directoryExists } from "../sessionService.js";
import { expandHome, findReposIn, getWorkspaceRepos } from "../workspaceService.js";
import { listCatalogs } from "./catalog.js";
import { HUB_GIT } from "./common.js";

/* The hub's URL is per-machine config (`skillsHub.repoUrl`), never hardcoded: this repo is public. */

/** The repo's own name (last path segment of its `owner/repo` slug) — the default clone folder. */
export function hubFolderName(repoUrl: string): string {
  const name = hubSlug(repoUrl).split("/").pop();
  return name !== undefined && name !== "" ? name : "skills-hub";
}

/** Best-effort browser URL for the repo: `git@host:owner/repo.git` / `https://host/owner/repo.git`
 *  → `https://host/owner/repo/`. Wrong for an SSH host alias, which is only a convenience link. */
export function hubWebUrl(repoUrl: string): string {
  const host = /^(?:[a-z+]+:\/\/)?(?:[^@/]+@)?([^/:]+)/i.exec(repoUrl.trim())?.[1] ?? "";
  // `ssh.bitbucket.org` is SSH-only; the web lives on `bitbucket.org`.
  const webHost = host.replace(/^ssh\.(?=bitbucket\.org$)/i, "");
  return webHost ? `https://${webHost}/${hubSlug(repoUrl)}/` : "";
}

async function readOrigin(dir: string): Promise<string | null> {
  return tryGit(["remote", "get-url", "origin"], dir, HUB_GIT);
}

/** Every remote's fetch URL — a clone whose remote isn't called `origin` (or a fork with the team
 *  repo as `upstream`) still counts as the hub. */
async function readRemoteUrls(dir: string): Promise<string[]> {
  const out = await tryGit(["config", "--get-regexp", "^remote\\..*\\.url$"], dir, HUB_GIT);
  if (!out) return [];
  return out
    .split("\n")
    .map((line) => line.trim().split(/\s+/)[1] ?? "")
    .filter((url) => url.length > 0);
}

/** Collapses any remote URL to `owner/repo`. The host is dropped: it's often a per-machine SSH
 *  alias (`git@github-personal:...`) that would never match another dev's clone. */
function normalizeRemoteUrl(url: string): string {
  return url
    .trim()
    .replace(/^[a-z+]+:\/\//i, "")
    .replace(/^[^@/]+@/, "")
    .replace(/^[^/:]+(?::\d+)?[:/]/, "")
    .replace(/\.git$/, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

/** `owner/repo` of a clone or browser URL — on top of `normalizeRemoteUrl`, drops what a URL copied
 *  from the browser may carry after it (`/tree/main`, `/src/master/`, `?tab=...`). */
function hubSlug(url: string): string {
  return normalizeRemoteUrl(url.replace(/[?#].*$/, ""))
    .replace(/\/(?:tree|blob|src|browse|-)(?:\/.*)?$/, "")
    .replace(/\.git$/, "");
}

/** A clone of the configured hub: has a `catalog/` folder and a remote matching `repoUrl` — by
 *  `owner/repo` (host ignored, so SSH aliases match too), or just by repo name (a fork, a mirror). */
export async function isHubRepo(dir: string, repoUrl: string): Promise<boolean> {
  if (!(await directoryExists(path.join(dir, "catalog")))) return false;
  const wanted = hubSlug(repoUrl);
  const wantedName = wanted.split("/").pop() ?? "";
  return (await readRemoteUrls(dir)).some((remote) => {
    const slug = hubSlug(remote);
    return slug === wanted || (wantedName !== "" && slug.split("/").pop() === wantedName);
  });
}

/** Anything shaped like a hub (a `catalog/` with at least one skill), regardless of origin — used
 *  to guess the URL while none is saved. */
async function looksLikeHub(dir: string): Promise<boolean> {
  return (await listCatalogs(dir)).length > 0 && (await readOrigin(dir)) !== null;
}

/** Folders that might hold the hub clone, most likely first: the workspace repos, repos one level
 *  deeper in each workspace dir (e.g. `~/git/team/<repo>`), the repos recently used with "New
 *  task", and the home dir's own repos. All cheap directory listings, no git calls. */
async function hubCandidateDirs(): Promise<string[]> {
  const { workspaceDirs, recentProjectPaths } = await getUserPreferences();
  const workspaceRepos = await getWorkspaceRepos();
  const nested: string[] = [];
  for (const dir of (workspaceDirs ?? []).map(expandHome)) {
    const children = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const child of children) {
      if (!child.isDirectory() || child.name.startsWith(".")) continue;
      const childPath = path.join(dir, child.name);
      if (workspaceRepos.includes(childPath)) continue;
      nested.push(...(await findReposIn(childPath)));
    }
  }
  return [
    ...new Set([
      ...workspaceRepos,
      ...nested,
      ...recentProjectPaths,
      ...(await findReposIn(os.homedir())),
    ]),
  ];
}

/** The `origin` of an existing hub clone (configured `path` first, then candidates), or null.
 *  Prefills the startup prompt and stands in for an unset `repoUrl`. */
export async function detectHubRepoUrl(prefs?: SkillsHubPreferences): Promise<string | null> {
  const hubPrefs = prefs ?? (await getUserPreferences()).skillsHub;
  const candidates = [
    ...(hubPrefs.path ? [expandHome(hubPrefs.path)] : []),
    ...(await hubCandidateDirs()),
  ];
  for (const candidate of [...new Set(candidates)]) {
    if (await looksLikeHub(candidate)) return readOrigin(candidate);
  }
  return null;
}

/** The configured `repoUrl`, or the detected one while it was never set; null when there's none
 *  (or it was explicitly cleared with ""). */
export async function resolveRepoUrl(prefs: SkillsHubPreferences): Promise<string | null> {
  if (prefs.repoUrl !== null) return prefs.repoUrl.trim() || null;
  return detectHubRepoUrl(prefs);
}

/** The configured path wins when it's really the hub; otherwise every candidate folder is checked
 *  by remote, plus `~/<repo name>` and `<workspace dir>/<repo name>` as last guesses. */
export async function locateHub(
  prefs: SkillsHubPreferences,
  repoUrl: string | null,
): Promise<string | null> {
  if (!repoUrl) return null;
  if (prefs.path) {
    const configured = expandHome(prefs.path);
    if (await isHubRepo(configured, repoUrl)) return configured;
  }
  const folderName = hubFolderName(repoUrl);
  const { workspaceDirs } = await getUserPreferences();
  const candidates = [
    ...(await hubCandidateDirs()),
    ...(workspaceDirs ?? []).map((dir) => path.join(expandHome(dir), folderName)),
    path.join(os.homedir(), folderName),
  ];
  for (const candidate of [...new Set(candidates)]) {
    if (await isHubRepo(candidate, repoUrl)) return candidate;
  }
  return null;
}

export async function getCloneParentDirs(): Promise<string[]> {
  const { workspaceDirs } = await getUserPreferences();
  const dirs = (workspaceDirs ?? []).map(expandHome);
  const existing: string[] = [];
  for (const dir of dirs) if (await directoryExists(dir)) existing.push(dir);
  return existing.length > 0 ? [...new Set(existing)] : [os.homedir()];
}
