import { execFile } from "node:child_process";
import { lstat, mkdir, readdir, readFile, readlink, stat, symlink, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { AppError } from "../utils/httpError.js";
import {
  getUserPreferences,
  saveUserPreferences,
  type SkillsHubPreferences,
} from "./preferencesService.js";
import { normalizeRemoteUrl } from "./sessionTransferService.js";
import { directoryExists } from "./sessionService.js";
import { expandHome, getWorkspaceRepos } from "./workspaceService.js";

/**
 * Team skills from a shared skills repo ("the hub" — a git repo with a `catalog/<catalog>/` tree of
 * skill folders), made available to every Claude session on this machine by symlinking each skill folder of the
 * user's chosen catalogs into the CLI's user-level skills dir (`~/.claude/skills`, or
 * `$CLAUDE_CONFIG_DIR/skills`) — the same scheme a catalog's own link script would use,
 * reimplemented here so it works for any catalog. Because the links point into the
 * clone, a `git pull` there updates already-linked skills in place; only a brand-new skill needs a
 * new link, which `syncSkillsHub` (run right before every "New task" launch) adds.
 *
 * Everything here is optional and non-blocking by design: no hub, no catalogs chosen, offline —
 * the "New task" flow still works exactly as before, the UI just invites the user to set it up.
 * Never forces anything on the clone (it's the user's own checkout, they may be developing skills
 * in it): only `fetch` + a fast-forward-only merge of the current branch's upstream when clean.
 * Never touches an entry in the skills dir that isn't a link into the hub's `catalog/`.
 */

/* The hub's URL is per-machine config (`skillsHub.repoUrl` in userPreferences.json), never
 * hardcoded: this app's repo is public and must not name any team's private repo. */

const FETCH_TIMEOUT_MS = 20_000;
const CLONE_TIMEOUT_MS = 180_000;

const execFileAsync = promisify(execFile);

/** Non-interactive git: a missing SSH key or unknown host fails fast instead of hanging on a
 *  prompt nobody can see (the backend has no terminal). */
const NON_INTERACTIVE_GIT_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  GIT_TERMINAL_PROMPT: "0",
  GIT_SSH_COMMAND: process.env.GIT_SSH_COMMAND ?? "ssh -o BatchMode=yes -o ConnectTimeout=10",
};

async function git(args: string[], cwd: string, timeout = FETCH_TIMEOUT_MS): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd,
      env: NON_INTERACTIVE_GIT_ENV,
      timeout,
      maxBuffer: 8 * 1024 * 1024,
    });
    return stdout.trim();
  } catch (err) {
    const stderr = (err as { stderr?: string } | null)?.stderr?.trim();
    const fallback = err instanceof Error ? err.message : String(err);
    throw new Error(stderr && stderr.length > 0 ? stderr : fallback, { cause: err });
  }
}

async function tryGit(args: string[], cwd: string): Promise<string | null> {
  try {
    return await git(args, cwd);
  } catch {
    return null;
  }
}

export function getUserSkillsDir(): string {
  const fromEnv = process.env.CLAUDE_CONFIG_DIR?.trim();
  const configDir = fromEnv && fromEnv.length > 0 ? fromEnv : path.join(os.homedir(), ".claude");
  return path.join(configDir, "skills");
}

/** The repo's own name (last path segment of its `owner/repo` slug) — the default clone folder. */
function hubFolderName(repoUrl: string): string {
  return normalizeRemoteUrl(repoUrl).split("/").pop() ?? "skills-hub";
}

/** Best-effort browser URL for the repo: `git@host:owner/repo.git` / `https://host/owner/repo.git`
 *  → `https://host/owner/repo/`. Wrong for an SSH host alias, which is only a convenience link. */
function hubWebUrl(repoUrl: string): string {
  const host = /^(?:[a-z+]+:\/\/)?(?:[^@/]+@)?([^/:]+)/i.exec(repoUrl.trim())?.[1] ?? "";
  return host ? `https://${host}/${normalizeRemoteUrl(repoUrl)}/` : "";
}

