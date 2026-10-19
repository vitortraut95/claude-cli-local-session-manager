import axios from "axios";
import { withServerErrorMessage } from "../utils/apiClient";

const client = axios.create({
  baseURL: "/tasks",
});

// Team skills hub. Optional from the UI's point of view: a failure (or a 404 from an older
// backend) only hides the skills panel, never blocks a task.

export type HubSkill = { name: string; description: string; dir: string };
export type HubCatalog = { name: string; skills: HubSkill[] };
export type SkillLinkState = "linked" | "missing" | "broken" | "conflict";
export type SkillStatus = {
  name: string;
  catalog: string;
  description: string;
  state: SkillLinkState;
  conflictWith?: string;
};

export type SkillsHubStatus = {
  found: boolean;
  path: string | null;
  configuredPathInvalid: boolean;
  branch: string | null;
  defaultBranch: string | null;
  upstream: string | null;
  dirty: boolean;
  behind: number | null;
  ahead: number | null;
  catalogs: HubCatalog[];
  /** Whole catalogs (future skills included). */
  selectedCatalogs: string[];
  /** Individually picked skills, as `<catalog>/<skill>`. */
  selectedSkills: string[];
  catalogsChosen: boolean;
  skills: SkillStatus[];
  userSkillsDir: string;
  /** Null = no hub repo configured (the modal asks for the URL first). */
  cloneUrl: string | null;
  /** True while `cloneUrl` was detected from an existing clone, not saved. */
  repoUrlDetected?: boolean;
  /** The user said there's no hub (`repoUrl` saved as ""). */
  notUsed?: boolean;
  webUrl: string;
  /** Folder name a clone gets. Absent on older backends. */
  cloneFolderName?: string;
  cloneParentDirs: string[];
  /** Every skill in `userSkillsDir` (hub or not). Absent on older backends. */
  installedSkills?: InstalledSkill[];
};

export type InstalledSkill = { name: string; description: string };

type SkillsLinkResult = { linked: string[]; unlinked: string[]; conflicts: string[] };

export type SkillsHubSyncResult = {
  status: SkillsHubStatus;
  fetched: boolean;
  fetchError: string | null;
  pulledCommits: number;
  pullSkippedReason: "dirty" | "diverged" | "failed" | null;
  links: SkillsLinkResult;
};

export async function fetchSkillsHubStatus(): Promise<SkillsHubStatus> {
  const { data } = await withServerErrorMessage(() =>
    client.get<SkillsHubStatus>("/skills-hub/status"),
  );
  return data;
}

/** Opens the hub clone or `~/.claude/skills` in the file manager (resolved server-side). */
export async function openSkillsFolder(target: "hub" | "userSkills"): Promise<void> {
  await withServerErrorMessage(() => client.post("/skills-hub/open-folder", { target }));
}

export async function syncSkillsHub(): Promise<SkillsHubSyncResult> {
  const { data } = await withServerErrorMessage(() =>
    client.post<SkillsHubSyncResult>("/skills-hub/sync"),
  );
  return data;
}

export async function cloneSkillsHub(parentDir: string): Promise<{ path: string }> {
  const { data } = await withServerErrorMessage(() =>
    client.post<{ path: string }>("/skills-hub/clone", { parentDir }),
  );
  return data;
}

export type SkillDetails = {
  catalog: string;
  name: string;
  description: string;
  requiresSkills: string[];
  /** SKILL.md without its frontmatter (markdown). */
  body: string;
  files: string[];
  dir: string;
};

export async function fetchSkillDetails(catalog: string, name: string): Promise<SkillDetails> {
  const { data } = await withServerErrorMessage(() =>
    client.get<SkillDetails>("/skills-hub/skill", { params: { catalog, name } }),
  );
  return data;
}

export type SkillsSelection = { catalogs: string[]; skills: string[] };

export async function setSkillsHubSelection(selection: SkillsSelection): Promise<SkillsLinkResult> {
  const { data } = await withServerErrorMessage(() =>
    client.put<SkillsLinkResult>("/skills-hub/selection", selection),
  );
  return data;
}

/** "" = not used. Changing it also forgets the clone path of the previous repo. */
export async function setSkillsHubRepoUrl(repoUrl: string): Promise<void> {
  await withServerErrorMessage(() => client.put("/skills-hub/repo-url", { repoUrl }));
}

/** The `origin` of a hub clone already on this machine — the startup prompt's prefill. */
export async function fetchDetectedHubRepoUrl(): Promise<string | null> {
  const { data } = await withServerErrorMessage(() =>
    client.get<{ repoUrl: string | null }>("/skills-hub/detected-repo-url"),
  );
  return data.repoUrl;
}

export async function setSkillsHubPath(path: string | null): Promise<void> {
  await withServerErrorMessage(() => client.put("/skills-hub/path", { path }));
}

/** Fired after anything changes the hub setup, so every `useSkillsHubStatus` reloads. */
export const SKILLS_HUB_CHANGED_EVENT = "skills-hub-changed";

export function notifySkillsHubChanged(): void {
  window.dispatchEvent(new Event(SKILLS_HUB_CHANGED_EVENT));
}
