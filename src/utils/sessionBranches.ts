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
 * Branches encoded in a nickname: "<source> -> <dest>[ - <link>]", or just a destination branch.
 * Free-form text yields nulls.
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

type SessionBranches = { origin: string | null; destination: string | null };

/**
 * The session's base (origin) and task (destination) branches, for the card line, Jenkins and
 * "Open PR". Per side, first non-null wins:
 * 1. `savedOriginBranch`/`savedDestinationBranch` (`tasks.json`).
 * 2. The nickname's encoded branches. Dropping this fallback needs a one-time backfill of (1) in
 *    the same change; backfilling earlier would make nickname edits stop having any effect.
 * 3. `baseBranch`/`gitBranch`. `gitBranch` is the last branch seen in the transcript, not live
 *    git state; `baseBranch` is only recorded by "New task" when it differs from the default.
 * 4. Base only: the repo's `defaultBranch`.
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
