import { spawn } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Session } from "../types/session.js";
import {
  findJsonlFiles,
  getClaudeProjectsDir,
  readSessionHead,
  type SessionHead,
} from "../utils/claudeProjects.js";

const UNTITLED = "Untitled";
const TITLE_MAX_LENGTH = 100;

function cleanTitle(raw: string): string {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  if (!collapsed) return UNTITLED;
  return collapsed.length > TITLE_MAX_LENGTH
    ? `${collapsed.slice(0, TITLE_MAX_LENGTH - 1)}…`
    : collapsed;
}

function resolveTitle(head: SessionHead): string {
  const source = head.aiTitle ?? head.summaryTitle ?? head.firstUserText;
  return source ? cleanTitle(source) : UNTITLED;
}

function resolveProject(head: SessionHead, filePath: string): string {
  if (head.cwd) return path.basename(head.cwd);
  const projectDir = path.basename(path.dirname(filePath));
  return projectDir.replace(/^-/, "") || projectDir;
}

async function buildSession(filePath: string): Promise<Session | null> {
  try {
    const [head, fileStat] = await Promise.all([readSessionHead(filePath), stat(filePath)]);
    const id = head.sessionId ?? path.basename(filePath, ".jsonl");

    return {
      id,
      title: resolveTitle(head),
      project: resolveProject(head, filePath),
      path: filePath,
      updatedAt: fileStat.mtime.toISOString(),
    };
  } catch {
    return null;
  }
}

export async function listSessions(): Promise<Session[]> {
  const files = await findJsonlFiles(getClaudeProjectsDir());
  const sessions = await Promise.all(files.map(buildSession));

  return sessions
    .filter((session): session is Session => session !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Session ids are UUID-shaped; reject anything that looks like a path segment. */
function isSafeSessionId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

async function findSessionFilePath(id: string): Promise<string | null> {
  if (!isSafeSessionId(id)) return null;
  const files = await findJsonlFiles(getClaudeProjectsDir());
  const match = files.find((file) => path.basename(file, ".jsonl") === id);
  return match ?? null;
}

/**
 * The Claude CLI scopes sessions to the working directory they were started in
 * (`~/.claude/projects/<encoded-cwd>/`). To resume one, the new shell must start
 * in that same directory, or `claude --resume` looks in the wrong project and
 * reports the session as not found.
 */
async function findSessionCwd(id: string): Promise<string | null> {
  const filePath = await findSessionFilePath(id);
  if (!filePath) return null;
  const head = await readSessionHead(filePath);
  return head.cwd;
}

export class SessionNotFoundError extends Error {
  constructor(id: string) {
    super(`Session "${id}" not found`);
    this.name = "SessionNotFoundError";
  }
}

export async function deleteSession(id: string): Promise<void> {
  const filePath = await findSessionFilePath(id);
  if (!filePath) throw new SessionNotFoundError(id);
  await unlink(filePath);
}

/** Time to wait for an immediate spawn failure (e.g. binary missing) before assuming success. */
const SPAWN_ERROR_GRACE_PERIOD_MS = 300;

/**
 * Candidate terminal emulators, tried in order until one launches. Each is invoked as
 * `<bin> ...flag, "bash", "-c", shellCmd` — argv-style rather than a single shell string, since
 * most of these emulators exec their `-e`/`--` payload directly instead of passing it through a shell.
 */
const TERMINAL_LAUNCHERS: { bin: string; buildArgs: (shellCmd: string) => string[] }[] = [
  { bin: "x-terminal-emulator", buildArgs: (c) => ["-e", "bash", "-c", c] },
  { bin: "gnome-terminal", buildArgs: (c) => ["--", "bash", "-c", c] },
  { bin: "konsole", buildArgs: (c) => ["-e", "bash", "-c", c] },
  { bin: "xfce4-terminal", buildArgs: (c) => ["-x", "bash", "-c", c] },
  { bin: "xterm", buildArgs: (c) => ["-e", "bash", "-c", c] },
];

const SNAP_ORIG_SUFFIX = "_VSCODE_SNAP_ORIG";

/**
 * When this server itself runs inside VS Code's integrated terminal and VS Code was installed
 * as a snap, its wrapper script overrides GTK/XDG/locale env vars (GTK_PATH, LOCPATH,
 * XDG_DATA_DIRS, ...) to point at libraries bundled in the snap, stashing each original value in
 * a `<VAR>_VSCODE_SNAP_ORIG` sibling. Those overrides leak to every child process; spawning a
 * separate GTK app like gnome-terminal under them causes glibc/GTK symbol mismatches (e.g.
 * `undefined symbol: __libc_pthread_init`) because it loads mismatched libraries from the snap.
 * Undo the override for the terminal we spawn by restoring (or deleting) each affected var.
 */
function sanitizedSpawnEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  if (process.platform !== "linux") return env;

  for (const key of Object.keys(env)) {
    if (!key.endsWith(SNAP_ORIG_SUFFIX)) continue;
    const originalVar = key.slice(0, -SNAP_ORIG_SUFFIX.length);
    const originalValue = env[key];
    if (originalValue) {
      env[originalVar] = originalValue;
    } else {
      delete env[originalVar];
    }
  }
  return env;
}

function trySpawnDetached(bin: string, args: string[], cwd?: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(bin, args, {
      detached: true,
      stdio: "ignore",
      cwd,
      env: sanitizedSpawnEnv(),
    });

    const timer = setTimeout(() => {
      child.removeListener("error", onError);
      child.unref();
      resolve(true);
    }, SPAWN_ERROR_GRACE_PERIOD_MS);

    function onError() {
      clearTimeout(timer);
      resolve(false);
    }

    child.once("error", onError);
  });
}

