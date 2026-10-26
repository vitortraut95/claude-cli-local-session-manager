/**
 * Team skills from a shared skills repo ("the hub": a git repo with a `catalog/<catalog>/` tree of
 * skill folders), symlinked into the CLI's user-level skills dir (`~/.claude/skills`, or
 * `$CLAUDE_CONFIG_DIR/skills`). A pull in the clone updates linked skills in place; only new skills
 * need a link, which `syncSkillsHub` adds.
 *
 * Optional and non-blocking: no hub never blocks a task. Never forces the clone (the user may be
 * developing skills in it): only `fetch` + a fast-forward-only merge when clean. Never touches an
 * entry in the skills dir that isn't a link into the hub's `catalog/`.
 */

export { getUserSkillsDir } from "./skillsHub/common.js";
export { detectHubRepoUrl } from "./skillsHub/locate.js";
export { getSkillsHubStatus } from "./skillsHub/status.js";
export {
  autoUpdateSkillsHubOnStart,
  setSkillsHubSelection,
  syncSkillsHub,
} from "./skillsHub/sync.js";
export { getSkillDetails } from "./skillsHub/skillDetails.js";
export {
  cloneSkillsHub,
  openSkillsFolder,
  setSkillsHubPath,
  setSkillsHubRepoUrl,
} from "./skillsHub/setup.js";
