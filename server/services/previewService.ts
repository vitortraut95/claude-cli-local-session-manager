import { execFile } from "node:child_process";
import { readlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { recordEvent } from "../utils/history.js";
import { ConflictError, NotFoundError } from "../utils/httpError.js";
import { getTaskStore } from "../utils/taskStore.js";

/**
 * Local preview servers ("which port is each task on?"), found without any config:
 * - Docker dev-server containers (declaring PORT, BASE_URL or `-p`), tied to a folder by their
 *   bind mounts (a task worktree's own container, per the team's run-local skill, mounts the
 *   worktree) or by their compose working dir (a repo's regular containers); the URL comes from
 *   BASE_URL/PORT, `-p <port>` in the command, or a published port.
 * - Plain processes listening on a port, tied to a folder by their working directory.
 *
 * A task worktree's stopped containers are listed too, so the card can start them again. Its
 * previews only stop or go from the card (stop / remove), and are removed when the task is marked
 * done.
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
  /** false = a task worktree's stopped container, which can be started again. */
  running: boolean;
};

/** Containers `heavy-run --preview` starts carry it; it counts them against `previewSlots`. */
const PREVIEW_LABEL = "claude-session-manager.preview";

function isTaskWorktree(dir: string): boolean {
  return dir.includes(`${path.sep}.claude${path.sep}worktrees${path.sep}`);
}

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
  State?: { Running?: boolean } | null;
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
  const running = container.State?.Running ?? true;
  // A stopped container is only worth listing when it's a task worktree's, to start it again.
  if (!running && !dirs.some(isTaskWorktree)) return null;
  return { kind: "docker", id: name, name, port, url, dirs, running };
}

async function dockerPreviews(): Promise<PreviewServer[]> {
  try {
    const { stdout: ids } = await execFileAsync("docker", [
      "ps",
      "-aq",
      "--filter",
      "status=running",
      "--filter",
      "status=exited",
    ]);
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
        running: true,
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

/** Why a preview is stopped: a task marked done or the card's remove button removes its
 *  containers; the card's stop button just stops them. */
type StopReason = "done" | "removed" | "manual";

function removes(reason: StopReason): boolean {
  return reason === "done" || reason === "removed";
}

async function stopServer(server: PreviewServer, reason: StopReason, taskKey: string | null) {
  try {
    if (server.kind === "docker") {
      await execFileAsync(
        "docker",
        removes(reason) ? ["rm", "-f", server.id] : ["stop", server.id],
      );
    } else {
      process.kill(Number(server.id), "SIGTERM");
    }
    recordEvent("preview.stopped", {
      key: taskKey,
      reason,
      kind: server.kind,
      name: server.name,
      port: server.port,
      dirs: server.dirs,
    });
    return true;
  } catch (err) {
    recordEvent("preview.stop.failed", {
      key: taskKey,
      name: server.name,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/** Stops (or removes, see `StopReason`) every preview serving one of `worktreePaths` (task
 *  worktrees only — never a repo root). */
export async function stopPreviewsIn(
  worktreePaths: string[],
  reason: StopReason,
  taskKey: string | null = null,
): Promise<PreviewServer[]> {
  const targets = worktreePaths.filter(isTaskWorktree);
  if (targets.length === 0) return [];
  const stopped: PreviewServer[] = [];
  for (const server of await listPreviewServers()) {
    if (!server.running && !removes(reason)) continue;
    if (!targets.some((target) => previewsFor([server], target).length > 0)) continue;
    if (await stopServer(server, reason, taskKey)) stopped.push(server);
  }
  return stopped;
}

/** One task worktree's preview by id (the card's buttons act on that one only). */
async function findWorktreePreview(id: string): Promise<PreviewServer | undefined> {
  return (await listPreviewServers()).find((s) => s.id === id && s.dirs.some(isTaskWorktree));
}

/** The card's stop button: stops the container (it stays on the card, to start again). */
export async function stopPreviewById(id: string): Promise<boolean> {
  const server = await findWorktreePreview(id);
  if (!server?.running) return false;
  return stopServer(server, "manual", null);
}

/** The card's remove button: removes the container (running or stopped). */
export async function removePreviewById(id: string): Promise<boolean> {
  const server = await findWorktreePreview(id);
  if (!server) return false;
  return stopServer(server, "removed", null);
}

/**
 * Starts a task worktree's stopped preview container again (the card's restart button), with the
 * limits it was created with. Refused while `previewSlots` previews started by `heavy-run
 * --preview` are already running, like heavy-run itself would wait.
 */
export async function startPreviewById(id: string, previewSlots: number): Promise<void> {
  const server = await findWorktreePreview(id);
  if (server?.kind !== "docker" || server.running) {
    throw new NotFoundError(
      "PREVIEW_NOT_FOUND",
      "No stopped preview container of a task worktree by that id.",
    );
  }
  const { stdout } = await execFileAsync("docker", [
    "ps",
    "-q",
    "--filter",
    `label=${PREVIEW_LABEL}`,
  ]);
  const running = stdout.split("\n").filter(Boolean).length;
  if (running >= previewSlots) {
    throw new ConflictError(
      "PREVIEW_LIMIT",
      `${running} of ${previewSlots} previews are already running — stop one first.`,
    );
  }
  await execFileAsync("docker", ["start", server.id]);
  recordEvent("preview.started", {
    name: server.name,
    port: server.port,
    dirs: server.dirs,
  });
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
