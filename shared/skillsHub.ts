/** What to keep linked: whole catalogs (future skills included) plus individually picked skills,
 *  each as `<catalog>/<skill>`. */
export type SkillsSelection = { catalogs: string[]; skills: string[] };

export type HubSkill = {
  name: string;
  description: string;
  dir: string;
  /** Its `requires-skills` as written (`[<catalog>/]<skill>[@<range>]`). Optional: an older
   *  backend omits it. */
  requires?: string[];
  /** `metadata.author`, split on commas. Optional: an older backend omits it. */
  authors?: string[];
  /** ISO date of the last hub commit touching the skill folder; null outside git. Optional: an
   *  older backend omits it. */
  updatedAt?: string | null;
};

export type HubCatalog = {
  name: string;
  skills: HubSkill[];
  /** `catalog/<name>/requires-skills`: skills of other catalogs the team uses, linked along with
   *  the whole catalog. Optional: an older backend omits it. */
  requires?: string[];
};

/**
 * - `linked`: the skills dir already links to this folder (an old path into the hub that resolves
 *   to it counts, and the next sync re-points it).
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
  /** Set when it's linked only because selected skills/catalogs depend on it (`<catalog>/<skill>`
   *  or `<catalog>`), not because it was picked. */
  requiredBy?: string[];
};

export type InstalledSkill = {
  name: string;
  description: string;
  /** Hub catalog (team) its folder lives in, from a link into `catalog/<name>/`; null = not from a
   *  hub. Optional: an older backend doesn't send it. */
  catalog?: string | null;
};

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
  /** What needs the user's action (see `SkillsHubIssue`); empty without a clone. Optional: an
   *  older backend omits it. */
  issues?: SkillsHubIssue[];
};

export type SkillDetails = {
  catalog: string;
  name: string;
  description: string;
  /** Other skills it declares it depends on (`requires-skills`). */
  requiresSkills: string[];
  /** `metadata.author` / `metadata.version` from the frontmatter; null when not set. Optional: an
   *  older backend omits them. */
  author?: string | null;
  version?: string | null;
  /** ISO date of the last hub commit touching the skill folder; null outside git. Optional: an
   *  older backend omits it. */
  updatedAt?: string | null;
  /** SKILL.md without its frontmatter (markdown). */
  body: string;
  /** Every other file in the skill folder (references, scripts), relative to it. */
  files: string[];
  /** Absolute path of the skill folder in the clone. */
  dir: string;
};

/** Preferences holding the name of an installed skill. */
export const SKILL_PREFERENCES = [
  "taskTestSkill",
  "taskReviewSkill",
  "taskRefinementSkill",
] as const;
export type SkillPreference = (typeof SKILL_PREFERENCES)[number];

/**
 * What the skills modal asks the user to act on. `unlinked` is fixed by applying the saved
 * selection; `preferenceSkillMissing` by installing `hubSkill` (when the hub has it); the others
 * need a hand outside the app. Skills are `<catalog>/<skill>`.
 */
export type SkillsHubIssue =
  | { kind: "unlinked"; skills: string[] }
  | { kind: "unknownDependency"; skill: string; dependency: string }
  | { kind: "dependencyConflict"; skill: string; dependency: string; conflictWith: string }
  | {
      kind: "preferenceSkillMissing";
      preference: SkillPreference;
      skill: string;
      hubSkill: string | null;
    };

export function skillId(catalog: string, skill: string): string {
  return `${catalog}/${skill}`;
}

/** A `requires-skills` entry (`[<catalog>/]<skill>[@<range>]`, maybe with a `# comment`) as
 *  `<catalog>/<skill>`; no catalog = the declaring one. The range isn't checked: the clone holds
 *  one version of each skill. */
export function parseSkillRef(raw: string, defaultCatalog: string): string {
  const id = raw
    .replace(/\s+#.*$/, "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .split("@")[0]!
    .trim();
  return id.includes("/") ? id : `${defaultCatalog}/${id}`;
}

/**
 * Every skill to keep linked, as `<catalog>/<skill>` → who pulled it in: `[]` when picked (or in a
 * whole picked catalog), otherwise the selected skills/catalogs that depend on it — `requires-skills`
 * of each linked skill (transitively) and `requires-skills` of each whole picked catalog. Refs to
 * skills the hub doesn't have are skipped.
 */
export function expandSelection(
  catalogs: HubCatalog[],
  selection: SkillsSelection,
): Map<string, string[]> {
  const skills = new Map<string, { catalog: string; requires: string[] }>();
  for (const catalog of catalogs) {
    for (const skill of catalog.skills) {
      skills.set(skillId(catalog.name, skill.name), {
        catalog: catalog.name,
        requires: skill.requires ?? [],
      });
    }
  }

  const result = new Map<string, string[]>();
  const queue: string[] = [];
  const add = (id: string, by: string | null) => {
    if (!skills.has(id)) return;
    const current = result.get(id);
    if (current === undefined) {
      result.set(id, by === null ? [] : [by]);
      queue.push(id);
    } else if (by !== null && current.length > 0 && !current.includes(by)) {
      current.push(by);
    }
  };

  for (const catalog of catalogs) {
    for (const skill of catalog.skills) {
      const id = skillId(catalog.name, skill.name);
      if (selection.catalogs.includes(catalog.name) || selection.skills.includes(id)) add(id, null);
    }
  }
  for (const catalog of catalogs.filter((c) => selection.catalogs.includes(c.name))) {
    for (const ref of catalog.requires ?? []) add(parseSkillRef(ref, catalog.name), catalog.name);
  }
  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    const skill = skills.get(id)!;
    for (const ref of skill.requires) add(parseSkillRef(ref, skill.catalog), id);
  }
  return result;
}

