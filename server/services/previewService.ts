import { execFile } from "node:child_process";
import { readFile, readlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { recordEvent } from "../utils/history.js";
import { getTaskStore } from "../utils/taskStore.js";

/**
 * Local preview servers ("which port is each task on?"), found without any config:
 * - Docker dev-server containers (declaring PORT, BASE_URL or `-p`), tied to a folder by their
 *   bind mounts (a task worktree's own container, per the team's run-local skill, mounts the
 *   worktree) or by their compose working dir (a repo's regular containers); the URL comes from
 *   BASE_URL/PORT, `-p <port>` in the command, or a published port.
 * - Plain processes listening on a port, tied to a folder by their working directory.
 *
 * A task worktree's previews are stopped (container removed / process terminated) when the task
 * is marked done or its task checklist is fully checked, to give back their memory.
 */

const execFileAsync = promisify(execFile);

export type PreviewServer = {
  kind: "docker" | "process";
  /** Container name, or the pid. */
  id: string;
  /** Container name, or the process's command name. */
  name: string;
  port: number;
  url: string;
  /** Folders it serves (mount sources / compose dir / cwd). */
  dirs: string[];
};

function isInside(dir: string, root: string): boolean {
  const resolved = path.resolve(dir);
  const base = path.resolve(root);
  return resolved === base || resolved.startsWith(`${base}${path.sep}`);
}

type DockerInspect = {
  Name: string;
  Config: { Env?: string[] | null; Cmd?: string[] | null; Labels?: Record<string, string> | null };
  Mounts?: { Type: string; Source: string }[] | null;
  NetworkSettings?: { Ports?: Record<string, { HostPort: string }[] | null> | null } | null;
};

const PORT_FLAG = /(?:^|\s)(?:-p|--port)[\s=](\d{2,5})(?!\S)/;

function dockerPreview(container: DockerInspect): PreviewServer | null {
  const name = container.Name.replace(/^\//, "");
  const env = new Map(
    (container.Config.Env ?? []).map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1)] as const;
    }),
  );
  const published = Object.values(container.NetworkSettings?.Ports ?? {})
    .flatMap((bindings) => bindings ?? [])
    .map((b) => Number(b.HostPort))
    .find((p) => p > 0);
  const commandPort = PORT_FLAG.exec((container.Config.Cmd ?? []).join(" "))?.[1];
  // Only dev servers say which port they serve (PORT / BASE_URL / -p): a database or mail
  // container only publishes one, and isn't a page to open.
  if (!env.has("PORT") && !env.has("BASE_URL") && !commandPort) return null;
  const port = Number(env.get("PORT") ?? commandPort ?? published ?? 0);
  if (!port) return null;

  const baseUrl = env.get("BASE_URL") ?? "";
  const url = /^http:\/\/localhost:\d+/.test(baseUrl)
    ? baseUrl
    : `http://localhost:${published ?? port}`;
  const composeDir = container.Config.Labels?.["com.docker.compose.project.working_dir"];
  const dirs = [
    ...(container.Mounts ?? [])
      .filter((m) => m.Type === "bind")
      .map((m) => m.Source)
      // Shared dependencies, not what the container serves.
      .filter((source) => !/(^|\/)(node_modules|\.ssh)(\/|$)/.test(source)),
    ...(composeDir ? [composeDir] : []),
  ];
  return { kind: "docker", id: name, name, port, url, dirs };
}

async function dockerPreviews(): Promise<PreviewServer[]> {
  try {
    const { stdout: ids } = await execFileAsync("docker", ["ps", "-q"]);
    const list = ids.split("\n").filter(Boolean);
    if (list.length === 0) return [];
    const { stdout } = await execFileAsync("docker", ["inspect", ...list], {
      maxBuffer: 32 * 1024 * 1024,
    });
    return (JSON.parse(stdout) as DockerInspect[])
      .map(dockerPreview)
      .filter((p): p is PreviewServer => p !== null);
  } catch {
    // No docker, or no access to it.
    return [];
  }
}

/** `ss -ltnpH` → listening ports of our own processes, with their working directory. */
async function processPreviews(): Promise<PreviewServer[]> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync("ss", ["-ltnpH"]));
  } catch {
    return [];
  }
  const servers = new Map<string, PreviewServer>();
  for (const line of stdout.split("\n")) {
    const port = Number(/:(\d+)\s/.exec(line)?.[1] ?? 0);
    const pid = /pid=(\d+)/.exec(line)?.[1];
    const name = /users:\(\("([^"]+)"/.exec(line)?.[1] ?? "?";
    if (!port || !pid || name === "docker-proxy") continue;
    const cwd = await readlink(`/proc/${pid}/cwd`).catch(() => null);
    if (!cwd || cwd === "/" || cwd === os.homedir()) continue;
    if (!servers.has(`${pid}:${port}`)) {
      servers.set(`${pid}:${port}`, {
        kind: "process",
        id: pid,
        name,
        port,
        url: `http://localhost:${port}`,
        dirs: [cwd],
      });
    }
  }
  return [...servers.values()];
}

