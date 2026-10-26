import type { Session } from "../../shared/session";

type SessionBranches = { origin: string | null; destination: string | null };

/**
 * The session's base (origin) and task (destination) branches, for the card line, Jenkins and
 * "Open PR". Per side, first non-null wins:
 * 1. `savedOriginBranch`/`savedDestinationBranch` (`tasks.json`).
 * 2. `baseBranch`/`gitBranch`. `gitBranch` is the last branch seen in the transcript, not live
 *    git state; `baseBranch` is only recorded by "New task" when it differs from the default.
 * 3. Base only: the repo's `defaultBranch`.
 */
export function resolveSessionBranches(
  session: Pick<
    Session,
    "gitBranch" | "baseBranch" | "savedOriginBranch" | "savedDestinationBranch" | "defaultBranch"
  >,
): SessionBranches {
  return {
    origin: session.savedOriginBranch ?? session.baseBranch ?? session.defaultBranch ?? null,
    destination: session.savedDestinationBranch ?? session.gitBranch,
  };
}
