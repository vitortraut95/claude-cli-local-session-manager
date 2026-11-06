import type { Session } from "../../shared/session";

/** How a session is named in lists: its local nickname when set, else its title. */
export function sessionDisplayTitle(session: Session): string {
  // An empty or blank nickname counts as none.
  return [session.nickname?.trim() ?? "", session.title].find((text) => text !== "") ?? "";
}

/** The repo the session runs in: the worktree's repo, else the folder's name. */
export function sessionRepoName(session: Session): string {
  const root = session.repoRoot ?? session.workingDirectory ?? "";
  return root.split("/").filter(Boolean).pop() ?? session.project;
}
