import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { cloneRepository } from "../../utils/git.js";
import { AppError, BadRequestError, errorMessage } from "../../utils/httpError.js";
import { getUserPreferences } from "../preferencesService.js";
import { directoryExists } from "../sessionService.js";
import { expandHome } from "../workspaceService.js";
import { getUserSkillsDir, updateSkillsHubPreferences } from "./common.js";
import { hubFolderName, isHubRepo, locateHub, resolveRepoUrl } from "./locate.js";
import { syncSkillsHub } from "./sync.js";

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
    throw new BadRequestError(
      "SKILLS_HUB_INVALID_PATH",
      `${resolved} isn't a clone of the skills hub (needs a catalog/ folder and origin ${repoUrl}).`,
    );
  }
  await updateSkillsHubPreferences({ path: resolved });
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

/** `git clone` into `<parentDir>/<repo name>`, then remembers that path. Fails fast (no prompt)
 *  without SSH access, so the UI can show the command to run by hand. */
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
    await cloneRepository(repoUrl, target);
  } catch (err) {
    throw new AppError("SKILLS_HUB_CLONE_FAILED", `git clone failed: ${errorMessage(err)}`, {
      cause: err,
    });
  }
  await updateSkillsHubPreferences({ path: target });
  // Links an already-saved selection (e.g. from an imported config file).
  await syncSkillsHub().catch(() => undefined);
  return target;
}

type SkillsFolderTarget = "hub" | "userSkills";

/** Opens the hub clone or the CLI's user-level skills dir in the desktop's file manager
 *  (`xdg-open`). The folder is resolved here, never taken from the caller. */
export async function openSkillsFolder(target: SkillsFolderTarget): Promise<string> {
  let dir: string;
  if (target === "hub") {
    const prefs = (await getUserPreferences()).skillsHub;
    const hubPath = await locateHub(prefs, await resolveRepoUrl(prefs));
    if (!hubPath) throw new AppError("SKILLS_HUB_NOT_FOUND", "Skills hub clone not found.");
    dir = hubPath;
  } else {
    dir = getUserSkillsDir();
    try {
      await mkdir(dir, { recursive: true });
    } catch (err) {
      throw new AppError("SKILLS_DIR_UNWRITABLE", `Can't create ${dir}.`, { cause: err });
    }
  }
  await new Promise<void>((resolve, reject) => {
    const child = spawn("xdg-open", [dir], { detached: true, stdio: "ignore" });
    child.once("error", (err) =>
      reject(new AppError("SKILLS_FOLDER_OPEN_FAILED", `Couldn't open ${dir}.`, { cause: err })),
    );
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
  return dir;
}
