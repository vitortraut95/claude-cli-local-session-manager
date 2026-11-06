import { chmod, readFile, rename, writeFile } from "node:fs/promises";
import { readdirSync, readFileSync, statSync, watchFile } from "node:fs";
import os from "node:os";
import path from "node:path";
import { REPO_ROOT } from "../../utils/repoRoot.js";

/**
 * The tokens the automations use, saved by the setup panel in the gitignored
 * `boardWatcher.secrets.json` (owner-only). They're the same names as the environment variables
 * the watcher already reads. A token saved in the panel wins, then one exported in a shell startup
 * file, then a variable set in the environment.
 */

export const SECRET_NAMES = [
  "JIRA_EMAIL",
  "JIRA_API_TOKEN",
  "BITBUCKET_EMAIL",
  "BITBUCKET_TOKEN",
  "TEAMS_WEBHOOK_URL",
  "JENKINS_USER",
  "JENKINS_TOKEN",
] as const;

export type SecretName = (typeof SECRET_NAMES)[number];

export const SECRETS_FILE = path.join(REPO_ROOT, "boardWatcher.secrets.json");

/**
 * Where Ubuntu sets variables, in the order they load (a later one wins): the session's
 * environment files, the system-wide shell files, then the user's bash and zsh files. The server
 * usually starts from a non-interactive bash (`start.sh`, the desktop shortcut) that reads none.
 */
function shellFiles(): string[] {
  const home = os.homedir();
  const inDir = (dir: string, pattern: RegExp) => {
    try {
      return readdirSync(dir)
        .filter((name) => pattern.test(name))
        .sort()
        .map((name) => path.join(dir, name));
    } catch {
      return [];
    }
  };
  return [
    "/etc/environment",
    ...inDir(path.join(home, ".config/environment.d"), /\.conf$/),
    path.join(home, ".pam_environment"),
    "/etc/profile",
    ...inDir("/etc/profile.d", /\.sh$/),
    "/etc/bash.bashrc",
    "/etc/zsh/zshenv",
    "/etc/zsh/zprofile",
    "/etc/zsh/zshrc",
    ...[".profile", ".bash_profile", ".bash_login", ".bashrc"].map((f) => path.join(home, f)),
    ...[".zshenv", ".zprofile", ".zshrc", ".zlogin"].map((f) => path.join(home, f)),
  ];
}

/** The folders whose new files count too (watched for files added or removed). */
const SHELL_DIRS = ["/etc/profile.d", path.join(os.homedir(), ".config/environment.d")];

/** `export NAME=value`, `NAME=value` or the `.pam_environment` form `NAME DEFAULT=value`. */
const ASSIGNMENT = new RegExp(
  `^\\s*(?:export\\s+)?(${SECRET_NAMES.join("|")})(?:=|\\s+DEFAULT=)(.*)$`,
);

/**
 * `source <file>` / `. <file>` with a literal path (`~` and `$HOME` allowed), also after `&&`,
 * `;` or `then` (`[ -f ~/.secrets ] && source ~/.secrets`).
 */
const SOURCE_LINE =
  /(?:^|&&|\|\||;|\bthen)\s*(?:source|\.)\s+["']?((?:~|\$HOME|\$\{HOME\})?[^\s"'$`;|&]+)["']?/;

function sourcedPath(raw: string, from: string): string {
  const home = os.homedir();
  const expanded = raw.replace(/^(?:~|\$HOME|\$\{HOME\})(?=\/|$)/, home);
  return path.resolve(path.dirname(from), expanded);
}

/** The literal value of `NAME=value`, or null when it needs the shell to expand. */
function literalValue(raw: string): string | null {
  const single = /^'([^']*)'/.exec(raw);
  if (single) return single[1] ?? "";
  const double = /^"((?:[^"\\]|\\.)*)"/.exec(raw);
  const inner = double?.[1];
  if (inner !== undefined) return /[$`]/.test(inner) ? null : inner.replace(/\\(.)/g, "$1");
  const bare = /^[^\s#;]*/.exec(raw)?.[0] ?? "";
  return /[$`"'\\]/.test(bare) ? null : bare;
}

type ShellExport = { value: string; file: string };

/** Every file read on the last pass (the sourced ones too), to watch for edits. */
let readFiles = new Set<string>();

function readExportsFrom(
  file: string,
  found: Partial<Record<SecretName, ShellExport>>,
  seen: Set<string>,
): void {
  if (seen.has(file)) return;
  seen.add(file);
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return;
  }
  for (const line of text.split("\n")) {
    const sourced = SOURCE_LINE.exec(line)?.[1];
    if (sourced) {
      readExportsFrom(sourcedPath(sourced, file), found, seen);
      continue;
    }
    const match = ASSIGNMENT.exec(line);
    const value = match && literalValue(match[2] ?? "");
    if (value) found[match[1] as SecretName] = { value, file };
  }
}

