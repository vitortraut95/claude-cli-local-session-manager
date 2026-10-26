import path from "node:path";
import { API_PORT } from "../utils/apiPort.js";
import { recordEvent } from "../utils/history.js";
import { isHookInstalled, setHooks } from "../utils/claudeSettings.js";
import { REPO_ROOT } from "../utils/repoRoot.js";
import { getUserPreferences } from "./preferencesService.js";
import { posixShellQuote } from "./session/shell.js";
import { getClaudeUsageStatus } from "./usageService.js";
import type { UsageGate, UsagePauseHookStatus } from "../../shared/tasks.js";

/**
 * Pauses running Claude sessions near the plan limits. `scripts/usage-pause-hook.mjs` runs before
 * every tool call (PreToolUse) and keeps asking `checkUsageGate` until it says go, so the session
 * sits still mid-step, spending nothing, and carries on by itself once the limit resets (or its %
 * is raised). Typing "destravar" in a session (UserPromptSubmit) lets that one through until the
 * next reset. Usage comes from the cached `getClaudeUsageStatus` (refreshed every 5 min); when it
 * can't be read the gate stays open. Pauses and resumes go to `history.jsonl` (`usage.*`).
 */

const HOOK_SCRIPT = path.join(REPO_ROOT, "scripts", "usage-pause-hook.mjs");
const HOOK_MARKER = "usage-pause-hook.mjs";
const HOOK_EVENTS = ["PreToolUse", "UserPromptSubmit"];
/** The hook waits as long as the pause lasts; a weekly limit can take days to reset. */
const HOOK_TIMEOUT_S = 7 * 24 * 60 * 60;
/** A waiting session asks about once a minute; one not asking for longer stopped waiting. */
const WAITING_STALE_MS = 3 * 60_000;

/** Sessions unlocked by hand until the limits drop below the thresholds again. */
const unlocked = new Set<string>();
/** Sessions whose hook is waiting right now: since when, and the last time they asked. */
const waiting = new Map<string, { since: number; askedAt: number }>();

function stopWaiting(sessionId: string, cause: "reset" | "unlocked"): void {
  const entry = waiting.get(sessionId);
  if (!entry) return;
  waiting.delete(sessionId);
  // A hook that stopped asking (Esc, session closed) isn't resuming anything.
  if (Date.now() - entry.askedAt >= WAITING_STALE_MS) return;
  recordEvent("usage.resumed", {
    sessionId,
    cause,
    waitedS: Math.round((Date.now() - entry.since) / 1000),
  });
}

/** Why sessions should pause now ("5h 91%"), or null. */
async function limitReached(): Promise<string | null> {
  const { orchestrator } = await getUserPreferences();
  const status = await getClaudeUsageStatus().catch(() => null);
  for (const limit of status?.limits ?? []) {
    const threshold =
      limit.group === "session"
        ? orchestrator.pauseSessionPercent
        : limit.group === "weekly"
          ? orchestrator.pauseWeeklyPercent
          : null;
    if (threshold !== null && limit.percent >= threshold) {
      return `${limit.group === "session" ? "5h" : limit.kind} ${limit.percent}%`;
    }
  }
  return null;
}

export async function checkUsageGate(sessionId: string): Promise<UsageGate> {
  const reason = await limitReached();
  if (!reason) {
    unlocked.clear();
    for (const id of [...waiting.keys()]) stopWaiting(id, "reset");
    return { pause: false, reason: null };
  }
  if (unlocked.has(sessionId)) return { pause: false, reason: null };
  const now = Date.now();
  const entry = waiting.get(sessionId);
  if (!entry || now - entry.askedAt >= WAITING_STALE_MS) {
    recordEvent("usage.paused", { sessionId, reason });
    waiting.set(sessionId, { since: now, askedAt: now });
  } else {
    entry.askedAt = now;
  }
  return { pause: true, reason };
}

export function unlockUsageGate(sessionId: string): void {
  unlocked.add(sessionId);
  if (waiting.has(sessionId)) stopWaiting(sessionId, "unlocked");
  else recordEvent("usage.unlocked", { sessionId });
}

/** The session's hook is holding it for the plan limit (the card says so). */
export function isWaitingForUsage(sessionId: string): boolean {
  const entry = waiting.get(sessionId);
  return entry !== undefined && Date.now() - entry.askedAt < WAITING_STALE_MS;
}

export async function getUsagePauseHookStatus(): Promise<UsagePauseHookStatus> {
  return { installed: await isHookInstalled(HOOK_MARKER, HOOK_EVENTS) };
}

export async function setUsagePauseHookInstalled(
  installed: boolean,
): Promise<UsagePauseHookStatus> {
  const command = `node ${posixShellQuote(HOOK_SCRIPT)} ${API_PORT}`;
  await setHooks(
    HOOK_MARKER,
    installed
      ? {
          PreToolUse: {
            matcher: "*",
            hooks: [{ type: "command", command, timeout: HOOK_TIMEOUT_S }],
          },
          UserPromptSubmit: { hooks: [{ type: "command", command }] },
        }
      : null,
  );
  return getUsagePauseHookStatus();
}
