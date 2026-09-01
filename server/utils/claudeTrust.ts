import { readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const CLAUDE_JSON_PATH = path.join(os.homedir(), ".claude.json");

/**
 * Marks `worktreePath` as trust-accepted in the Claude CLI's own global config
 * (`~/.claude.json`'s `projects["<path>"].hasTrustDialogAccepted`, confirmed by inspecting the
 * file directly) — the same flag the CLI itself sets once a human answers its first-run "do you
 * trust this folder?" dialog interactively.
 *
 * Every worktree this app creates is a git-managed subdirectory of a repo the user is already
 * trusted in, never an arbitrary folder — pre-accepting trust on the app's behalf here is a
 * narrow, scoped exception, not a blanket "trust everything" change. Two real failure modes
 * both trace back to skipping this: `claude --worktree <name>` (see createSessionWorktree in
 * sessionService.ts) exits in about a second with "Workspace trust not yet accepted" and creates
 * nothing whenever it's run from an as-yet-untrusted directory — with no way for this app to
 * detect that from a detached, fire-and-forget terminal spawn, so the UI shows a plain success
 * toast regardless — and a freshly-created worktree's first interactive `claude` launch
 * otherwise stops at that same one-time dialog, invisibly, in a terminal window this app can't
 * force to the front on some setups (see CLAUDE.md's Wayland focus-stealing note).
 *
 * Best-effort and silent on any failure (missing file, unexpected shape, a concurrent write from
 * the CLI itself racing this one, ...) — this is a convenience, never something worth blocking or
 * failing the actual worktree creation over. Reads and rewrites the whole file rather than a
 * targeted patch since there's no CLI-provided API for this; writes to a temp file and renames
 * over the original so a crash mid-write can't leave `~/.claude.json` truncated.
 */
export async function markWorktreeTrustAccepted(worktreePath: string): Promise<void> {
  try {
    const raw = await readFile(CLAUDE_JSON_PATH, "utf-8");
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (typeof data !== "object" || data === null) return;

    const projects =
      typeof data.projects === "object" && data.projects !== null
        ? (data.projects as Record<string, unknown>)
        : {};
    const resolvedPath = path.resolve(worktreePath);
    const existingEntry =
      typeof projects[resolvedPath] === "object" && projects[resolvedPath] !== null
        ? (projects[resolvedPath] as Record<string, unknown>)
        : {};

    projects[resolvedPath] = { ...existingEntry, hasTrustDialogAccepted: true };
    data.projects = projects;

    const tmpPath = `${CLAUDE_JSON_PATH}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(tmpPath, JSON.stringify(data, null, 2), "utf-8");
    await rename(tmpPath, CLAUDE_JSON_PATH);
  } catch {
    // Never let this block the worktree creation it's meant to support.
  }
}
