import type { Session } from "../types/session";

const ARROW_SEPARATOR = " -> ";
const LINK_SEPARATOR = " - ";
const BRANCH_LIKE = /^[\w][\w./-]*\/[\w][\w./-]*$/;

function asBranch(text: string): string | null {
  const trimmed = text.trim();
  return BRANCH_LIKE.test(trimmed) ? trimmed : null;
}

type NicknameBranches = { origin: string | null; destination: string | null };

/**
 * Parses this app's own nickname conventions for a task session: the "New task" modal's
 * auto-nickname format ("<source> -> <dest>[ - <jira link>]"), or a nickname that's just the raw
 * destination branch on its own (no origin in that shape). Anything else (free-form text) yields
 * nulls rather than guessing — a nickname is a user-owned label, not guaranteed to encode a branch
 * at all.
 */
function parseNicknameBranches(nickname: string | null): NicknameBranches {
  if (!nickname) return { origin: null, destination: null };
  const arrowIndex = nickname.indexOf(ARROW_SEPARATOR);
  if (arrowIndex === -1) return { origin: null, destination: asBranch(nickname) };
  const afterArrow = nickname.slice(arrowIndex + ARROW_SEPARATOR.length);
  const linkIndex = afterArrow.indexOf(LINK_SEPARATOR);
  const destinationText = linkIndex === -1 ? afterArrow : afterArrow.slice(0, linkIndex);
  return {
    origin: asBranch(nickname.slice(0, arrowIndex)),
    destination: asBranch(destinationText),
  };
}

export type SessionBranches = { origin: string | null; destination: string | null };

/**
 * Single source of truth for "which branches is this session actually about" — feeds the card's
 * branch line and the "Open Jenkins"/"Open PR" links. Per side, first non-null wins:
 * 1. `savedOriginBranch`/`savedDestinationBranch` — set on the card's branch editor or recorded by
 *    "New task" at launch (`session-branches.json`).
 * 2. The nickname's encoded branches — how they were corrected before (1) existed. Kept as a
 *    fallback so older sessions keep working; meant to be dropped later together with a one-time
 *    backfill of (1) from the nicknames (a backfill now would freeze them and make nickname edits
 *    stop having any effect).
 * 3. The session's own recorded fields (`gitBranch`/`baseBranch`, both server-computed), which can
 *    be missing or stale.
 * 4. For the base only: the repo's `defaultBranch` — `baseBranch` is never recorded for a task
 *    branched off the default, so without this a task off master would show no base at all.
 *
 * About (3):
 * - `gitBranch` is the *last branch recorded in the session's own transcript*
 *   (`claudeProjects.ts`'s `findLatestGitBranch`), not live git state — it misses a branch
 *   created/switched outside of any Claude Code turn in that session (e.g. work done ahead on the
 *   base branch, committed to a task branch afterward), staying stuck on the old branch forever.
 * - `baseBranch` (`taskBaseBranches.json`) is only ever recorded when a task's branch was created
 *   through this app's own "New task" flow and differs from the repo's default — a session
 *   advanced manually never gets an entry, so it's always null there regardless of the real base.
 */
export function resolveSessionBranches(
  session: Pick<
    Session,
    | "gitBranch"
    | "baseBranch"
    | "nickname"
    | "savedOriginBranch"
    | "savedDestinationBranch"
    | "defaultBranch"
  >,
): SessionBranches {
  const fromNickname = parseNicknameBranches(session.nickname);
  return {
    origin:
      session.savedOriginBranch ??
      fromNickname.origin ??
      session.baseBranch ??
      session.defaultBranch ??
      null,
    destination: session.savedDestinationBranch ?? fromNickname.destination ?? session.gitBranch,
  };
}
