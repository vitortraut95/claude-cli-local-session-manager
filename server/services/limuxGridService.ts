import { execFile, spawn } from "node:child_process";
import { access, constants } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

/**
 * "Grid" terminal layout on Limux (github.com/am-will/limux, a Ghostty-based terminal driven
 * over a local socket): every Claude session the app opens becomes a pane of one Limux workspace,
 * "Claude — tarefas", in its own app window.
 *
 * What works on Limux 0.1.33 (and what doesn't, so it's avoided): `--command` on new-workspace /
 * new-pane doesn't deliver the command, so each pane is created empty and the command is typed
 * into its shell with `send` + `send-key Enter`; a trailing `; exit` closes the pane when Claude
 * quits. There's no "tile" command: panes alternate right/down into two columns. Closing the
 * Limux window ends the sessions in it (they stay resumable).
 *
 * Reopened, Limux restores its workspaces and panes (folder, last title) but not what ran in
 * them: they come back as bare shells. So a session goes, in order, into an idle pane of a tab
 * named after its task (one the user dragged out of the grid), an idle pane of the grid, or a new
 * split — and "Open grid" closes the grid's leftover idle panes.
 */

const execFileAsync = promisify(execFile);

export const GRID_WORKSPACE_TITLE = "Claude — tarefas";
const STARTUP_TIMEOUT_MS = 15_000;

/** sessionId → the surface (terminal) its pane runs in, for "Resume" to focus it. In memory: a
 *  server restart forgets it, and Resume then just adds a pane as usual. */
const surfaceBySession = new Map<string, string>();

async function limuxBin(): Promise<string | null> {
  const local = path.join(os.homedir(), ".local", "bin", "limux");
  for (const candidate of [
    local,
    ...(process.env.PATH ?? "").split(path.delimiter).map((d) => path.join(d, "limux")),
  ]) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Next one.
    }
  }
  return null;
}

async function limux(args: string[]): Promise<string> {
  const bin = await limuxBin();
  if (!bin) throw new Error("limux isn't installed");
  const { stdout } = await execFileAsync(bin, args);
  return stdout.trim();
}

async function limuxJson<T>(args: string[]): Promise<T> {
  return JSON.parse(await limux(["--json", ...args])) as T;
}

export async function isLimuxAvailable(): Promise<boolean> {
  return (await limuxBin()) !== null;
}

type Workspace = { ref: string; name: string; title: string };
type Panel = { pane_ref: string; surface_ref: string };

async function isRunning(): Promise<boolean> {
  return limux(["list-workspaces"]).then(
    () => true,
    () => false,
  );
}

/** Starts the app when it isn't running (its socket answers once it's up). */
async function ensureRunning(): Promise<void> {
  if (await isRunning()) return;
  const bin = await limuxBin();
  if (!bin) throw new Error("limux isn't installed");
  spawn(bin, [], { detached: true, stdio: "ignore" }).unref();
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (await isRunning()) return;
  }
  throw new Error("limux didn't start in time");
}

async function findGridWorkspace(): Promise<string | null> {
  const { workspaces } = await limuxJson<{ workspaces: Workspace[] }>(["list-workspaces"]);
  return (
    workspaces.find((w) => w.title === GRID_WORKSPACE_TITLE || w.name === GRID_WORKSPACE_TITLE)
      ?.ref ?? null
  );
}

async function listPanels(workspace: string): Promise<Panel[]> {
  const { surfaces } = await limuxJson<{ surfaces: Panel[] }>([
    "list-panels",
    "--workspace",
    workspace,
  ]);
  return surfaces;
}

/** A fresh pane's shell takes a moment before it accepts input. */
const SEND_RETRY_MS = 500;
const SEND_TIMEOUT_MS = 8_000;

