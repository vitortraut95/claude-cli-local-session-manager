import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Walks up from this file's own location looking for the monorepo root's `package.json` (the one
 * with a `workspaces` array — `server/package.json` doesn't have one). Anchoring to the module's
 * own location rather than `process.cwd()` means this resolves correctly whether the server is
 * started via `tsx watch index.ts` (cwd = server/) or a built `dist/utils/repoRoot.js` (nested one
 * directory deeper) — both would break a hardcoded relative `path.resolve(__dirname, "..", "..")`.
 */
function findRepoRoot(startDir: string): string {
  let dir = startDir;
  while (true) {
    const pkgPath = path.join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { workspaces?: unknown };
        if (Array.isArray(pkg.workspaces)) return dir;
      } catch {
        // Malformed package.json — keep walking up.
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error("Could not locate the repo root (no package.json with a workspaces array).");
    }
    dir = parent;
  }
}

/** Absolute path to the monorepo root — used to locate gitignored, per-machine local files (the
 *  "new task" modal's `userPreferences.json`) regardless of which service module asks. */
export const REPO_ROOT = findRepoRoot(path.dirname(fileURLToPath(import.meta.url)));
