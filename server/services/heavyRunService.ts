import path from "node:path";
import { claudeSettingsPath, isHookInstalled, setHooks } from "../utils/claudeSettings.js";
import { REPO_ROOT } from "../utils/repoRoot.js";
import { posixShellQuote } from "./sessionService.js";
import type { HeavyRunHookStatus } from "../../shared/tasks.js";

/**
 * The `scripts/heavy-run-hook.mjs` PreToolUse hook in the user's `~/.claude/settings.json`, which
 * makes every Claude session run its tests through `scripts/heavy-run`. Installed/removed only on
 * request (Task queue window).
 */

const HOOK_SCRIPT = path.join(REPO_ROOT, "scripts", "heavy-run-hook.mjs");
const HOOK_MARKER = "heavy-run-hook.mjs";

export async function getHeavyRunHookStatus(): Promise<HeavyRunHookStatus> {
  return {
    installed: await isHookInstalled(HOOK_MARKER, ["PreToolUse"]),
    settingsPath: claudeSettingsPath(),
    heavyRunPath: path.join(REPO_ROOT, "scripts", "heavy-run"),
  };
}

export async function setHeavyRunHookInstalled(installed: boolean): Promise<HeavyRunHookStatus> {
  await setHooks(
    HOOK_MARKER,
    installed
      ? {
          PreToolUse: {
            matcher: "Bash",
            hooks: [{ type: "command", command: `node ${posixShellQuote(HOOK_SCRIPT)}` }],
          },
        }
      : null,
  );
  return getHeavyRunHookStatus();
}
