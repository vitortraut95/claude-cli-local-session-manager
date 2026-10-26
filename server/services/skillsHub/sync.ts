import type { SkillsHubStatus, SkillsSelection } from "../../../shared/skillsHub.js";
import { runGit } from "../../utils/git.js";
import { AppError, errorMessage } from "../../utils/httpError.js";
import { getUserPreferences } from "../preferencesService.js";
import { listCatalogs } from "./catalog.js";
import { HUB_GIT, updateSkillsHubPreferences } from "./common.js";
import { applyLinks, normalizeSelection, resolveSelection, type LinkResult } from "./links.js";
import { getSkillsHubStatus, readGitState } from "./status.js";

type SyncResult = {
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
 *  share one run instead of racing on the same clone. */
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
    await runGit(["fetch", "--prune", "origin"], hubPath, HUB_GIT);
  } catch (err) {
    fetched = false;
    fetchError = errorMessage(err);
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
        await runGit(["merge", "--ff-only", "@{u}"], hubPath, HUB_GIT);
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

/** Saves an explicit selection and applies it, unlinking deselected hub skills (only links into
 *  the hub). */
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

/** Background `syncSkillsHub` on server start; skipped when the hub isn't used/cloned or
 *  `autoUpdateOnStart` is off. Never throws, only logs. */
export async function autoUpdateSkillsHubOnStart(): Promise<void> {
  try {
    const prefs = (await getUserPreferences()).skillsHub;
    if (!prefs.autoUpdateOnStart || prefs.repoUrl === "") return;
    const status = await getSkillsHubStatus();
    if (!status.found) return;
    const result = await syncSkillsHub();
    const parts = [
      result.fetched ? null : `fetch failed (${result.fetchError ?? "unknown"})`,
      result.pulledCommits > 0 ? `pulled ${result.pulledCommits} commit(s)` : null,
      result.pullSkippedReason ? `update skipped: ${result.pullSkippedReason}` : null,
      result.links.linked.length > 0 ? `linked ${result.links.linked.length} new skill(s)` : null,
    ].filter((part): part is string => part !== null);
    console.log(
      `[skills] startup auto-update: ${parts.length > 0 ? parts.join(", ") : "up to date"}`,
    );
  } catch (err) {
    console.warn(`[skills] startup auto-update failed: ${errorMessage(err)}`);
  }
}