async function readOrigin(dir: string): Promise<string | null> {
  return tryGit(["remote", "get-url", "origin"], dir);
}

/** A clone of the configured hub: has a `catalog/` folder and an `origin` matching `repoUrl`
 *  (host ignored, so SSH aliases match too). */
async function isHubRepo(dir: string, repoUrl: string): Promise<boolean> {
  if (!(await directoryExists(path.join(dir, "catalog")))) return false;
  const remote = await readOrigin(dir);
  return remote !== null && normalizeRemoteUrl(remote) === normalizeRemoteUrl(repoUrl);
}

/** Anything shaped like a hub (a `catalog/` with at least one skill), regardless of origin — only
 *  used to guess the URL for someone who set the hub up before it became a preference. */
async function looksLikeHub(dir: string): Promise<boolean> {
  return (await listCatalogs(dir)).length > 0 && (await readOrigin(dir)) !== null;
}

/** The `origin` of an already-set-up hub clone — the configured `path` first, then the workspace
 *  repos. Null when none is found. Feeds the startup prompt's prefill and, until the user confirms
 *  it, stands in for an unset `repoUrl` so an existing setup keeps working right after the update. */
export async function detectHubRepoUrl(prefs?: SkillsHubPreferences): Promise<string | null> {
  const hubPrefs = prefs ?? (await getUserPreferences()).skillsHub;
  const candidates = [
    ...(hubPrefs.path ? [expandHome(hubPrefs.path)] : []),
    ...(await getWorkspaceRepos()),
  ];
  for (const candidate of [...new Set(candidates)]) {
    if (await looksLikeHub(candidate)) return readOrigin(candidate);
  }
  return null;
}

/** The configured `repoUrl`, or the detected one while it was never set; null when there's none
 *  (or it was explicitly cleared with ""). */
async function resolveRepoUrl(prefs: SkillsHubPreferences): Promise<string | null> {
  if (prefs.repoUrl !== null) return prefs.repoUrl.trim() || null;
  return detectHubRepoUrl(prefs);
}

/** The configured path wins when it's really the hub; otherwise every workspace repo is checked by
 *  `origin`, plus `~/<repo name>` as a last guess. */
async function locateHub(
  prefs: SkillsHubPreferences,
  repoUrl: string | null,
): Promise<string | null> {
  if (!repoUrl) return null;
  if (prefs.path) {
    const configured = expandHome(prefs.path);
    if (await isHubRepo(configured, repoUrl)) return configured;
  }
  const candidates = [
    ...(await getWorkspaceRepos()),
    path.join(os.homedir(), hubFolderName(repoUrl)),
  ];
  for (const candidate of [...new Set(candidates)]) {
    if (await isHubRepo(candidate, repoUrl)) return candidate;
  }
  return null;
}

export type HubSkill = { name: string; description: string; dir: string };
export type HubCatalog = { name: string; skills: HubSkill[] };

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** A top-level scalar from SKILL.md's frontmatter — quoted/plain on one line, or a `|`/`>` block
 *  (indented lines below it). Not a YAML parser: just enough for `description`. */
