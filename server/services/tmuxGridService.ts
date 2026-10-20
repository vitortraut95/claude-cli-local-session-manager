import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

/**
 * "Grid" terminal layout: every Claude session the app opens becomes a pane of one shared tmux
 * session, re-tiled on each new pane and each exit, so all of them show at once in a single
 * terminal (attached once — opened for you when nothing is attached yet). Panes that don't fit
 * any more spill into a new window of the same session.
 */

const execFileAsync = promisify(execFile);

export const GRID_SESSION = "claude-tarefas";
export const GRID_ATTACH_COMMAND = `tmux attach -t ${GRID_SESSION}`;

/** A terminal takes a few seconds to attach: launches right after one opened don't open another. */
const VIEWER_REOPEN_GAP_MS = 10_000;
let viewerOpenedAt = 0;

async function tmux(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("tmux", args);
  return stdout.trim();
}

export async function isTmuxAvailable(): Promise<boolean> {
  return tmux(["-V"]).then(
    () => true,
    () => false,
  );
}

export async function gridSessionExists(): Promise<boolean> {
  return tmux(["has-session", "-t", GRID_SESSION]).then(
    () => true,
    () => false,
  );
}

/** An interactive login shell, so the pane gets the same PATH (nvm, ~/.local/bin…) as a
 *  terminal tab would. */
function shellArgs(command: string): string[] {
  return [process.env.SHELL ?? "bash", "-lic", command];
}

/** Window-level look of a grid window: titled borders, failed runs kept open to read the error. */
async function styleWindow(paneId: string): Promise<void> {
  for (const [option, value] of [
    ["remain-on-exit", "failed"],
    ["pane-border-status", "top"],
    // Our label first; Claude sets its own terminal title (pane_title) as the session goes.
    ["pane-border-format", " #{@label} · #{pane_title} "],
  ]) {
    await tmux(["set-option", "-w", "-t", paneId, option!, value!]);
  }
}

async function createGridSession(command: string, cwd: string | undefined): Promise<string> {
  const paneId = await tmux([
    "new-session",
    "-d",
    "-s",
    GRID_SESSION,
    "-x",
    "240",
    "-y",
    "70",
    "-P",
    "-F",
    "#{pane_id}",
    ...(cwd ? ["-c", cwd] : []),
    ...shellArgs(command),
  ]);
  await tmux(["set-option", "-t", GRID_SESSION, "mouse", "on"]);
  // The viewer window's title, whatever terminal shows it.
  await tmux(["set-option", "-t", GRID_SESSION, "set-titles", "on"]);
  await tmux(["set-option", "-t", GRID_SESSION, "set-titles-string", "Claude — tarefas"]);
  // A closed pane leaves a hole otherwise.
  await tmux(["set-hook", "-t", GRID_SESSION, "pane-exited", "select-layout tiled"]);
  await styleWindow(paneId);
  return paneId;
}

async function addPane(command: string, cwd: string | undefined): Promise<string> {
  const lastWindow = (await tmux(["list-windows", "-t", GRID_SESSION, "-F", "#{window_id}"]))
    .split("\n")
    .pop()!;
  const cwdArgs = cwd ? ["-c", cwd] : [];
  try {
    const paneId = await tmux([
      "split-window",
      "-t",
      lastWindow,
      "-P",
      "-F",
      "#{pane_id}",
      ...cwdArgs,
      ...shellArgs(command),
    ]);
    await tmux(["select-layout", "-t", paneId, "tiled"]);
    return paneId;
  } catch {
    // "no space for new pane": the window is full — start another one.
    const paneId = await tmux([
      "new-window",
      "-t",
      GRID_SESSION,
      "-P",
      "-F",
      "#{pane_id}",
      ...cwdArgs,
      ...shellArgs(command),
    ]);
    await styleWindow(paneId);
    return paneId;
  }
}

/**
 * Runs `command` in a new grid pane labeled after its folder (a task worktree's is the branch).
 * `openViewer` opens a regular terminal running `GRID_ATTACH_COMMAND`; called only when no
 * terminal is attached to the grid yet.
 */
export async function launchInTmuxGrid(
  command: string,
  cwd: string | undefined,
  openViewer: (attachCommand: string) => Promise<void>,
): Promise<void> {
  const paneId = (await gridSessionExists())
    ? await addPane(command, cwd)
    : await createGridSession(command, cwd);
  await tmux(["set-option", "-p", "-t", paneId, "@label", cwd ? path.basename(cwd) : "claude"]);
  await showPane(paneId, openViewer);
}

/** Brings `paneId` to the front of the grid (its window, then the pane) for whoever is watching,
 *  and opens a terminal on the grid when nothing is showing it. */
async function showPane(
  paneId: string,
  openViewer: (attachCommand: string) => Promise<void>,
): Promise<void> {
  await tmux(["select-window", "-t", paneId]);
  await tmux(["select-pane", "-t", paneId]);
  const clients = await tmux(["list-clients", "-t", GRID_SESSION]).catch(() => "");
  if (!clients && Date.now() - viewerOpenedAt > VIEWER_REOPEN_GAP_MS) {
    viewerOpenedAt = Date.now();
    await openViewer(GRID_ATTACH_COMMAND);
  }
}

/**
 * Shows the grid pane already running `sessionId` (started as `claude --resume <id>` or
 * `--session-id <id>`, so the id is in its start command); false when no pane has it.
 */
export async function focusGridSession(
  sessionId: string,
  openViewer: (attachCommand: string) => Promise<void>,
): Promise<boolean> {
  if (!(await gridSessionExists())) return false;
  const panes = await tmux([
    "list-panes",
    "-s",
    "-t",
    GRID_SESSION,
    "-F",
    "#{pane_id}\t#{pane_dead}\t#{pane_start_command}",
  ]).catch(() => "");
  const match = panes
    .split("\n")
    .map((line) => line.split("\t"))
    .find(([, dead, command]) => dead === "0" && command?.includes(sessionId));
  if (!match?.[0]) return false;
  await showPane(match[0], openViewer);
  return true;
}

export type GridStatus = { tmuxAvailable: boolean; running: boolean; panes: number };

export async function getGridStatus(): Promise<GridStatus> {
  if (!(await isTmuxAvailable())) return { tmuxAvailable: false, running: false, panes: 0 };
  if (!(await gridSessionExists())) return { tmuxAvailable: true, running: false, panes: 0 };
  const panes = await tmux(["list-panes", "-s", "-t", GRID_SESSION, "-F", "#{pane_id}"]).catch(
    () => "",
  );
  return { tmuxAvailable: true, running: true, panes: panes ? panes.split("\n").length : 0 };
}
