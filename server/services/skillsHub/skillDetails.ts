import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { SkillDetails } from "../../../shared/skillsHub.js";
import { tryGit } from "../../utils/git.js";
import { AppError, NotFoundError } from "../../utils/httpError.js";
import { getUserPreferences } from "../preferencesService.js";
import {
  FRONTMATTER_PATTERN,
  listCatalogs,
  readFrontmatterList,
  readFrontmatterNestedScalar,
  readFrontmatterScalar,
} from "./catalog.js";
import { locateHub, resolveRepoUrl } from "./locate.js";

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

/** ISO date of the last commit touching `dir`; null when git has none (or isn't there). */
async function lastCommitDate(dir: string): Promise<string | null> {
  const date = await tryGit(["log", "-1", "--format=%cI", "--", "."], dir);
  return date && date.length > 0 ? date : null;
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
    throw new NotFoundError(
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
    author: readFrontmatterNestedScalar(frontmatter, "metadata", "author"),
    version: readFrontmatterNestedScalar(frontmatter, "metadata", "version"),
    updatedAt: await lastCommitDate(skill.dir),
    body: raw.replace(FRONTMATTER_PATTERN, "").trim(),
    files: (await listFilesRecursive(skill.dir)).filter((file) => file !== "SKILL.md"),
    dir: skill.dir,
  };
}
