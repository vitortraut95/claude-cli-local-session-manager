import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { REPO_ROOT } from "./repoRoot.js";

const NICKNAME_MAX_LENGTH = 100;

/**
 * Local nicknames, stored in this app's own gitignored sidecar file at the repo root (same
 * convention as `userPreferences.json`, so it's visible/editable/deletable right alongside the
 * project instead of buried in a dotfolder under the home directory) — never inside
 * `~/.claude/projects/`, since that's the Claude CLI's own data and this app doesn't write to it.
 * A nickname is purely a local label shown alongside a session's real (auto-derived) title in this
 * app's own UI — it never replaces that title, and has no effect on anything outside this app (e.g.
 * a Warp tab's title, which Claude Code itself controls — see CLAUDE.md's "local nickname" section
 * for why that can't be changed from here).
 */
function getNicknamesPath(): string {
  return path.join(REPO_ROOT, "custom-titles.json");
}

export async function getNicknames(): Promise<Record<string, string>> {
  try {
    const raw = await readFile(getNicknamesPath(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
    return {};
  } catch {
    return {};
  }
}

/** Blank/whitespace-only `nickname` clears the override. */
export async function setNickname(id: string, nickname: string): Promise<void> {
  const nicknames = await getNicknames();
  const trimmed = nickname.trim().slice(0, NICKNAME_MAX_LENGTH);

  if (trimmed) {
    nicknames[id] = trimmed;
  } else {
    delete nicknames[id];
  }

  await writeFile(getNicknamesPath(), JSON.stringify(nicknames, null, 2), "utf8");
}