/** The tokens set in the shell and session files (the last assignment wins, like a login). */
function readShellExports(): Partial<Record<SecretName, ShellExport>> {
  const found: Partial<Record<SecretName, ShellExport>> = {};
  const seen = new Set<string>();
  for (const file of shellFiles()) readExportsFrom(file, found, seen);
  readFiles = seen;
  return found;
}

const environmentValues: Partial<Record<SecretName, string>> = Object.fromEntries(
  SECRET_NAMES.filter((name) => process.env[name]).map((name) => [name, process.env[name]]),
);
let shellExports = readShellExports();
let savedValues: Partial<Record<SecretName, string>> = {};

/**
 * `process.env[name]` = the saved one, else the shell file's, else the environment's. The shell
 * file beats the environment: a variable inherited from the terminal that started the app is a
 * copy of that file from back then.
 */
function applySecret(name: SecretName): void {
  const value = savedValues[name] ?? shellExports[name]?.value ?? environmentValues[name];
  if (value) process.env[name] = value;
  else delete process.env[name];
}

const mtimeOf = (file: string) => {
  try {
    return statSync(file).mtimeMs;
  } catch {
    return 0;
  }
};

/** The saved tokens a newer edit of the shell files replaced: the last change wins. */
function staleSaved(previous: typeof shellExports, savedAt: number): SecretName[] {
  return SECRET_NAMES.filter((name) => {
    const shell = shellExports[name];
    if (!savedValues[name] || !shell || shell.value === savedValues[name]) return false;
    if (shell.value === previous[name]?.value) return false;
    return mtimeOf(shell.file) > savedAt;
  });
}

async function syncShellExports(previous: typeof shellExports, savedAt: number): Promise<void> {
  const stale = staleSaved(previous, savedAt);
  for (const name of stale) delete savedValues[name];
  for (const name of SECRET_NAMES) applySecret(name);
  if (stale.length) await saveSecrets(Object.fromEntries(stale.map((name) => [name, ""])));
}

const watched = new Set<string>();

/** Watches every file read (and the folders); an edit re-reads all of them. */
function watchShellFiles(): void {
  for (const file of [...SHELL_DIRS, ...shellFiles(), ...readFiles]) {
    if (watched.has(file)) continue;
    watched.add(file);
    watchFile(file, { interval: 2000, persistent: false }, () => {
      const previous = shellExports;
      shellExports = readShellExports();
      watchShellFiles();
      void syncShellExports(previous, 0).catch(() => undefined);
    });
  }
}

/**
 * At server start: the tokens go into `process.env`, where the watcher reads them. An edited
 * shell file (`nano ~/.zshrc`) applies without restarting the app and replaces the token saved
 * in the panel.
 */
export async function loadSecretsIntoEnv(): Promise<void> {
  try {
    savedValues = JSON.parse(readFileSync(SECRETS_FILE, "utf8")) as typeof savedValues;
  } catch {
    savedValues = {};
  }
  await syncShellExports({}, mtimeOf(SECRETS_FILE));
  watchShellFiles();
}

export function secretIsSet(name: SecretName): boolean {
  return Boolean(process.env[name]);
}

export type SecretSource = "saved" | "environment" | "shell";

export function secretSource(name: SecretName): SecretSource {
  if (savedValues[name]) return "saved";
  return shellExports[name] ? "shell" : "environment";
}

/** The shell file a token in use was read from (`~/.zshrc`…). */
export function secretShellFile(name: SecretName): string | null {
  const file = secretSource(name) === "shell" ? shellExports[name]?.file : undefined;
  if (!file) return null;
  const home = os.homedir();
  return file.startsWith(`${home}/`) ? `~${file.slice(home.length)}` : file;
}

/** Saves the given tokens ("" removes one) and applies them right away. */
export async function saveSecrets(values: Partial<Record<SecretName, string>>): Promise<void> {
  const current: Partial<Record<SecretName, string>> = await readFile(SECRETS_FILE, "utf8")
    .then((text) => JSON.parse(text) as Partial<Record<SecretName, string>>)
    .catch(() => ({}));
  for (const name of SECRET_NAMES) {
    const value = values[name];
    if (value === undefined) continue;
    if (value === "") delete current[name];
    else current[name] = value;
  }
  const tmp = `${SECRETS_FILE}.tmp-${process.pid}`;
  await writeFile(tmp, `${JSON.stringify(current, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(tmp, SECRETS_FILE);
  await chmod(SECRETS_FILE, 0o600);
  savedValues = current;
  for (const name of SECRET_NAMES) applySecret(name);
}
