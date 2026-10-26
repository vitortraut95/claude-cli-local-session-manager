import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Used when no container that mounted the folder is left to borrow the image from. */
const FALLBACK_IMAGE = "alpine";

/**
 * Preview containers run as root and write into the worktree they mount (`build/`, caches), so
 * those files end up owned by root and the user can't delete them. When `dir` has any file that
 * isn't the user's, a throwaway container (the image of one that mounted it, else alpine) chowns
 * the whole folder back. Returns whether it did. No docker = false.
 */
export async function reclaimForeignFiles(dir: string): Promise<boolean> {
  const { uid, gid } = os.userInfo();
  const { stdout: foreign } = await execFileAsync("find", [
    dir,
    "-not",
    "-uid",
    String(uid),
    "-print",
    "-quit",
  ]).catch(() => ({ stdout: "" }));
  if (!foreign.trim()) return false;

  const image = (await imageThatMounted(dir)) ?? FALLBACK_IMAGE;
  try {
    await execFileAsync(
      "docker",
      [
        "run",
        "--rm",
        "--user",
        "0:0",
        "--entrypoint",
        "chown",
        "-v",
        `${path.resolve(dir)}:/reclaim`,
        image,
        "-R",
        `${uid}:${gid}`,
        "/reclaim",
      ],
      { timeout: 120_000 },
    );
    return true;
  } catch (err) {
    console.warn(`[worktrees] Couldn't reclaim root-owned files in ${dir}:`, err);
    return false;
  }
}

async function imageThatMounted(dir: string): Promise<string | null> {
  try {
    const { stdout: ids } = await execFileAsync("docker", ["ps", "-aq"]);
    const list = ids.split("\n").filter(Boolean);
    if (list.length === 0) return null;
    const { stdout } = await execFileAsync(
      "docker",
      ["inspect", "--format", "{{.Config.Image}}|{{range .Mounts}}{{.Source}};{{end}}", ...list],
      { maxBuffer: 8 * 1024 * 1024 },
    );
    const base = path.resolve(dir);
    for (const line of stdout.split("\n")) {
      const [image, mounts = ""] = line.split("|");
      const sources = mounts.split(";").filter(Boolean);
      if (image && sources.some((s) => s === base || s.startsWith(`${base}${path.sep}`))) {
        return image;
      }
    }
  } catch {
    // No docker, or no access to it.
  }
  return null;
}
