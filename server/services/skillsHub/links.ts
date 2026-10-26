import { lstat, mkdir, readdir, readlink, stat, symlink, unlink } from "node:fs/promises";
import path from "node:path";
import type { HubCatalog, SkillStatus, SkillsSelection } from "../../../shared/skillsHub.js";
import { AppError } from "../../utils/httpError.js";
import type { SkillsHubPreferences } from "../preferencesService.js";
import { getUserSkillsDir } from "./common.js";

type LinkEntry =
  { kind: "absent" } | { kind: "link"; target: string; targetExists: boolean } | { kind: "other" };

async function inspectEntry(entryPath: string): Promise<LinkEntry> {
  let info;
  try {
    info = await lstat(entryPath);
  } catch {
    return { kind: "absent" };
  }
  if (!info.isSymbolicLink()) return { kind: "other" };
  const target = path.resolve(path.dirname(entryPath), await readlink(entryPath));
  let targetExists = true;
  try {
    await stat(entryPath);
  } catch {
    targetExists = false;
  }
  return { kind: "link", target, targetExists };
}

function isInside(child: string, parent: string): boolean {
  const relative = path.relative(parent, child);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function skillId(catalog: string, skill: string): string {
  return `${catalog}/${skill}`;
}

function isSelected(selection: SkillsSelection, catalog: string, skill: string): boolean {
  return selection.catalogs.includes(catalog) || selection.skills.includes(skillId(catalog, skill));
}

/** Drops catalogs/skills that no longer exist in the hub, and individual picks already covered by
 *  a whole-catalog pick. */
export function normalizeSelection(
  catalogs: HubCatalog[],
  selection: SkillsSelection,
): SkillsSelection {
  const known = new Set(catalogs.map((c) => c.name));
  const wholeCatalogs = [...new Set(selection.catalogs)].filter((name) => known.has(name));
  const knownSkills = new Set(
    catalogs.flatMap((c) => c.skills.map((k) => skillId(c.name, k.name))),
  );
  const skills = [...new Set(selection.skills)].filter(
    (id) => knownSkills.has(id) && !wholeCatalogs.includes(id.split("/")[0] ?? ""),
  );
  return { catalogs: wholeCatalogs, skills };
}

export async function computeSkillStatuses(
  hubPath: string,
  catalogs: HubCatalog[],
  selection: SkillsSelection,
): Promise<SkillStatus[]> {
  const skillsDir = getUserSkillsDir();
  const catalogRoot = path.join(hubPath, "catalog");
  const owner = new Map<string, string>();
  const statuses: SkillStatus[] = [];
  for (const catalog of catalogs) {
    for (const skill of catalog.skills.filter((k) => isSelected(selection, catalog.name, k.name))) {
      const base = { name: skill.name, catalog: catalog.name, description: skill.description };
      const firstOwner = owner.get(skill.name);
      if (firstOwner) {
        statuses.push({ ...base, state: "conflict", conflictWith: `catalog:${firstOwner}` });
        continue;
      }
      owner.set(skill.name, catalog.name);
      const entry = await inspectEntry(path.join(skillsDir, skill.name));
      if (entry.kind === "absent") {
        statuses.push({ ...base, state: "missing" });
      } else if (entry.kind === "link" && path.resolve(entry.target) === path.resolve(skill.dir)) {
        statuses.push({ ...base, state: entry.targetExists ? "linked" : "broken" });
      } else if (
        entry.kind === "link" &&
        isInside(entry.target, catalogRoot) &&
        !entry.targetExists
      ) {
        statuses.push({ ...base, state: "broken" });
      } else {
        statuses.push({
          ...base,
          state: "conflict",
          conflictWith: entry.kind === "link" ? entry.target : path.join(skillsDir, skill.name),
        });
      }
    }
  }
  return statuses;
}

/** The selection until the user chooses: a fully linked catalog counts as whole, otherwise its
 *  linked skills count individually — so nothing linked by hand gets undone. */
async function inferSelection(catalogs: HubCatalog[]): Promise<SkillsSelection> {
  const skillsDir = getUserSkillsDir();
  const selection: SkillsSelection = { catalogs: [], skills: [] };
  for (const catalog of catalogs) {
    const linked: string[] = [];
    for (const skill of catalog.skills) {
      const entry = await inspectEntry(path.join(skillsDir, skill.name));
      if (entry.kind === "link" && path.resolve(entry.target) === path.resolve(skill.dir)) {
        linked.push(skill.name);
      }
    }
    if (linked.length > 0 && linked.length === catalog.skills.length) {
      selection.catalogs.push(catalog.name);
    } else {
      selection.skills.push(...linked.map((name) => skillId(catalog.name, name)));
    }
  }
  return selection;
}

export async function resolveSelection(
  catalogs: HubCatalog[],
  prefs: SkillsHubPreferences,
): Promise<SkillsSelection> {
  return prefs.catalogs !== null
    ? normalizeSelection(catalogs, { catalogs: prefs.catalogs, skills: prefs.skills })
    : inferSelection(catalogs);
}

export type LinkResult = { linked: string[]; unlinked: string[]; conflicts: string[] };

/**
 * Brings `~/.claude/skills` in line with the selection: links `missing` skills, re-points
 * `broken` ones, and removes links into the hub whose target vanished. With `pruneUnselected`
 * (only after an explicit choice), it also removes links to hub skills no longer selected.
 * Anything that isn't a link into this hub's `catalog/` is never touched.
 */
export async function applyLinks(
  hubPath: string,
  catalogs: HubCatalog[],
  selection: SkillsSelection,
  pruneUnselected: boolean,
): Promise<LinkResult> {
  const skillsDir = getUserSkillsDir();
  const catalogRoot = path.join(hubPath, "catalog");
  const result: LinkResult = { linked: [], unlinked: [], conflicts: [] };

  try {
    await mkdir(skillsDir, { recursive: true });
  } catch (err) {
    throw new AppError("SKILLS_DIR_UNWRITABLE", `Can't create ${skillsDir}.`, { cause: err });
  }

  const wanted = new Map<string, string>();
  for (const status of await computeSkillStatuses(hubPath, catalogs, selection)) {
    const skill = catalogs
      .find((c) => c.name === status.catalog)
      ?.skills.find((s) => s.name === status.name);
    if (!skill) continue;
    if (status.state === "conflict") {
      result.conflicts.push(status.name);
      continue;
    }
    wanted.set(skill.name, skill.dir);
    const dest = path.join(skillsDir, skill.name);
    if (status.state === "broken") {
      await unlink(dest);
    }
    if (status.state === "missing" || status.state === "broken") {
      await symlink(skill.dir, dest);
      result.linked.push(skill.name);
    }
  }

  const entries = await readdir(skillsDir).catch(() => [] as string[]);
  for (const name of entries) {
    if (wanted.has(name)) continue;
    const entryPath = path.join(skillsDir, name);
    const entry = await inspectEntry(entryPath);
    if (entry.kind !== "link" || !isInside(entry.target, catalogRoot)) continue;
    if (!entry.targetExists || pruneUnselected) {
      await unlink(entryPath);
      result.unlinked.push(name);
    }
  }
  return result;
}
