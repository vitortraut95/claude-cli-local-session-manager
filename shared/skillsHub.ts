/** What to keep linked: whole catalogs (future skills included) plus individually picked skills,
 *  each as `<catalog>/<skill>`. */
export type SkillsSelection = { catalogs: string[]; skills: string[] };

export type HubSkill = { name: string; description: string; dir: string };

export type HubCatalog = { name: string; skills: HubSkill[] };

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

export type InstalledSkill = { name: string; description: string };

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
  /** Individually picked skills (`<catalog>/<skill>`), on top of `selectedCatalogs`. Both are
   *  inferred from what's linked until the user chooses (`inferSelection`). */
  selectedSkills: string[];
  /** True when the selection comes from the user's own explicit choice. */
  catalogsChosen: boolean;
  skills: SkillStatus[];
  userSkillsDir: string;
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
  /** Every skill Claude would load on this machine (folders and links in `userSkillsDir` with a
   *  SKILL.md), hub or not — the options for `taskTestSkill`. */
  installedSkills: InstalledSkill[];
};

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
