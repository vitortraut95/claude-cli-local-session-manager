import { spawn } from "node:child_process";
import { stat, unlink } from "node:fs/promises";
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
    const [head, fileStat] = await Promise.all([
      readSessionHead(filePath),
      stat(filePath),
    ]);
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
const TERMINAL_LAUNCHERS: Array<{ bin: string; buildArgs: (shellCmd: string) => string[] }> = [
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
    const child = spawn(bin, args, { detached: true, stdio: "ignore", cwd, env: sanitizedSpawnEnv() });

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

export async function continueSession(id: string): Promise<void> {
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
  const shellCmd = `claude --resume ${id}; echo; read -p "Press Enter to close..." _`;

  for (const launcher of TERMINAL_LAUNCHERS) {
    const started = await trySpawnDetached(launcher.bin, launcher.buildArgs(shellCmd), cwd ?? undefined);
    if (started) return;
  }

  throw new Error(
    `No terminal emulator found (tried: ${TERMINAL_LAUNCHERS.map((l) => l.bin).join(", ")}).`,
  );
}
