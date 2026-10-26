import type { SkillsHubStatus } from "../../../shared/skillsHub.js";
import { tryGit } from "../../utils/git.js";
import { getUserPreferences } from "../preferencesService.js";
import { expandHome } from "../workspaceService.js";
import { listCatalogs, listInstalledSkills } from "./catalog.js";
import { getUserSkillsDir, HUB_GIT } from "./common.js";
import { computeSkillStatuses, resolveSelection } from "./links.js";
import {
  getCloneParentDirs,
  hubFolderName,
  hubWebUrl,
  locateHub,
  resolveRepoUrl,
} from "./locate.js";

export async function readGitState(hubPath: string) {
  const [branch, originHead, upstream, porcelain] = await Promise.all([
    tryGit(["symbolic-ref", "--short", "-q", "HEAD"], hubPath, HUB_GIT),
    tryGit(["symbolic-ref", "--short", "-q", "refs/remotes/origin/HEAD"], hubPath, HUB_GIT),
    tryGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], hubPath, HUB_GIT),
    tryGit(["status", "--porcelain", "--untracked-files=no"], hubPath, HUB_GIT),
  ]);
  let behind: number | null = null;
  let ahead: number | null = null;
  if (upstream) {
    const counts = await tryGit(
      ["rev-list", "--left-right", "--count", "HEAD...@{u}"],
      hubPath,
      HUB_GIT,
    );
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

export async function getSkillsHubStatus(): Promise<SkillsHubStatus> {
  const prefs = (await getUserPreferences()).skillsHub;
  const repoUrl = await resolveRepoUrl(prefs);
  const hubPath = await locateHub(prefs, repoUrl);
  const common = {
    userSkillsDir: getUserSkillsDir(),
    cloneUrl: repoUrl,
    repoUrlDetected: prefs.repoUrl === null && repoUrl !== null,
    notUsed: prefs.repoUrl === "",
    webUrl: repoUrl ? hubWebUrl(repoUrl) : "",
    cloneFolderName: repoUrl ? hubFolderName(repoUrl) : "",
    cloneParentDirs: await getCloneParentDirs(),
    installedSkills: await listInstalledSkills(),
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
