import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { HubCatalog, HubSkill, InstalledSkill } from "../../../shared/skillsHub.js";
import { getUserSkillsDir } from "./common.js";

export const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** A top-level scalar from SKILL.md's frontmatter — quoted/plain on one line, or a `|`/`>` block
 *  (indented lines below it). Not a YAML parser: just enough for `description`. */
export function readFrontmatterScalar(frontmatter: string, key: string): string {
  const lines = frontmatter.split(/\r?\n/);
  const index = lines.findIndex((line) => line.startsWith(`${key}:`));
  if (index === -1) return "";
  const inline = lines[index]!.slice(key.length + 1).trim();
  if (inline && !/^[|>][-+]?$/.test(inline)) {
    return inline.replace(/^["']|["']$/g, "").replace(/\\"/g, '"');
  }
  const block: string[] = [];
  for (const line of lines.slice(index + 1)) {
    if (line.trim() !== "" && !/^\s/.test(line)) break;
    block.push(line.trim());
  }
  return block.join(inline.startsWith("|") ? "\n" : " ").trim();
}

/** Top-level `key:` followed by `  - item` lines. */
export function readFrontmatterList(frontmatter: string, key: string): string[] {
  const lines = frontmatter.split(/\r?\n/);
  const index = lines.findIndex((line) => line.startsWith(`${key}:`));
  if (index === -1) return [];
  const items: string[] = [];
  for (const line of lines.slice(index + 1)) {
    const match = /^\s+-\s+(.+)$/.exec(line);
    if (!match) break;
    items.push(match[1]!.trim());
  }
  return items;
}

async function readSkillDescription(skillMdPath: string): Promise<string> {
  try {
    const raw = await readFile(skillMdPath, "utf-8");
    return readFrontmatterScalar(FRONTMATTER_PATTERN.exec(raw)?.[1] ?? "", "description");
  } catch {
    return "";
  }
}

/** Skill folders of one catalog: `skills/<name>/SKILL.md` and `<name>/SKILL.md` (both layouts
 *  exist). Folders marked deprecated are left out. */
async function listCatalogSkills(catalogDir: string): Promise<HubSkill[]> {
  const found = new Map<string, HubSkill>();
  for (const base of [path.join(catalogDir, "skills"), catalogDir]) {
    let entries;
    try {
      entries = await readdir(base, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      if (/deprecated/i.test(entry.name) || found.has(entry.name)) continue;
      const dir = path.join(base, entry.name);
      const skillMd = path.join(dir, "SKILL.md");
      try {
        await stat(skillMd);
      } catch {
        continue;
      }
      found.set(entry.name, {
        name: entry.name,
        description: await readSkillDescription(skillMd),
        dir,
      });
    }
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function listCatalogs(hubPath: string): Promise<HubCatalog[]> {
  const catalogRoot = path.join(hubPath, "catalog");
  let entries;
  try {
    entries = await readdir(catalogRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  const catalogs = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map(async (entry) => ({
        name: entry.name,
        skills: await listCatalogSkills(path.join(catalogRoot, entry.name)),
      })),
  );
  return catalogs.filter((c) => c.skills.length > 0).sort((a, b) => a.name.localeCompare(b.name));
}

/** Skills in `~/.claude/skills`: real folders or links (broken ones skipped, via `stat`) holding a
 *  SKILL.md. */
export async function listInstalledSkills(): Promise<InstalledSkill[]> {
  const dir = getUserSkillsDir();
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const skills = await Promise.all(
    names
      .filter((name) => !name.startsWith("."))
      .map(async (name) => {
        const skillMd = path.join(dir, name, "SKILL.md");
        try {
          await stat(skillMd);
        } catch {
          return null;
        }
        return { name, description: await readSkillDescription(skillMd) };
      }),
  );
  return skills
    .filter((skill): skill is InstalledSkill => skill !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}
