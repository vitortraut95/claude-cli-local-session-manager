import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const TITLE_MAX_LENGTH = 100;

/**
 * Custom session titles set via "Rename", stored in this app's own sidecar file — never inside
 * `~/.claude/projects/`, since that's the Claude CLI's own data and this app doesn't write to it.
 */
function getTitleOverridesPath(): string {
  return path.join(os.homedir(), ".claude-session-manager", "custom-titles.json");
}

export async function getCustomTitles(): Promise<Record<string, string>> {
  try {
    const raw = await readFile(getTitleOverridesPath(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
    return {};
  } catch {
    return {};
  }
}

/** Blank/whitespace-only `title` clears the override, reverting to the auto-derived title. */
export async function setCustomTitle(id: string, title: string): Promise<void> {
  const titles = await getCustomTitles();
  const trimmed = title.trim().slice(0, TITLE_MAX_LENGTH);

  if (trimmed) {
    titles[id] = trimmed;
  } else {
    delete titles[id];
  }

  const filePath = getTitleOverridesPath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(titles, null, 2), "utf8");
}
