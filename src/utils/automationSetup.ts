import type { AutomationSetupStatus } from "../services/boardWatcherApi";

export const SETUP_STEPS = [
  "claude",
  "jira",
  "board",
  "bitbucket",
  "repos",
  "extras",
  "finish",
] as const;
export type SetupStepKey = (typeof SETUP_STEPS)[number];

/** Which steps are done, from what's saved (the optional one counts once anything is set). */
export function setupStepsDone(status: AutomationSetupStatus): Record<SetupStepKey, boolean> {
  const { jira, board, bitbucket, extras } = status;
  return {
    claude: status.claude.installed,
    jira: Boolean(jira.site && jira.me && jira.token !== "missing"),
    board: Boolean(board.columns?.codeReview?.length),
    bitbucket: Boolean(bitbucket.workspace && bitbucket.token !== "missing"),
    repos:
      bitbucket.repos.length > 0 && bitbucket.repos.every((repo) => bitbucket.localRepos[repo]),
    extras:
      extras.teams !== "missing" ||
      (extras.jenkinsUser !== "missing" && extras.jenkinsToken !== "missing"),
    finish: status.enabled,
  };
}

/** Whether a new user still has something required to set up (the optional step aside). */
export function setupIncomplete(status: AutomationSetupStatus): boolean {
  const done = setupStepsDone(status);
  return SETUP_STEPS.some((step) => step !== "extras" && !done[step]);
}
