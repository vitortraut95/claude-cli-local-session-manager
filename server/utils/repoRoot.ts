import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Walks up from `startDir` to the monorepo root (the `package.json` with a `workspaces` array).
 * Starts from the module's location so it works from both `tsx` sources and a deeper `dist/`.
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

/** Absolute path to the monorepo root, where the gitignored per-machine JSON files live. */
export const REPO_ROOT = findRepoRoot(path.dirname(fileURLToPath(import.meta.url)));
