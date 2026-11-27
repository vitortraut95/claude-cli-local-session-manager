import {
  expandSelection,
  parseSkillRef,
  SKILL_PREFERENCES,
  skillId,
  type HubCatalog,
  type InstalledSkill,
  type SkillPreference,
  type SkillStatus,
  type SkillsHubIssue,
  type SkillsSelection,
} from "../../../shared/skillsHub.js";

/** What the skills modal lists as needing action; see `SkillsHubIssue`. */
export function computeSkillsHubIssues(
  catalogs: HubCatalog[],
  selection: SkillsSelection,
  statuses: SkillStatus[],
  installed: InstalledSkill[],
  preferences: Record<SkillPreference, string>,
): SkillsHubIssue[] {
  const issues: SkillsHubIssue[] = [];
  const statusById = new Map(
    statuses.map((status) => [skillId(status.catalog, status.name), status]),
  );

  const unlinked = statuses
    .filter((status) => status.state === "missing" || status.state === "broken")
    .map((status) => skillId(status.catalog, status.name));
  if (unlinked.length > 0) issues.push({ kind: "unlinked", skills: unlinked });

  const known = new Set(catalogs.flatMap((c) => c.skills.map((k) => skillId(c.name, k.name))));
  const checkRefs = (owner: string, refs: string[], defaultCatalog: string) => {
    for (const ref of refs) {
      const dependency = parseSkillRef(ref, defaultCatalog);
      if (!known.has(dependency)) {
        issues.push({ kind: "unknownDependency", skill: owner, dependency });
        continue;
      }
      const status = statusById.get(dependency);
      if (status?.state === "conflict") {
        issues.push({
          kind: "dependencyConflict",
          skill: owner,
          dependency,
          conflictWith: status.conflictWith ?? "",
        });
      }
    }
  };
  const wanted = expandSelection(catalogs, selection);
  for (const catalog of catalogs) {
    if (selection.catalogs.includes(catalog.name)) {
      checkRefs(catalog.name, catalog.requires ?? [], catalog.name);
    }
    for (const skill of catalog.skills) {
      const id = skillId(catalog.name, skill.name);
      if (wanted.has(id)) checkRefs(id, skill.requires ?? [], catalog.name);
    }
  }

  const installedNames = new Set(installed.map((skill) => skill.name));
  for (const preference of SKILL_PREFERENCES) {
    const name = preferences[preference];
    if (!name || installedNames.has(name)) continue;
    const owner = catalogs.find((c) => c.skills.some((k) => k.name === name));
    issues.push({
      kind: "preferenceSkillMissing",
      preference,
      skill: name,
      hubSkill: owner ? skillId(owner.name, name) : null,
    });
  }
  return issues;
}
