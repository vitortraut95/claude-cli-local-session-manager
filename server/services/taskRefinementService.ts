import { resolveInstalledSkill } from "./installedSkillService.js";
import { getUserPreferences } from "./preferencesService.js";
import { launchTaskTerminal } from "./taskService.js";
import { firstWorkspaceDir } from "./workspaceService.js";
import { BadRequestError } from "../utils/httpError.js";
import type { TerminalLayout } from "../../shared/preferences.js";
import type { RefinementInput } from "../../shared/tasks.js";

/**
 * "Refine tasks": a batch of tickets handed to `taskRefinementSkill` in a session of its own. No
 * repo, branch or worktree — it opens in the first workspace dir, like a queue entry without repo.
 */

const KEY_PATTERN = /\b[A-Za-z][A-Za-z0-9]+-\d+\b/g;
const NAME_NOTES_MAX = 60;

const TEXT = {
  en: { name: "Refinement: {keys}", notes: "Additional notes:" },
  pt: { name: "Refinamento: {keys}", notes: "Observações adicionais:" },
};

/** The ticket keys in the pasted text, uppercased, in order, without repeats. */
function ticketKeys(text: string): string[] {
  return [...new Set((text.match(KEY_PATTERN) ?? []).map((key) => key.toUpperCase()))];
}

/** First line of the notes, cut to fit a session name. */
function notesForName(notes: string): string {
  const line = notes.trim().split(/\r?\n/, 1)[0]?.trim() ?? "";
  return line.length > NAME_NOTES_MAX ? `${line.slice(0, NAME_NOTES_MAX - 1).trimEnd()}…` : line;
}

export async function launchRefinement(
  { tasks, notes }: RefinementInput,
  layout?: TerminalLayout,
): Promise<{ sessionId: string | null }> {
  const keys = ticketKeys(tasks);
  if (keys.length === 0) {
    throw new BadRequestError("REFINEMENT_TASKS_REQUIRED", "Paste at least one ticket.");
  }
  const prefs = await getUserPreferences();
  const skill = await resolveInstalledSkill(
    prefs.taskRefinementSkill,
    "TASK_REFINEMENT_SKILL_NOT_INSTALLED",
  );
  if (!skill) {
    throw new BadRequestError(
      "TASK_REFINEMENT_SKILL_REQUIRED",
      "Choose the refinement skill first.",
    );
  }

  const text = TEXT[prefs.language ?? "en"];
  const trimmedNotes = notes.trim();
  const prompt = [`/${skill}\n${tasks.trim()}`, trimmedNotes && `${text.notes}\n${trimmedNotes}`]
    .filter(Boolean)
    .join("\n\n");
  const name = [text.name.replace("{keys}", keys.join(", ")), notesForName(trimmedNotes)]
    .filter(Boolean)
    .join(" ");

  return launchTaskTerminal({
    worktreePath: await firstWorkspaceDir(prefs),
    prompt,
    // An unfocused terminal can't answer permission prompts; the skill asks before writing to Jira.
    permissionModeAuto: true,
    repoRoot: "",
    name,
    layout,
  });
}