async function directoryExists(dir: string): Promise<boolean> {
  try {
    return (await stat(dir)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Pure-Node PATH lookup — same job as `which`/`where`, but without shelling out to a binary
 * that doesn't exist by that name on every OS (Windows has `where`, not `which`). Checks each
 * `PATH` entry for `bin` (plus every `PATHEXT` suffix on Windows, since `foo` there really
 * means `foo.exe`/`foo.cmd`/etc).
 */
function commandExists(bin: string): boolean {
  const dirs = (process.env.PATH ?? "").split(path.delimiter);
  const extensions =
    process.platform === "win32" ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(path.delimiter) : [""];

  for (const dir of dirs) {
    for (const ext of extensions) {
      try {
        accessSync(path.join(dir, bin + ext), constants.X_OK);
        return true;
      } catch {
        // Not in this PATH entry — keep looking.
      }
    }
  }
  return false;
}

/**
 * `WARP_DATA_DIR` lets this be overridden outright — useful on macOS/Windows, where Warp's data
 * directory isn't the Linux XDG one below and hasn't been mapped out here yet (see project notes
 * for cross-platform work still to do). Without the override, this only targets Linux.
 */
function getWarpTabConfigsDir(): string {
  if (process.env.WARP_DATA_DIR) {
    return path.join(process.env.WARP_DATA_DIR, "tab_configs");
  }
  const dataHome = process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local", "share");
  return path.join(dataHome, "warp-terminal", "tab_configs");
}

/**
 * Warp has no `-e`/`--` flag to run a command on launch — the only way in is writing a "Tab
 * Config" TOML file and opening it through Warp's own `warp://tab_config/<name>` URI scheme
 * (verified working: the pane respects `directory` and runs `commands` on open, unlike the
 * older/deprecated Launch Configuration YAML format, where external triggers are known to
 * silently drop the command).
 *
 * Linux-only for now: Warp's real data directory on macOS/Windows (and even its CLI binary name
 * there) hasn't been verified against a real install. Guessing wrong would fail silently — Warp
 * would still open, just without ever finding the tab config, since it'd be looking in the wrong
 * folder — which is worse than skipping straight to the plain-terminal fallback below. See
 * CLAUDE.md.
 */
async function launchWarp(command: string, cwd?: string): Promise<boolean> {
  if (process.platform !== "linux") return false;
  if (!commandExists("warp-terminal")) return false;

  const name = `claude-session-manager-${Date.now()}`;
  const escapedCommand = command.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const toml =
    `name = "${name}"\n\n[[panes]]\nid = "main"\ntype = "terminal"\n` +
    (cwd ? `directory = "${cwd.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"\n` : "") +
    `commands = ["${escapedCommand}"]\n`;

  const dir = getWarpTabConfigsDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${name}.toml`), toml, "utf8");

  // No `?new_window=true`: when Warp isn't already running, that flag forces a second window
  // on top of the one Warp opens on its own during startup. Without it, the tab config opens in
  // whichever window is already active (the one just opened, or an existing one).
  return trySpawnDetached("xdg-open", [`warp://tab_config/${encodeURIComponent(name)}`]);
}

/** Wraps `value` in single quotes for a POSIX shell, escaping any embedded ones. */
function posixShellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Escapes `value` to sit inside an AppleScript double-quoted string literal. */
function escapeForAppleScript(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * NOT YET SMOKE-TESTED ON A REAL MAC — written from documented `osascript`/Terminal.app
 * behavior, but nobody has run this on macOS yet. Verify before relying on it.
 *
 * `do script "<command>"` opens a new Terminal window, runs the command, and leaves the shell
 * at a fresh prompt afterwards (unlike the Linux emulators below, which close the instant their
 * wrapped `bash -c` exits) — so no "press enter to close" pause is needed here.
 */
async function launchMacTerminal(resumeCommand: string, cwd?: string): Promise<boolean> {
  // osascript's own `cwd` (a spawn option) only affects osascript itself, not the new Terminal
  // window Terminal.app creates — the working directory has to be part of the script's command.
  const shellCommand = cwd ? `cd ${posixShellQuote(cwd)} && ${resumeCommand}` : resumeCommand;
  const script =
    `tell application "Terminal"\n` +
    `  activate\n` +
    `  do script "${escapeForAppleScript(shellCommand)}"\n` +
    `end tell`;
  return trySpawnDetached("osascript", ["-e", script]);
}

/**
 * NOT YET SMOKE-TESTED ON A REAL WINDOWS MACHINE — written from documented `wt.exe`/`cmd.exe`
 * behavior, but nobody has run this on Windows yet. Verify before relying on it, especially
 * `cwd` values containing characters cmd.exe treats specially (`&`, `%`, `^`, parentheses).
 *
 * Tries Windows Terminal first (falls back to a plain `cmd.exe` window via `start`, which every
 * Windows install has). `/k` (vs. `/c`) keeps the window open with an interactive prompt after
 * the command exits — the same "stay open" job the Linux branch's `read -p` pause does.
 */
async function launchWindowsTerminal(resumeCommand: string, cwd?: string): Promise<boolean> {
  // Like macOS above: the new window's starting directory has to be requested explicitly
  // (`-d`/`/d`), since it isn't reliably inherited from the process we spawn here.
  if (
    await trySpawnDetached(
      "wt.exe",
      cwd ? ["-d", cwd, "cmd", "/k", resumeCommand] : ["cmd", "/k", resumeCommand],
    )
  ) {
    return true;
  }

  return trySpawnDetached("cmd.exe", [
    "/c",
    "start",
    ...(cwd ? ["/d", cwd] : []),
    "cmd",
    "/k",
    resumeCommand,
  ]);
}

/**
 * @param useWarp Opt-in, per the frontend's experimental Warp toggle (off by default). When
 * false, behavior is unchanged from before Warp support existed — straight to the OS-specific
 * terminal launcher below.
 */
export async function continueSession(id: string, useWarp = false): Promise<void> {
  if (!isSafeSessionId(id)) {
    throw new Error(`Invalid session id "${id}"`);
  }

  const cwd = await findSessionCwd(id);
  if (cwd && !(await directoryExists(cwd))) {
    throw new Error(
      `This session's original directory no longer exists ("${cwd}"). Since the Claude CLI ` +
        `resolves sessions by working directory, it can't be resumed from here — recreate the ` +
        `folder (or a symlink) at the old path pointing to the project's current location.`,
    );
  }

  // `id` is already validated above (alphanumeric/dash/underscore only), so it's safe to interpolate.
  const resumeCommand = `claude --resume ${id}`;

  if (useWarp && (await launchWarp(resumeCommand, cwd ?? undefined))) {
    return;
  }

  if (process.platform === "darwin") {
    if (await launchMacTerminal(resumeCommand, cwd ?? undefined)) return;
    throw new Error("Could not open Terminal.app (osascript failed to launch).");
  }

  if (process.platform === "win32") {
    if (await launchWindowsTerminal(resumeCommand, cwd ?? undefined)) return;
    throw new Error("Could not open a terminal (tried: Windows Terminal, cmd.exe).");
  }

  // Warp tabs stay open on their own after the command finishes, but the other emulators close
  // their window the instant the wrapped `bash -c` exits — so only these get the "press enter" pause.
  const shellCmd = `${resumeCommand}; echo; read -p "Press Enter to close..." _`;

  for (const launcher of TERMINAL_LAUNCHERS) {
    const started = await trySpawnDetached(
      launcher.bin,
      launcher.buildArgs(shellCmd),
      cwd ?? undefined,
    );
    if (started) return;
  }

  throw new Error(
    `No terminal emulator found (tried: ${TERMINAL_LAUNCHERS.map((l) => l.bin).join(", ")}).`,
  );
}
