import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { getUserSkillsDir, listInstalledSkills } from "./skillsHubService.js";
import { updateUserPreferences } from "./preferencesService.js";
import {
  FRONTMATTER_PATTERN,
  parseSkillRef,
  readFrontmatterList,
} from "./skillsHub/catalog.js";
import { AppError } from "../utils/httpError.js";

/** A skill folder name as `/<name>` takes it — also keeps it from smuggling anything into the
 *  shell command or out of the skills folder. */
const SKILL_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

/** Preferences holding the name of an installed skill. */
type SkillPreferenceKey = "taskTestSkill" | "taskRefinementSkill";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Names of the skills an installed skill declares in `requires-skills`. */
async function requiredNames(name: string): Promise<string[]> {
  try {
    const raw = await readFile(path.join(getUserSkillsDir(), name, "SKILL.md"), "utf-8");
    const frontmatter = FRONTMATTER_PATTERN.exec(raw)?.[1] ?? "";
    return readFrontmatterList(frontmatter, "requires-skills").map(
      (ref) => parseSkillRef(ref, "").split("/").pop()!,
    );
  } catch {
    return [];
  }
}

/** The installed skill whose description says it was renamed from `name` ("antes chamada X",
 *  "formerly X", "previously called X"). When a skill was split (a generic one plus a team profile
 *  that requires it), the most specific wins: the one no other match depends on. Null unless that
 *  leaves exactly one. */
async function findRenamedSkill(name: string): Promise<string | null> {
  const pattern = new RegExp(
    `(?:antes chamada|formerly(?: called)?|previously called|renamed from)\\s+[^)]*?(?<![\\w-])${escapeRegExp(name)}(?![\\w-])`,
    "i",
  );
  const matches = (await listInstalledSkills())
    .filter((skill) => pattern.test(skill.description))
    .map((skill) => skill.name);
  if (matches.length <= 1) return matches[0] ?? null;
  const required = new Set((await Promise.all(matches.map(requiredNames))).flat());
  const specific = matches.filter((name) => !required.has(name));
  return specific.length === 1 ? specific[0]! : null;
}

export async function isInstalled(name: string): Promise<boolean> {
  if (!SKILL_NAME_PATTERN.test(name)) return false;
  try {
    await stat(path.join(getUserSkillsDir(), name, "SKILL.md"));
    return true;
  } catch {
    return false;
  }
}

/** `skill` (the value of `preference`), checked to be installed; null when none is chosen. A skill
 *  renamed in the hub is followed and the preference updated. Throws `notInstalledCode` when it
 *  isn't installed. */
export async function resolveInstalledSkill(
  skill: string,
  notInstalledCode: string,
  preference: SkillPreferenceKey,
): Promise<string | null> {
  const name = skill.trim();
  if (!name) return null;
  if (SKILL_NAME_PATTERN.test(name)) {
    if (await isInstalled(name)) return name;
    const renamed = await findRenamedSkill(name);
    if (renamed) {
      await updateUserPreferences((prefs) => ({ ...prefs, [preference]: renamed }));
      console.log(`[skills] "${name}" was renamed to "${renamed}": ${preference} updated`);
      return renamed;
    }
  }
  throw new AppError(
    notInstalledCode,
    `The skill "${name}" isn't installed in ${getUserSkillsDir()}.`,
  );
}