/** Skills picked by the user (a whole picked catalog counts), as `<catalog>/<skill>`. */
export function pickedSkillIds(catalogs: HubCatalog[], selection: SkillsSelection): Set<string> {
  const ids = new Set<string>();
  for (const catalog of catalogs) {
    for (const skill of catalog.skills) {
      const id = skillId(catalog.name, skill.name);
      if (selection.catalogs.includes(catalog.name) || selection.skills.includes(id)) ids.add(id);
    }
  }
  return ids;
}

/** Adds individual picks (skipping ones a whole picked catalog already covers). */
export function withPicks(selection: SkillsSelection, ids: string[]): SkillsSelection {
  const extra = ids.filter(
    (id) => !selection.skills.includes(id) && !selection.catalogs.includes(id.split("/")[0] ?? ""),
  );
  return { catalogs: selection.catalogs, skills: [...selection.skills, ...new Set(extra)] };
}

/** Removes picks: a `<catalog>/<skill>` or a whole `<catalog>`. Removing one skill of a whole
 *  picked catalog turns the catalog into individual picks of its other skills. */
export function withoutPicks(
  catalogs: HubCatalog[],
  selection: SkillsSelection,
  ids: string[],
): SkillsSelection {
  const removed = new Set(ids);
  const catalogsOut: string[] = [];
  const skills = selection.skills.filter((id) => !removed.has(id));
  for (const name of selection.catalogs) {
    if (removed.has(name)) continue;
    const catalog = catalogs.find((c) => c.name === name);
    const members = catalog?.skills.map((k) => skillId(name, k.name)) ?? [];
    if (members.some((id) => removed.has(id))) {
      skills.push(...members.filter((id) => !removed.has(id)));
    } else {
      catalogsOut.push(name);
    }
  }
  return { catalogs: catalogsOut, skills };
}

/** Dependencies `next` would link without the user having picked them, and that `current` didn't
 *  already link: what a new pick drags in. */
export function newDependencies(
  catalogs: HubCatalog[],
  current: SkillsSelection,
  next: SkillsSelection,
): string[] {
  const before = expandSelection(catalogs, current);
  const picked = pickedSkillIds(catalogs, next);
  return [...expandSelection(catalogs, next).keys()].filter(
    (id) => !picked.has(id) && !before.has(id),
  );
}

/**
 * What removing `removed` from `selection` implies: `dependents` = picked skills/catalogs that
 * (transitively) need one of them — they'd keep it linked, so they must go too; `orphans` = picked
 * skills only the removed ones (and their dependents) needed.
 */
export function removalImpact(
  catalogs: HubCatalog[],
  selection: SkillsSelection,
  removed: string[],
): { dependents: string[]; orphans: string[] } {
  const gone = new Set(removed);
  // A removed catalog takes its skills with it: who needs those counts too.
  for (const catalog of catalogs.filter((c) => gone.has(c.name))) {
    for (const skill of catalog.skills) gone.add(skillId(catalog.name, skill.name));
  }
  const dependents: string[] = [];
  for (;;) {
    const wanted = expandSelection(catalogs, withoutPicks(catalogs, selection, [...gone]));
    const blockers = [...gone].flatMap((id) => wanted.get(id) ?? []).filter((id) => !gone.has(id));
    if (blockers.length === 0) break;
    for (const id of new Set(blockers)) {
      gone.add(id);
      dependents.push(id);
      const catalog = catalogs.find((c) => c.name === id);
      for (const skill of catalog?.skills ?? []) gone.add(skillId(id, skill.name));
    }
  }
  const remaining = withoutPicks(catalogs, selection, [...gone]);
  const removedSkills = [...gone].filter(
    (id) => id.includes("/") && pickedSkillIds(catalogs, selection).has(id),
  );
  const removedCatalogs = [...gone].filter((id) => !id.includes("/"));
  const theirDeps = expandSelection(catalogs, { catalogs: removedCatalogs, skills: removedSkills });
  const candidates = [...pickedSkillIds(catalogs, remaining)].filter(
    (id) =>
      theirDeps.has(id) && !gone.has(id) && !remaining.catalogs.includes(id.split("/")[0] ?? ""),
  );
  const stillWanted = expandSelection(catalogs, withoutPicks(catalogs, remaining, candidates));
  // A dependent only linked as someone else's dependency goes away on its own: list the picks.
  const picked = pickedSkillIds(catalogs, selection);
  return {
    dependents: dependents.filter((id) => !id.includes("/") || picked.has(id)),
    orphans: candidates.filter((id) => !stillWanted.has(id)),
  };
}
