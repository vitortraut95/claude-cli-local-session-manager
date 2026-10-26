import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AppError } from "../utils/httpError.js";
import { REPO_ROOT } from "../utils/repoRoot.js";
import { posixShellQuote } from "./sessionService.js";
import type { HeavyRunHookStatus } from "../../shared/tasks.js";

/**
 * The `scripts/heavy-run-hook.mjs` PreToolUse hook in the user's `~/.claude/settings.json`, which
 * makes every Claude session run its tests through `scripts/heavy-run`. Installed/removed only on
 * request (Task queue window); the rest of the file is kept as is.
 */

const HOOK_SCRIPT = path.join(REPO_ROOT, "scripts", "heavy-run-hook.mjs");
const HOOK_MARKER = "heavy-run-hook.mjs";

type HookCommand = { type: string; command?: string };
type HookMatcher = { matcher?: string; hooks?: HookCommand[] };
type ClaudeSettings = { hooks?: Record<string, HookMatcher[] | undefined> } & Record<
  string,
  unknown
>;

function settingsPath(): string {
  return path.join(os.homedir(), ".claude", "settings.json");
}

async function readSettings(): Promise<ClaudeSettings> {
  let raw: string;
  try {
    raw = await readFile(settingsPath(), "utf8");
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
    `${settingsPath()} isn't valid JSON — fix it by hand before installing the hook.`,
  );
}

async function writeSettings(settings: ClaudeSettings): Promise<void> {
  const target = settingsPath();
  await mkdir(path.dirname(target), { recursive: true });
  const tmpPath = `${target}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmpPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  await rename(tmpPath, target);
}

function isOurHook(matcher: HookMatcher): boolean {
  return (matcher.hooks ?? []).some((hook) => hook.command?.includes(HOOK_MARKER));
}

export async function getHeavyRunHookStatus(): Promise<HeavyRunHookStatus> {
  const settings = await readSettings().catch((): ClaudeSettings => ({}));
  return {
    installed: (settings.hooks?.PreToolUse ?? []).some(isOurHook),
    settingsPath: settingsPath(),
    heavyRunPath: path.join(REPO_ROOT, "scripts", "heavy-run"),
  };
}

/** Idempotent; reinstalling also refreshes the script path (e.g. after the app folder moved). */
export async function setHeavyRunHookInstalled(installed: boolean): Promise<HeavyRunHookStatus> {
  const settings = await readSettings();
  const others = (settings.hooks?.PreToolUse ?? []).filter((matcher) => !isOurHook(matcher));
  const preToolUse = installed
    ? [
        ...others,
        {
          matcher: "Bash",
          hooks: [{ type: "command", command: `node ${posixShellQuote(HOOK_SCRIPT)}` }],
        },
      ]
    : others;

  const hooks = { ...settings.hooks };
  if (preToolUse.length > 0) hooks.PreToolUse = preToolUse;
  else delete hooks.PreToolUse;
  const next: ClaudeSettings = { ...settings, hooks };
  if (Object.keys(hooks).length === 0) delete next.hooks;

  await writeSettings(next);
  return getHeavyRunHookStatus();
}
