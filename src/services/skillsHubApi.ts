import axios from "axios";
import { withServerErrorMessage } from "../utils/apiClient";
import type { SkillDetails, SkillsHubStatus, SkillsSelection } from "../../shared/skillsHub";
export type {
  HubCatalog,
  HubSkill,
  InstalledSkill,
  SkillDetails,
  SkillLinkState,
  SkillStatus,
  SkillsHubStatus,
  SkillsSelection,
} from "../../shared/skillsHub";

const client = axios.create({
  baseURL: "/tasks",
});

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

export async function fetchSkillDetails(catalog: string, name: string): Promise<SkillDetails> {
  const { data } = await withServerErrorMessage(() =>
    client.get<SkillDetails>("/skills-hub/skill", { params: { catalog, name } }),
  );
  return data;
}

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
