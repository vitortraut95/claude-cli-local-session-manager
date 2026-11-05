import { resolveInstalledSkill } from "./installedSkillService.js";
import { getUserPreferences } from "./preferencesService.js";
import { launchTaskTerminal } from "./taskService.js";
import { firstWorkspaceDir } from "./workspaceService.js";
import { BadRequestError } from "../utils/httpError.js";
import type { TerminalLayout } from "../../shared/preferences.js";
import type { RefinementInput } from "../../shared/tasks.js";

/**
 * "Refine tasks": a batch of tickets and/or a sprint handed to `taskRefinementSkill` in a session of
 * its own (neither = the skill offers the team's sprints). No repo, branch or worktree — it opens in
 * the first workspace dir, like a queue entry without repo.
 */

const KEY_PATTERN = /\b[A-Za-z][A-Za-z0-9]+-\d+\b/g;
const NAME_NOTES_MAX = 60;

const TEXT = {
  en: {
    name: "Refinement",
    sprint: "Sprint: {sprint}",
    directToPo: "Straight to the PO (skip the technical round with the devs).",
    notes: "Additional notes:",
  },
  pt: {
    name: "Refinamento",
    sprint: "Sprint: {sprint}",
    directToPo: "Direto pro PO (pula a etapa técnica com os devs).",
    notes: "Observações adicionais:",
  },
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
  { tasks, notes, sprint = "", directToPo = false }: RefinementInput,
  layout?: TerminalLayout,
): Promise<{ sessionId: string | null }> {
  const prefs = await getUserPreferences();
  const skill = await resolveInstalledSkill(
    prefs.taskRefinementSkill,
    "TASK_REFINEMENT_SKILL_NOT_INSTALLED",
    "taskRefinementSkill",
  );
  if (!skill) {
    throw new BadRequestError(
      "TASK_REFINEMENT_SKILL_REQUIRED",
      "Choose the refinement skill first.",
    );
  }

  const text = TEXT[prefs.language ?? "en"];
  const trimmedTasks = tasks.trim();
  const trimmedSprint = sprint.trim();
  const trimmedNotes = notes.trim();
  const request = [
    trimmedSprint && text.sprint.replace("{sprint}", trimmedSprint),
    trimmedTasks,
    directToPo && text.directToPo,
  ]
    .filter(Boolean)
    .join("\n");
  const prompt = [
    request ? `/${skill}\n${request}` : `/${skill}`,
    trimmedNotes && `${text.notes}\n${trimmedNotes}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const subject = [ticketKeys(tasks).join(", "), trimmedSprint].filter(Boolean).join(" · ");
  const name = [subject ? `${text.name}: ${subject}` : text.name, notesForName(trimmedNotes)]
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
