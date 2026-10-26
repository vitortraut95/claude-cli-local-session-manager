import os from "node:os";
import path from "node:path";
import type { GitOptions } from "../../utils/git.js";
import { updateUserPreferences, type SkillsHubPreferences } from "../preferencesService.js";

const FETCH_TIMEOUT_MS = 20_000;

/** Every hub git call may reach the remote. */
export const HUB_GIT: GitOptions = { timeoutMs: FETCH_TIMEOUT_MS, nonInteractive: true };

export function getUserSkillsDir(): string {
  const fromEnv = process.env.CLAUDE_CONFIG_DIR?.trim();
  const configDir = fromEnv && fromEnv.length > 0 ? fromEnv : path.join(os.homedir(), ".claude");
  return path.join(configDir, "skills");
}

export async function updateSkillsHubPreferences(
  partial: Partial<SkillsHubPreferences>,
): Promise<void> {
  await updateUserPreferences((prefs) => ({
    ...prefs,
    skillsHub: { ...prefs.skillsHub, ...partial },
  }));
}