function readFrontmatterScalar(frontmatter: string, key: string): string {
  const lines = frontmatter.split(/\r?\n/);
  const index = lines.findIndex((line) => line.startsWith(`${key}:`));
  if (index === -1) return "";
  const inline = lines[index]!.slice(key.length + 1).trim();
  if (inline && !/^[|>][-+]?$/.test(inline)) {
    return inline.replace(/^["']|["']$/g, "").replace(/\\"/g, '"');
  }
  const block: string[] = [];
  for (const line of lines.slice(index + 1)) {
    if (line.trim() !== "" && !/^\s/.test(line)) break;
    block.push(line.trim());
  }
  return block.join(inline.startsWith("|") ? "\n" : " ").trim();
}

/** Top-level `key:` followed by `  - item` lines. */
function readFrontmatterList(frontmatter: string, key: string): string[] {
  const lines = frontmatter.split(/\r?\n/);
  const index = lines.findIndex((line) => line.startsWith(`${key}:`));
  if (index === -1) return [];
  const items: string[] = [];
  for (const line of lines.slice(index + 1)) {
    const match = /^\s+-\s+(.+)$/.exec(line);
    if (!match) break;
    items.push(match[1]!.trim());
  }
  return items;
}

async function readSkillDescription(skillMdPath: string): Promise<string> {
  try {
    const raw = await readFile(skillMdPath, "utf-8");
    return readFrontmatterScalar(FRONTMATTER_PATTERN.exec(raw)?.[1] ?? "", "description");
  } catch {
    return "";
  }
}

/** Skill folders of one catalog: `skills/<name>/SKILL.md` (the documented layout) and
 *  `<name>/SKILL.md` directly in the catalog (some catalogs, e.g. `engineering`, use that).
 *  Folders marked deprecated are left out. */
async function listCatalogSkills(catalogDir: string): Promise<HubSkill[]> {
  const found = new Map<string, HubSkill>();
  for (const base of [path.join(catalogDir, "skills"), catalogDir]) {
    let entries;
    try {
      entries = await readdir(base, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      if (/deprecated/i.test(entry.name) || found.has(entry.name)) continue;
      const dir = path.join(base, entry.name);
      const skillMd = path.join(dir, "SKILL.md");
      try {
        await stat(skillMd);
      } catch {
        continue;
      }
      found.set(entry.name, {
        name: entry.name,
        description: await readSkillDescription(skillMd),
        dir,
      });
    }
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function listCatalogs(hubPath: string): Promise<HubCatalog[]> {
  const catalogRoot = path.join(hubPath, "catalog");
  let entries;
  try {
    entries = await readdir(catalogRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  const catalogs = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map(async (entry) => ({
        name: entry.name,
        skills: await listCatalogSkills(path.join(catalogRoot, entry.name)),
      })),
  );
  return catalogs.filter((c) => c.skills.length > 0).sort((a, b) => a.name.localeCompare(b.name));
}

type LinkEntry =
  { kind: "absent" } | { kind: "link"; target: string; targetExists: boolean } | { kind: "other" };

async function inspectEntry(entryPath: string): Promise<LinkEntry> {
  let info;
  try {
    info = await lstat(entryPath);
  } catch {
    return { kind: "absent" };
  }
  if (!info.isSymbolicLink()) return { kind: "other" };
  const target = path.resolve(path.dirname(entryPath), await readlink(entryPath));
  let targetExists = true;
  try {
    await stat(entryPath);
  } catch {
    targetExists = false;
  }
  return { kind: "link", target, targetExists };
}

function isInside(child: string, parent: string): boolean {
  const relative = path.relative(parent, child);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

/**
 * - `linked`: the skills dir already links to this exact folder.
 * - `missing`: nothing there yet (a new skill) — the next sync links it.
 * - `broken`: a link into the hub whose target is gone (renamed/moved clone) — the next sync fixes it.
 * - `conflict`: something else owns the name (a real folder, a link elsewhere, or a skill with the
 *   same name from another selected catalog) — left alone, the user resolves it by hand.
 */
export type SkillLinkState = "linked" | "missing" | "broken" | "conflict";

export type SkillStatus = {
  name: string;
  catalog: string;
  description: string;
  state: SkillLinkState;
  /** For `conflict`: what currently owns the name (a path, or `catalog:<name>` for a duplicate). */
  conflictWith?: string;
};

export type SkillsHubStatus = {
  found: boolean;
  path: string | null;
  /** The configured `skillsHub.path` exists in preferences but isn't (or is no longer) the hub. */
  configuredPathInvalid: boolean;
  branch: string | null;
  defaultBranch: string | null;
  upstream: string | null;
  dirty: boolean;
  /** Relative to the upstream as of the last fetch — null without an upstream. */
  behind: number | null;
  ahead: number | null;
  catalogs: HubCatalog[];
  /** Whole catalogs kept linked — including skills added to them later. */
  selectedCatalogs: string[];
  /** Individually picked skills (`<catalog>/<skill>`), on top of `selectedCatalogs`. Both come from
   *  the saved choice or — before the user ever chose — are inferred from what's already linked
   *  (see `inferSelection`). */
  selectedSkills: string[];
  /** True when the selection comes from the user's own explicit choice. */
  catalogsChosen: boolean;
  skills: SkillStatus[];
  userSkillsDir: string;
  inviteDismissed: boolean;
  /** The hub repo in use — `skillsHub.repoUrl`, or the detected one while that was never set.
   *  Null = not configured: the UI asks for it before offering anything else. */
  cloneUrl: string | null;
  /** True while `cloneUrl` comes from detection, not from a saved `skillsHub.repoUrl`. */
  repoUrlDetected: boolean;
  /** `skillsHub.repoUrl` saved as "" — the user said there's no hub; the UI stays out of the way. */
  notUsed: boolean;
  webUrl: string;
  /** The folder a clone gets (the repo's own name). */
  cloneFolderName: string;
  /** Where "Clone" would put it: `<dir>/<cloneFolderName>` for each workspace dir (or the home dir
   *  when none is set). */
  cloneParentDirs: string[];
};

/** What to keep linked: whole catalogs (future skills included) plus individually picked skills,
 *  each as `<catalog>/<skill>`. */
export type SkillsSelection = { catalogs: string[]; skills: string[] };

export function skillId(catalog: string, skill: string): string {
  return `${catalog}/${skill}`;
}

function isSelected(selection: SkillsSelection, catalog: string, skill: string): boolean {
  return selection.catalogs.includes(catalog) || selection.skills.includes(skillId(catalog, skill));
}

/** Drops catalogs/skills that no longer exist in the hub, and individual picks already covered by
 *  a whole-catalog pick. */
function normalizeSelection(catalogs: HubCatalog[], selection: SkillsSelection): SkillsSelection {
  const known = new Set(catalogs.map((c) => c.name));
  const wholeCatalogs = [...new Set(selection.catalogs)].filter((name) => known.has(name));
  const knownSkills = new Set(
    catalogs.flatMap((c) => c.skills.map((k) => skillId(c.name, k.name))),
  );
  const skills = [...new Set(selection.skills)].filter(
    (id) => knownSkills.has(id) && !wholeCatalogs.includes(id.split("/")[0] ?? ""),
  );
  return { catalogs: wholeCatalogs, skills };
}

async function computeSkillStatuses(
  hubPath: string,
  catalogs: HubCatalog[],
  selection: SkillsSelection,
): Promise<SkillStatus[]> {
  const skillsDir = getUserSkillsDir();
  const catalogRoot = path.join(hubPath, "catalog");
  const owner = new Map<string, string>();
  const statuses: SkillStatus[] = [];
  for (const catalog of catalogs) {
    for (const skill of catalog.skills.filter((k) => isSelected(selection, catalog.name, k.name))) {
      const base = { name: skill.name, catalog: catalog.name, description: skill.description };
      const firstOwner = owner.get(skill.name);
      if (firstOwner) {
        statuses.push({ ...base, state: "conflict", conflictWith: `catalog:${firstOwner}` });
        continue;
      }
      owner.set(skill.name, catalog.name);
      const entry = await inspectEntry(path.join(skillsDir, skill.name));
      if (entry.kind === "absent") {
        statuses.push({ ...base, state: "missing" });
      } else if (entry.kind === "link" && path.resolve(entry.target) === path.resolve(skill.dir)) {
        statuses.push({ ...base, state: entry.targetExists ? "linked" : "broken" });
      } else if (
        entry.kind === "link" &&
        isInside(entry.target, catalogRoot) &&
        !entry.targetExists
      ) {
        statuses.push({ ...base, state: "broken" });
      } else {
        statuses.push({
          ...base,
          state: "conflict",
          conflictWith: entry.kind === "link" ? entry.target : path.join(skillsDir, skill.name),
        });
      }
    }
  }
  return statuses;
}

/** The implicit selection used until the user chooses explicitly: a catalog whose every skill is
 *  already linked to this hub counts as whole, otherwise its linked skills count individually — so
 *  someone who already ran the hub's own script (or linked a skill by hand) isn't asked to choose
 *  again, and nothing they linked gets undone. */
async function inferSelection(catalogs: HubCatalog[]): Promise<SkillsSelection> {
  const skillsDir = getUserSkillsDir();
  const selection: SkillsSelection = { catalogs: [], skills: [] };
  for (const catalog of catalogs) {
    const linked: string[] = [];
    for (const skill of catalog.skills) {
      const entry = await inspectEntry(path.join(skillsDir, skill.name));
      if (entry.kind === "link" && path.resolve(entry.target) === path.resolve(skill.dir)) {
        linked.push(skill.name);
      }
    }
    if (linked.length > 0 && linked.length === catalog.skills.length) {
      selection.catalogs.push(catalog.name);
    } else {
      selection.skills.push(...linked.map((name) => skillId(catalog.name, name)));
    }
  }
  return selection;
}

async function resolveSelection(
  catalogs: HubCatalog[],
  prefs: SkillsHubPreferences,
): Promise<SkillsSelection> {
  return prefs.catalogs !== null
    ? normalizeSelection(catalogs, { catalogs: prefs.catalogs, skills: prefs.skills })
    : inferSelection(catalogs);
}

async function readGitState(hubPath: string) {
  const [branch, originHead, upstream, porcelain] = await Promise.all([
    tryGit(["symbolic-ref", "--short", "-q", "HEAD"], hubPath),
    tryGit(["symbolic-ref", "--short", "-q", "refs/remotes/origin/HEAD"], hubPath),
    tryGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], hubPath),
    tryGit(["status", "--porcelain", "--untracked-files=no"], hubPath),
  ]);
  let behind: number | null = null;
  let ahead: number | null = null;
  if (upstream) {
    const counts = await tryGit(["rev-list", "--left-right", "--count", "HEAD...@{u}"], hubPath);
    const [aheadRaw, behindRaw] = counts?.split(/\s+/) ?? [];
    ahead = aheadRaw !== undefined ? Number(aheadRaw) : null;
    behind = behindRaw !== undefined ? Number(behindRaw) : null;
  }
  return {
    branch,
    defaultBranch: originHead ? originHead.replace(/^origin\//, "") : null,
    upstream,
    dirty: (porcelain ?? "").length > 0,
    behind,
    ahead,
  };
}

async function getCloneParentDirs(): Promise<string[]> {
  const { workspaceDirs } = await getUserPreferences();
  const dirs = (workspaceDirs ?? []).map(expandHome);
  const existing: string[] = [];
  for (const dir of dirs) if (await directoryExists(dir)) existing.push(dir);
  return existing.length > 0 ? [...new Set(existing)] : [os.homedir()];
}

export async function getSkillsHubStatus(): Promise<SkillsHubStatus> {
  const prefs = (await getUserPreferences()).skillsHub;
  const repoUrl = await resolveRepoUrl(prefs);
  const hubPath = await locateHub(prefs, repoUrl);
  const common = {
    userSkillsDir: getUserSkillsDir(),
    inviteDismissed: prefs.inviteDismissed,
    cloneUrl: repoUrl,
    repoUrlDetected: prefs.repoUrl === null && repoUrl !== null,
    notUsed: prefs.repoUrl === "",
    webUrl: repoUrl ? hubWebUrl(repoUrl) : "",
    cloneFolderName: repoUrl ? hubFolderName(repoUrl) : "",
    cloneParentDirs: await getCloneParentDirs(),
    configuredPathInvalid: prefs.path !== null && hubPath !== expandHome(prefs.path),
  };
  if (!hubPath) {
    return {
      ...common,
      found: false,
      path: null,
      branch: null,
      defaultBranch: null,
      upstream: null,
      dirty: false,
      behind: null,
      ahead: null,
      catalogs: [],
      selectedCatalogs: [],
      selectedSkills: [],
      catalogsChosen: prefs.catalogs !== null,
      skills: [],
    };
  }
  const catalogs = await listCatalogs(hubPath);
  const selection = await resolveSelection(catalogs, prefs);
  return {
    ...common,
    found: true,
    path: hubPath,
    ...(await readGitState(hubPath)),
    catalogs,
    selectedCatalogs: selection.catalogs,
    selectedSkills: selection.skills,
    catalogsChosen: prefs.catalogs !== null,
    skills: await computeSkillStatuses(hubPath, catalogs, selection),
  };
}

export type LinkResult = { linked: string[]; unlinked: string[]; conflicts: string[] };

/**
 * Brings `~/.claude/skills` in line with the selection: links `missing` skills, re-points
 * `broken` ones, and removes links into the hub whose target vanished. With `pruneUnselected`
 * (only after an explicit choice), it also removes links to hub skills no longer selected.
 * Anything that isn't a link into this hub's `catalog/` is never touched.
 */
async function applyLinks(
  hubPath: string,
  catalogs: HubCatalog[],
  selection: SkillsSelection,
  pruneUnselected: boolean,
): Promise<LinkResult> {
  const skillsDir = getUserSkillsDir();
  const catalogRoot = path.join(hubPath, "catalog");
  const result: LinkResult = { linked: [], unlinked: [], conflicts: [] };

  try {
    await mkdir(skillsDir, { recursive: true });
  } catch (err) {
    throw new AppError("SKILLS_DIR_UNWRITABLE", `Can't create ${skillsDir}.`, { cause: err });
  }

  const wanted = new Map<string, string>();
  for (const status of await computeSkillStatuses(hubPath, catalogs, selection)) {
    const skill = catalogs
      .find((c) => c.name === status.catalog)
      ?.skills.find((s) => s.name === status.name);
    if (!skill) continue;
    if (status.state === "conflict") {
      result.conflicts.push(status.name);
      continue;
    }
    wanted.set(skill.name, skill.dir);
    const dest = path.join(skillsDir, skill.name);
    if (status.state === "broken") {
      await unlink(dest);
    }
    if (status.state === "missing" || status.state === "broken") {
      await symlink(skill.dir, dest);
      result.linked.push(skill.name);
    }
  }

  const entries = await readdir(skillsDir).catch(() => [] as string[]);
  for (const name of entries) {
    if (wanted.has(name)) continue;
    const entryPath = path.join(skillsDir, name);
    const entry = await inspectEntry(entryPath);
    if (entry.kind !== "link" || !isInside(entry.target, catalogRoot)) continue;
    if (!entry.targetExists || pruneUnselected) {
      await unlink(entryPath);
      result.unlinked.push(name);
    }
  }
  return result;
}

export type SyncResult = {
  status: SkillsHubStatus;
  /** False when `git fetch` failed (offline, no SSH access) — links are still refreshed. */
  fetched: boolean;
  fetchError: string | null;
  /** Commits fast-forwarded into the current branch (0 when already up to date or skipped). */
  pulledCommits: number;
  /** Why an available update wasn't applied, when one was available but skipped. */
  pullSkippedReason: "dirty" | "diverged" | "failed" | null;
  links: LinkResult;
};

let syncInFlight: Promise<SyncResult> | null = null;

/** Fetch, fast-forward the current branch when that's safe, then refresh links. Concurrent calls
 *  (two tabs creating tasks at once) share one run instead of racing on the same clone. */
export function syncSkillsHub(): Promise<SyncResult> {
  syncInFlight ??= runSync().finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}

async function runSync(): Promise<SyncResult> {
  const before = await getSkillsHubStatus();
  if (!before.found || !before.path) {
    throw new AppError("SKILLS_HUB_NOT_FOUND", "Skills hub clone not found.");
  }
  const hubPath = before.path;

  let fetched = true;
  let fetchError: string | null = null;
  try {
    await git(["fetch", "--prune", "origin"], hubPath);
  } catch (err) {
    fetched = false;
    fetchError = err instanceof Error ? err.message : String(err);
  }

  let pulledCommits = 0;
  let pullSkippedReason: SyncResult["pullSkippedReason"] = null;
  const state = await readGitState(hubPath);
  if (state.upstream && (state.behind ?? 0) > 0) {
    if (state.dirty) {
      pullSkippedReason = "dirty";
    } else if ((state.ahead ?? 0) > 0) {
      pullSkippedReason = "diverged";
    } else {
      try {
        await git(["merge", "--ff-only", "@{u}"], hubPath);
        pulledCommits = state.behind ?? 0;
      } catch {
        pullSkippedReason = "failed";
      }
    }
  }

  const catalogs = await listCatalogs(hubPath);
  const selection = await resolveSelection(catalogs, (await getUserPreferences()).skillsHub);
  const links = await applyLinks(hubPath, catalogs, selection, false);

  return {
    status: await getSkillsHubStatus(),
    fetched,
    fetchError,
    pulledCommits,
    pullSkippedReason,
    links,
  };
}

async function updateSkillsHubPreferences(partial: Partial<SkillsHubPreferences>): Promise<void> {
  const prefs = await getUserPreferences();
  await saveUserPreferences({ ...prefs, skillsHub: { ...prefs.skillsHub, ...partial } });
}

/** Saves an explicit selection (whole catalogs + individual skills) and applies it right away —
 *  including unlinking hub skills that were deselected (only links into the hub, never anything
 *  else). */
export async function setSkillsHubSelection(
  requested: SkillsSelection,
): Promise<SyncResult["links"]> {
  const status = await getSkillsHubStatus();
  if (!status.found || !status.path) {
    throw new AppError("SKILLS_HUB_NOT_FOUND", "Skills hub clone not found.");
  }
  const selection = normalizeSelection(status.catalogs, requested);
  await updateSkillsHubPreferences({ catalogs: selection.catalogs, skills: selection.skills });
  return applyLinks(status.path, status.catalogs, selection, true);
}

export type SkillDetails = {
  catalog: string;
  name: string;
  description: string;
  /** Other skills it declares it depends on (`requires-skills`). */
  requiresSkills: string[];
  /** SKILL.md without its frontmatter (markdown). */
  body: string;
  /** Every other file in the skill folder (references, scripts), relative to it. */
  files: string[];
  /** Absolute path of the skill folder in the clone. */
  dir: string;
};

async function listFilesRecursive(dir: string, base = dir): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return listFilesRecursive(full, base);
      return [path.relative(base, full)];
    }),
  );
  return nested.flat().sort();
}

/** The full content of one hub skill, for the selection modal's preview. Looked up by name among
 *  the hub's own listed skills — never a caller-supplied path. */
export async function getSkillDetails(
  catalogName: string,
  skillName: string,
): Promise<SkillDetails> {
  const prefs = (await getUserPreferences()).skillsHub;
  const hubPath = await locateHub(prefs, await resolveRepoUrl(prefs));
  if (!hubPath) throw new AppError("SKILLS_HUB_NOT_FOUND", "Skills hub clone not found.");
  const catalog = (await listCatalogs(hubPath)).find((c) => c.name === catalogName);
  const skill = catalog?.skills.find((k) => k.name === skillName);
  if (!skill) {
    throw new AppError(
      "SKILL_NOT_FOUND",
      `Skill ${catalogName}/${skillName} not found in the hub.`,
    );
  }
  const raw = await readFile(path.join(skill.dir, "SKILL.md"), "utf-8");
  const frontmatter = FRONTMATTER_PATTERN.exec(raw)?.[1] ?? "";
  return {
    catalog: catalogName,
    name: skillName,
    description: readFrontmatterScalar(frontmatter, "description"),
    requiresSkills: readFrontmatterList(frontmatter, "requires-skills"),
    body: raw.replace(FRONTMATTER_PATTERN, "").trim(),
    files: (await listFilesRecursive(skill.dir)).filter((file) => file !== "SKILL.md"),
    dir: skill.dir,
  };
}

/** Points the app at an existing clone (`null` goes back to auto-detection). */
export async function setSkillsHubPath(rawPath: string | null): Promise<void> {
  if (rawPath === null || rawPath.trim() === "") {
    await updateSkillsHubPreferences({ path: null });
    return;
  }
  const resolved = expandHome(rawPath);
  const repoUrl = await resolveRepoUrl((await getUserPreferences()).skillsHub);
  if (!repoUrl) {
    throw new AppError("SKILLS_HUB_REPO_URL_MISSING", "The skills hub repo URL isn't set.");
  }
  if (!(await isHubRepo(resolved, repoUrl))) {
    throw new AppError(
      "SKILLS_HUB_INVALID_PATH",
      `${resolved} isn't a clone of the skills hub (needs a catalog/ folder and origin ${repoUrl}).`,
    );
  }
  await updateSkillsHubPreferences({ path: resolved });
}

export async function setSkillsHubFlags(
  flags: Partial<Pick<SkillsHubPreferences, "inviteDismissed">>,
): Promise<void> {
  await updateSkillsHubPreferences(flags);
}

/** Saves the hub repo URL ("" = not used). Clearing or changing it also forgets the clone path,
 *  which belonged to the previous repo. */
export async function setSkillsHubRepoUrl(repoUrl: string): Promise<void> {
  const prefs = (await getUserPreferences()).skillsHub;
  const next = repoUrl.trim();
  const samePath =
    prefs.path !== null &&
    next !== "" &&
    (await isHubRepo(expandHome(prefs.path), next).catch(() => false));
  await updateSkillsHubPreferences({ repoUrl: next, ...(samePath ? {} : { path: null }) });
}

/** `git clone` into `<parentDir>/<repo name>`, then remembers that path. Needs the user's own
 *  SSH access to the repo's host — failing fast (no prompt) when it's missing, so the UI can fall back
 *  to showing the command to run by hand. */
export async function cloneSkillsHub(parentDir: string): Promise<string> {
  const parent = expandHome(parentDir);
  if (!(await directoryExists(parent))) {
    throw new AppError("SKILLS_HUB_CLONE_PARENT_MISSING", `Folder not found: ${parent}`);
  }
  const repoUrl = await resolveRepoUrl((await getUserPreferences()).skillsHub);
  if (!repoUrl) {
    throw new AppError("SKILLS_HUB_REPO_URL_MISSING", "The skills hub repo URL isn't set.");
  }
  const target = path.join(parent, hubFolderName(repoUrl));
  if (await directoryExists(target)) {
    if (await isHubRepo(target, repoUrl)) {
      await updateSkillsHubPreferences({ path: target });
      return target;
    }
    throw new AppError("SKILLS_HUB_CLONE_TARGET_EXISTS", `${target} already exists.`);
  }
  try {
    await git(["clone", repoUrl, target], parent, CLONE_TIMEOUT_MS);
  } catch (err) {
    throw new AppError(
      "SKILLS_HUB_CLONE_FAILED",
      `git clone failed: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }
  await updateSkillsHubPreferences({ path: target });
  return target;
}
