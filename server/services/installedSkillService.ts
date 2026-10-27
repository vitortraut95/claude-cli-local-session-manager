import { stat } from "node:fs/promises";
import path from "node:path";
import { getUserSkillsDir } from "./skillsHubService.js";
import { AppError } from "../utils/httpError.js";

/** A skill folder name as `/<name>` takes it — also keeps it from smuggling anything into the
 *  shell command or out of the skills folder. */
const SKILL_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

/** `skill` (a preference value), checked to be installed; null when none is chosen. Throws
 *  `notInstalledCode` when it isn't installed. */
export async function resolveInstalledSkill(
  skill: string,
  notInstalledCode: string,
): Promise<string | null> {
  const name = skill.trim();
  if (!name) return null;
  try {
    if (!SKILL_NAME_PATTERN.test(name)) throw new Error(`Invalid skill name: ${name}`);
    await stat(path.join(getUserSkillsDir(), name, "SKILL.md"));
  } catch (err) {
    throw new AppError(
      notInstalledCode,
      `The skill "${name}" isn't installed in ${getUserSkillsDir()}.`,
      { cause: err },
    );
  }
  return name;
}
