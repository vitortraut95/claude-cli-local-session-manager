import { chmod, readFile, rename, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../../utils/repoRoot.js";

/**
 * The tokens the automations use, saved by the setup panel in the gitignored
 * `boardWatcher.secrets.json` (owner-only). They're the same names as the environment variables
 * the watcher already reads: a variable set in the environment wins over the file.
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

/** Names that came from the environment itself, never overwritten by the file. */
const fromEnvironment = new Set<SecretName>(SECRET_NAMES.filter((name) => process.env[name]));

/** At server start: the saved tokens go into `process.env` where the environment has none. */
export function loadSecretsIntoEnv(): void {
  let saved: Partial<Record<SecretName, string>> = {};
  try {
    saved = JSON.parse(readFileSync(SECRETS_FILE, "utf8")) as typeof saved;
  } catch {
    return;
  }
  for (const name of SECRET_NAMES) {
    const value = saved[name];
    if (typeof value === "string" && value && !fromEnvironment.has(name)) process.env[name] = value;
  }
}

export function secretIsSet(name: SecretName): boolean {
  return Boolean(process.env[name]);
}

export function secretFromEnvironment(name: SecretName): boolean {
  return fromEnvironment.has(name);
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
    if (!fromEnvironment.has(name)) {
      if (value === "") delete process.env[name];
      else process.env[name] = value;
    }
  }
  const tmp = `${SECRETS_FILE}.tmp-${process.pid}`;
  await writeFile(tmp, `${JSON.stringify(current, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(tmp, SECRETS_FILE);
  await chmod(SECRETS_FILE, 0o600);
}