/** A bare shell waiting at its prompt (what a restored pane is): the screen ends in `$`/`#`. */
async function isIdle(workspace: string, surface: string): Promise<boolean> {
  try {
    const screen = await limux([
      "read-screen",
      "--workspace",
      workspace,
      "--surface",
      surface,
      "--lines",
      "5",
    ]);
    const last = screen
      .split("\n")
      .map((line) => line.trimEnd())
      .filter(Boolean)
      .pop();
    return last !== undefined && /[$#]$/.test(last);
  } catch {
    return false;
  }
}

async function firstIdle(workspace: string): Promise<Panel | null> {
  for (const panel of await listPanels(workspace)) {
    if (await isIdle(workspace, panel.surface_ref)) return panel;
  }
  return null;
}

/** An idle pane already meant for this session: a tab titled with its task key (dragged out of
 *  the grid, then restored empty), else one of the grid's own. */
async function reusableSurface(
  taskKey: string | null,
): Promise<{ workspace: string; surface: string } | null> {
  const { workspaces } = await limuxJson<{ workspaces: Workspace[] }>(["list-workspaces"]);
  const grid = workspaces.find((w) => w.title === GRID_WORKSPACE_TITLE);
  if (taskKey) {
    const keyPattern = new RegExp(`(^|[^A-Z0-9])${taskKey}(?![0-9])`);
    for (const workspace of workspaces) {
      if (workspace === grid || !keyPattern.test(workspace.title)) continue;
      const idle = await firstIdle(workspace.ref);
      if (idle) return { workspace: workspace.ref, surface: idle.surface_ref };
    }
  }
  if (grid) {
    const idle = await firstIdle(grid.ref);
    if (idle) return { workspace: grid.ref, surface: idle.surface_ref };
  }
  return null;
}

/** "Open grid", after resuming: drops the grid's leftover idle panes (restored empty). */
export async function closeIdleGridPanes(): Promise<number> {
  const workspace = await findGridWorkspace();
  if (!workspace) return 0;
  let closed = 0;
  for (const panel of await listPanels(workspace)) {
    if (!(await isIdle(workspace, panel.surface_ref))) continue;
    await limux(["close-surface", "--workspace", workspace, "--surface", panel.surface_ref]);
    closed += 1;
  }
  return closed;
}

/** Types `command` into the surface's shell and runs it. */
async function runIn(workspace: string, surface: string, command: string): Promise<void> {
  const deadline = Date.now() + SEND_TIMEOUT_MS;
  for (;;) {
    try {
      await limux(["send", "--workspace", workspace, "--surface", surface, command]);
      break;
    } catch (err) {
      if (Date.now() > deadline) throw err;
      await new Promise((resolve) => setTimeout(resolve, SEND_RETRY_MS));
    }
  }
  await limux(["send-key", "--workspace", workspace, "--surface", surface, "Enter"]);
}

/**
 * A surface for one more session: the new workspace's own first pane, else a split — the 2nd
 * pane goes right of the 1st, then each one below the pane two before it, for two columns.
 */
async function newSurface(
  cwd: string | undefined,
): Promise<{ workspace: string; surface: string }> {
  const existing = await findGridWorkspace();
  if (!existing) {
    const created = await limuxJson<{ workspace_ref: string }>([
      "new-workspace",
      ...(cwd ? ["--cwd", cwd] : []),
    ]);
    await limux(["rename-workspace", "--workspace", created.workspace_ref, GRID_WORKSPACE_TITLE]);
    const [first] = await listPanels(created.workspace_ref);
    if (!first) throw new Error("the new limux workspace has no pane");
    return { workspace: created.workspace_ref, surface: first.surface_ref };
  }

  const panels = await listPanels(existing);
  const target = panels.length >= 2 ? panels[panels.length - 2] : panels[0];
  // Splitting only takes in a workspace that's on screen.
  await limux(["activate"]).catch(() => undefined);
  if (target) await limux(["focus-pane", "--workspace", existing, "--pane", target.pane_ref]);
  const split = await limuxJson<{ surface_ref: string }>([
    "new-pane",
    "--workspace",
    existing,
    ...(target ? ["--pane", target.pane_ref] : []),
    "--direction",
    panels.length === 1 ? "right" : "down",
  ]);
  return { workspace: existing, surface: split.surface_ref };
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** `claude --resume <id>` / `claude --session-id <id> …` → that id. */
function sessionIdOf(command: string): string | null {
  return /--(?:resume|session-id)\s+([A-Za-z0-9_-]+)/.exec(command)?.[1] ?? null;
}

/** Runs `command` (a Claude session) in the grid and brings its pane up: an idle pane meant for it
 *  when there is one (see the top comment), else a new one. `taskKey` finds a tab named after it. */
export async function launchInLimuxGrid(
  command: string,
  cwd: string | undefined,
  taskKey: string | null = null,
): Promise<void> {
  await ensureRunning();
  const { workspace, surface } = (await reusableSurface(taskKey)) ?? (await newSurface(cwd));
  // `; exit` closes the pane once Claude quits, so the grid only shows live sessions.
  await runIn(workspace, surface, `${cwd ? `cd ${shellQuote(cwd)} && ` : ""}${command}; exit`);
  const sessionId = sessionIdOf(command);
  if (sessionId) surfaceBySession.set(sessionId, surface);
  await showSurface(workspace, surface);
}

async function showSurface(workspace: string, surface: string): Promise<void> {
  await limux(["activate"]).catch(() => undefined);
  await limux(["focus-surface", "--workspace", workspace, "--surface", surface]);
}

/** Brings up the pane already running `sessionId`; false when the grid has none for it. */
export async function focusLimuxSession(sessionId: string): Promise<boolean> {
  const surface = surfaceBySession.get(sessionId);
  if (!surface || !(await isRunning())) return false;
  const workspace = await findGridWorkspace();
  if (!workspace || !(await listPanels(workspace)).some((p) => p.surface_ref === surface)) {
    surfaceBySession.delete(sessionId);
    return false;
  }
  await showSurface(workspace, surface);
  return true;
}

/** "Open grid": the Limux window in front (started if needed), on the grid workspace if any. */
export async function presentLimuxGrid(): Promise<void> {
  await ensureRunning();
  await limux(["activate"]).catch(() => undefined);
  const workspace = await findGridWorkspace();
  const [first] = workspace ? await listPanels(workspace) : [];
  if (workspace && first) {
    await limux(["focus-surface", "--workspace", workspace, "--surface", first.surface_ref]);
  }
}

export type GridStatus = { available: boolean; running: boolean; panes: number };

export async function getGridStatus(): Promise<GridStatus> {
  if (!(await isLimuxAvailable())) return { available: false, running: false, panes: 0 };
  if (!(await isRunning())) return { available: true, running: false, panes: 0 };
  const workspace = await findGridWorkspace();
  return {
    available: true,
    running: true,
    panes: workspace ? (await listPanels(workspace)).length : 0,
  };
}
