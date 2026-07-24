import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const NICKNAME_MAX_LENGTH = 100;

/**
 * Local nicknames, stored in this app's own sidecar file — never inside `~/.claude/projects/`,
 * since that's the Claude CLI's own data and this app doesn't write to it. A nickname is purely
 * a local label shown alongside a session's real (auto-derived) title in this app's own UI — it
 * never replaces that title, and has no effect on anything outside this app (e.g. a Warp tab's
 * title, which Claude Code itself controls — see CLAUDE.md's "local nickname" section for why
 * that can't be changed from here).
 */
function getNicknamesPath(): string {
  return path.join(os.homedir(), ".claude-session-manager", "custom-titles.json");
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

  const filePath = getNicknamesPath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(nicknames, null, 2), "utf8");
}
