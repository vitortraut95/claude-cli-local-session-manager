import type { TranslationKey } from "../i18n/translations";
import type { Step } from "./steps";

/** The "Branch type" select's "type your own" option. */
export const OTHER_PREFIX_VALUE = "__other__";
// Fallback until userPreferences.json's `branchTypes` loads.
export const FALLBACK_BRANCH_TYPES = ["feature", "fix"];

/** Matches a Jira-style ticket key both in a bare form ("PROJ-123") and inside a full browse URL
 *  ("https://company.atlassian.net/browse/PROJ-123?foo=bar"). */
const JIRA_ID_PATTERN = /([A-Za-z][A-Za-z0-9]+-\d+)/;

export function extractJiraId(link: string): string | null {
  const match = JIRA_ID_PATTERN.exec(link.trim());
  return match?.[1] ? match[1].toUpperCase() : null;
}

type StepKey = "repo" | "base" | "worktree" | "launch";

const STEP_LABEL_KEYS: Record<StepKey, TranslationKey> = {
  repo: "newTaskModal.step.repo",
  base: "newTaskModal.step.base",
  worktree: "newTaskModal.step.worktree",
  launch: "newTaskModal.step.launch",
};
const STEP_ORDER: StepKey[] = ["repo", "base", "worktree", "launch"];

/** The "worktree" step's label changes when the "no worktree" checkbox is on. */
function getStepLabelKey(key: StepKey, useWorktree: boolean): TranslationKey {
  if (key === "worktree" && !useWorktree) {
    return "newTaskModal.step.worktreeNoWorktree";
  }
  return STEP_LABEL_KEYS[key];
}

/** Step key of one of the task's extra repos. */
export function extraRepoStepKey(path: string): string {
  return `extra:${path}`;
}

/** Every step of a create attempt, all "pending": the main ones, then one per extra repo before
 *  the launch. */
export function buildNewTaskSteps(
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
  useWorktree: boolean,
  extras: { path: string; label: string }[],
): Step[] {
  const stepFor = (key: StepKey): Step => ({
    key,
    label: t(getStepLabelKey(key, useWorktree)),
    status: "pending",
  });
  return [
    ...STEP_ORDER.filter((key) => key !== "launch").map(stepFor),
    ...extras.map((repo) => ({
      key: extraRepoStepKey(repo.path),
      label: t("newTaskModal.step.extraRepo", { project: repo.label }),
      status: "pending" as const,
    })),
    stepFor("launch"),
  ];
}

/** Joins the non-empty prompt parts with a blank line between them. */
export function joinPromptParts(parts: (string | null)[]): string {
  return parts.filter((part): part is string => Boolean(part)).join("\n\n");
}
