import { mkdir, readdir, stat, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getUserPreferences, type TerminalLayout } from "../preferencesService.js";
import { isLimuxAvailable, launchInLimuxGrid } from "../limuxGridService.js";
import { AppError } from "../../utils/httpError.js";
import { commandExists, trySpawnDetached } from "./shell.js";

/**
 * Terminal emulators, tried in order. Argv-style (`bash -c <cmd>`): most exec their payload
 * without a shell. Duplicated in `open-terminal.sh` (must work without Node); keep both in sync
 * (`scripts/check-terminal-launchers-sync.mjs` checks it).
 */
const TERMINAL_LAUNCHERS: { bin: string; buildArgs: (shellCmd: string) => string[] }[] = [
  { bin: "x-terminal-emulator", buildArgs: (c) => ["-e", "bash", "-c", c] },
  { bin: "gnome-terminal", buildArgs: (c) => ["--", "bash", "-c", c] },
  { bin: "konsole", buildArgs: (c) => ["-e", "bash", "-c", c] },
  { bin: "xfce4-terminal", buildArgs: (c) => ["-x", "bash", "-c", c] },
  { bin: "xterm", buildArgs: (c) => ["-e", "bash", "-c", c] },
];

/** Warp's Linux XDG tab-config dir; `WARP_DATA_DIR` overrides it. */
function getWarpTabConfigsDir(): string {
  if (process.env.WARP_DATA_DIR) {
    return path.join(process.env.WARP_DATA_DIR, "tab_configs");
  }
  const dataHome = process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local", "share");
  return path.join(dataHome, "warp-terminal", "tab_configs");
}

const WARP_TAB_CONFIG_PREFIX = "claude-session-manager-";
/** Long enough that a slow cold-start Warp has certainly read the file. */
const WARP_TAB_CONFIG_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * Deletes this app's tab configs older than `WARP_TAB_CONFIG_MAX_AGE_MS` (they'd pile up in Warp's
 * list). A just-opened one can't be deleted right away: `xdg-open` returning doesn't mean Warp has
 * read it yet. Only touches files with our own prefix.
 */
async function pruneStaleWarpTabConfigs(dir: string): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }

  const now = Date.now();
  await Promise.all(
    entries
      .filter((name) => name.startsWith(WARP_TAB_CONFIG_PREFIX) && name.endsWith(".toml"))
      .map(async (name) => {
        const filePath = path.join(dir, name);
        try {
          const fileStat = await stat(filePath);
          if (now - fileStat.mtimeMs > WARP_TAB_CONFIG_MAX_AGE_MS) {
            await unlink(filePath);
          }
        } catch {
          // Best-effort cleanup — ignore races with a concurrent delete, permission errors, etc.
        }
      }),
  );
}

/**
 * Escapes `value` for a TOML basic (double-quoted) string. Backslash goes first, since the other
 * replacements add backslashes. A basic string can't hold a raw newline, so `\n`/`\r` must be
 * escaped or Warp rejects the whole tab config.
 */
function toTomlBasicString(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

/** Warp has no flag to run a command on launch: writes a Tab Config TOML and opens it via
 *  `warp://tab_config/<name>`. False when Warp isn't installed. */
async function launchWarp(command: string, cwd?: string): Promise<boolean> {
  if (!commandExists("warp-terminal")) return false;

  const name = `${WARP_TAB_CONFIG_PREFIX}${Date.now()}`;
  const toml =
    `name = "${name}"\n\n[[panes]]\nid = "main"\ntype = "terminal"\n` +
    (cwd ? `directory = "${toTomlBasicString(cwd)}"\n` : "") +
    `commands = ["${toTomlBasicString(command)}"]\n`;

  const dir = getWarpTabConfigsDir();
  await mkdir(dir, { recursive: true });
  await pruneStaleWarpTabConfigs(dir);
  await writeFile(path.join(dir, `${name}.toml`), toml, "utf8");

  // No `?new_window=true`: on a cold start it opens a second window besides Warp's own.
  return trySpawnDetached("xdg-open", [`warp://tab_config/${encodeURIComponent(name)}`]);
}

/**
 * Runs a Claude session's `command` where `layout` (default: the `terminalLayout` preference)
 * says: a pane of the Limux grid (`limuxGridService`), or a terminal of its own. Without Limux the
 * grid falls back to a terminal.
 */
export async function launchInTerminal(
  command: string,
  cwd?: string,
  taskKey: string | null = null,
  layout?: TerminalLayout,
): Promise<void> {
  const terminalLayout = layout ?? (await getUserPreferences()).terminalLayout;
  if (terminalLayout === "limux-grid") {
    if (await isLimuxAvailable()) {
      await launchInLimuxGrid(command, cwd, taskKey);
      return;
    }
    console.warn(
      "[terminal] terminalLayout is limux-grid but limux isn't installed — using a tab.",
    );
  }
  await openTerminalWindow(command, cwd);
}

/** Runs `command` in a new terminal: Warp when installed, else the first `TERMINAL_LAUNCHERS`
 *  entry that starts. */
export async function openTerminalWindow(command: string, cwd?: string): Promise<void> {
  if (await launchWarp(command, cwd)) {
    return;
  }

  // These emulators close the window as soon as `bash -c` exits (Warp tabs stay open).
  const shellCmd = `${command}; echo; read -p "Press Enter to close..." _`;

  for (const launcher of TERMINAL_LAUNCHERS) {
    const started = await trySpawnDetached(launcher.bin, launcher.buildArgs(shellCmd), cwd);
    if (started) return;
  }

  throw new AppError(
    "TERMINAL_LAUNCH_FAILED",
    `No terminal emulator found (tried: ${TERMINAL_LAUNCHERS.map((l) => l.bin).join(", ")}).`,
  );
}