export async function listPreviewServers(): Promise<PreviewServer[]> {
  const [docker, processes] = await Promise.all([dockerPreviews(), processPreviews()]);
  return [...docker, ...processes];
}

/**
 * The previews serving `folder`: inside it — but for a repo's main checkout, not inside its task
 * worktrees (`.claude/worktrees`), which have their own previews.
 */
export function previewsFor(servers: PreviewServer[], folder: string): PreviewServer[] {
  const worktrees = path.join(folder, ".claude", "worktrees");
  return servers.filter((server) =>
    server.dirs.some((dir) => isInside(dir, folder) && !isInside(dir, worktrees)),
  );
}

async function stopServer(server: PreviewServer): Promise<void> {
  if (server.kind === "docker") {
    await execFileAsync("docker", ["rm", "-f", server.id]);
  } else {
    process.kill(Number(server.id), "SIGTERM");
  }
}

/** Stops every preview serving one of `worktreePaths` (task worktrees only — never a repo root). */
export async function stopPreviewsIn(
  worktreePaths: string[],
  reason: "done" | "checklist" | "manual",
  taskKey: string | null = null,
): Promise<PreviewServer[]> {
  const targets = worktreePaths.filter((p) =>
    p.includes(`${path.sep}.claude${path.sep}worktrees${path.sep}`),
  );
  if (targets.length === 0) return [];
  const servers = await listPreviewServers();
  const stopped: PreviewServer[] = [];
  for (const server of servers) {
    if (!targets.some((target) => previewsFor([server], target).length > 0)) continue;
    try {
      await stopServer(server);
      stopped.push(server);
      recordEvent("preview.stopped", {
        key: taskKey,
        reason,
        kind: server.kind,
        name: server.name,
        port: server.port,
        dirs: server.dirs,
      });
    } catch (err) {
      recordEvent("preview.stop.failed", {
        key: taskKey,
        name: server.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return stopped;
}

/** Stops one preview by id (the card's stop button); only a task worktree's. */
export async function stopPreviewById(id: string): Promise<boolean> {
  const server = (await listPreviewServers()).find((s) => s.id === id);
  if (!server) return false;
  const worktreeDirs = server.dirs.filter((d) =>
    d.includes(`${path.sep}.claude${path.sep}worktrees${path.sep}`),
  );
  if (worktreeDirs.length === 0) return false;
  return (await stopPreviewsIn(worktreeDirs, "manual")).length > 0;
}

/** The task's worktrees, as "New task"/the queue recorded them. */
export async function taskWorktrees(taskKey: string): Promise<string[]> {
  const store = await getTaskStore();
  return Object.values(store.repoBranches).flatMap((branches) =>
    Object.values(branches)
      .filter((entry) => entry.taskKey === taskKey && entry.worktreePath)
      .map((entry) => entry.worktreePath!),
  );
}

function checklistDir(): string {
  return process.env.TASK_CHECKLIST_DIR ?? path.join(os.homedir(), ".cache", "task-checklists");
}

/** The task-checklist skill's `<KEY>.md`: complete when nothing is left unchecked. */
async function isChecklistComplete(taskKey: string): Promise<boolean> {
  try {
    const text = await readFile(path.join(checklistDir(), `${taskKey}.md`), "utf8");
    return /^\s*- \[x\]/im.test(text) && !/^\s*- \[ \]/m.test(text);
  } catch {
    return false;
  }
}

/**
 * Scheduler housekeeping: stops the previews of every task worktree whose checklist is now
 * complete. Cheap when nothing previews (one `docker ps`).
 */
export async function stopPreviewsOfCompletedChecklists(): Promise<void> {
  const servers = await listPreviewServers();
  if (servers.length === 0) return;
  const store = await getTaskStore();
  const keyByWorktree = new Map<string, string>();
  for (const branches of Object.values(store.repoBranches)) {
    for (const entry of Object.values(branches)) {
      if (entry.taskKey && entry.worktreePath) keyByWorktree.set(entry.worktreePath, entry.taskKey);
    }
  }
  const checked = new Map<string, boolean>();
  for (const [worktree, key] of keyByWorktree) {
    if (previewsFor(servers, worktree).length === 0) continue;
    if (!checked.has(key)) checked.set(key, await isChecklistComplete(key));
    if (checked.get(key)) await stopPreviewsIn([worktree], "checklist", key);
  }
}
