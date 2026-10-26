import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AppError } from "./httpError.js";

/** Hooks this app installs in the user's `~/.claude/settings.json`; the rest of the file is kept
 *  as is. Each hook is recognized by a marker in its command (its script's file name). */

type HookCommand = { type: string; command?: string; timeout?: number };
export type HookMatcher = { matcher?: string; hooks?: HookCommand[] };
type ClaudeSettings = { hooks?: Record<string, HookMatcher[] | undefined> } & Record<
  string,
  unknown
>;

export function claudeSettingsPath(): string {
  return path.join(os.homedir(), ".claude", "settings.json");
}

async function readSettings(): Promise<ClaudeSettings> {
  let raw: string;
  try {
    raw = await readFile(claudeSettingsPath(), "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw err;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as ClaudeSettings;
    }
  } catch {
    // Falls through: never overwrite a file we can't read back.
  }
  throw new AppError(
    "CLAUDE_SETTINGS_UNREADABLE",
    `${claudeSettingsPath()} isn't valid JSON — fix it by hand before installing the hook.`,
  );
}

async function writeSettings(settings: ClaudeSettings): Promise<void> {
  const target = claudeSettingsPath();
  await mkdir(path.dirname(target), { recursive: true });
  const tmpPath = `${target}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmpPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  await rename(tmpPath, target);
}

function hasMarker(matcher: HookMatcher, marker: string): boolean {
  return (matcher.hooks ?? []).some((hook) => hook.command?.includes(marker));
}

/** Whether every one of `events` has a hook whose command contains `marker`. */
export async function isHookInstalled(marker: string, events: string[]): Promise<boolean> {
  const settings = await readSettings().catch((): ClaudeSettings => ({}));
  return events.every((event) =>
    (settings.hooks?.[event] ?? []).some((matcher) => hasMarker(matcher, marker)),
  );
}

/**
 * Replaces this marker's hooks with `entries` (per event), or removes them all when `entries` is
 * null. Idempotent; reinstalling also refreshes the command (e.g. after the app folder moved).
 */
export async function setHooks(
  marker: string,
  entries: Record<string, HookMatcher> | null,
): Promise<void> {
  const settings = await readSettings();
  const hooks = { ...settings.hooks };
  const events = new Set([...Object.keys(hooks), ...Object.keys(entries ?? {})]);
  for (const event of events) {
    const others = (hooks[event] ?? []).filter((matcher) => !hasMarker(matcher, marker));
    const entry = entries?.[event];
    const next = entry ? [...others, entry] : others;
    if (next.length > 0) hooks[event] = next;
    else delete hooks[event];
  }
  const next: ClaudeSettings = { ...settings, hooks };
  if (Object.keys(hooks).length === 0) delete next.hooks;
  await writeSettings(next);
}
