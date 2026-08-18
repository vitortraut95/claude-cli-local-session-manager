import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const HEADLESS_MAX_BUFFER_BYTES = 16 * 1024 * 1024;
const HEADLESS_TIMEOUT_MS = 120_000;

/**
 * Runs `claude --resume <id> --print --permission-mode plan "<prompt>"` in `cwd` — a
 * non-interactive, single turn against the session's own existing transcript. `--permission-mode
 * plan` (rather than disabling tools outright — tried first, see below) still lets the model read
 * around the repo for a better-grounded summary, but can't make any actual edits, so the call is
 * safe to fire off from the backend with nothing watching it.
 *
 * `--tools ""` was the first thing tried here, on the theory that disabling every tool would be
 * the safest option — confirmed by direct reproduction that it instead breaks the call entirely
 * ("No deferred tool marker found..."), almost certainly because `--tools <tools...>` is a
 * variadic flag and swallows the prompt string that follows it as another (empty) tool name,
 * leaving no actual prompt for the resumed turn. `--permission-mode plan` has no such parsing
 * trap and was confirmed (again by direct reproduction, including watching it run a read-only
 * `git`-style check for extra context) to produce a well-grounded summary without ever risking a
 * mutation.
 *
 * Returns null instead of throwing on any failure (missing binary, non-zero exit, timeout) — the
 * caller falls back to the CLI's own `away_summary` recap or the session's title, so a broken/slow
 * headless call degrades the summary's quality rather than blocking the whole feature.
 */
export async function runClaudeHeadlessSummary(
  sessionId: string,
  cwd: string,
  instruction: string,
): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      "claude",
      ["--resume", sessionId, "--print", "--permission-mode", "plan", instruction],
      { cwd, timeout: HEADLESS_TIMEOUT_MS, maxBuffer: HEADLESS_MAX_BUFFER_BYTES },
    );
    const trimmed = stdout.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}
