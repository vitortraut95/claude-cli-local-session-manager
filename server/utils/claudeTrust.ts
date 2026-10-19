import { readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const CLAUDE_JSON_PATH = path.join(os.homedir(), ".claude.json");

/**
 * Marks `worktreePath` as trust-accepted in `~/.claude.json`
 * (`projects["<path>"].hasTrustDialogAccepted`), the flag the CLI sets after its "do you trust this
 * folder?" dialog. Without it `claude --worktree <name>` exits with "Workspace trust not yet
 * accepted", which a detached terminal spawn can't report back. Only used for worktrees of repos
 * the user already trusts. Best-effort; writes via temp file + rename so a crash can't truncate it.
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
