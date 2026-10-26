import { readSessionHead } from "../../utils/claudeProjects.js";
import { getGitHostInfo } from "../../utils/git.js";
import { SessionNotFoundError } from "./errors.js";
import { findSessionFilePath } from "./lookup.js";

/**
 * New-PR URL for a session's branch, opened in the user's browser (no API token). Null when there's
 * no known cwd or no github.com/bitbucket.org `origin`. Without `explicitBase` the host compares
 * against the repo's default branch.
 */
export async function getSessionPrUrl(
  id: string,
  branch: string,
  explicitBase?: string,
): Promise<string | null> {
  const trimmedBranch = branch.trim();
  if (!trimmedBranch) return null;
  const trimmedBase = explicitBase?.trim() ?? "";

  const filePath = await findSessionFilePath(id);
  if (!filePath) throw new SessionNotFoundError(id);
  const head = await readSessionHead(filePath);
  if (!head.cwd) return null;
  return buildPrUrl(head.cwd, trimmedBranch, trimmedBase);
}

/** The new-PR page for `branch` in the repo at `cwd` (github.com/bitbucket.org `origin` only);
 *  `base` "" = the host's own default. Also used for a task's repos that have no session. */
export async function buildPrUrl(
  cwd: string,
  trimmedBranch: string,
  trimmedBase: string,
): Promise<string | null> {
  const hostInfo = await getGitHostInfo(cwd);
  if (!hostInfo) return null;

  const encodedBranch = encodeURIComponent(trimmedBranch);
  if (hostInfo.host === "github") {
    const compareRef = trimmedBase
      ? `${encodeURIComponent(trimmedBase)}...${trimmedBranch}`
      : trimmedBranch;
    return `https://github.com/${hostInfo.slug}/compare/${compareRef}?expand=1`;
  }

  const destParam = trimmedBase ? `&dest=${encodeURIComponent(trimmedBase)}` : "";
  return `https://bitbucket.org/${hostInfo.slug}/pull-requests/new?source=${encodedBranch}${destParam}&t=1`;
}
