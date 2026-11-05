import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { runGit } from "../../utils/git.js";
import type { PullRequest } from "./types.js";

/**
 * Merge conflicts of open PRs, which the Bitbucket API doesn't report: a trial merge of the PR's
 * commit into its destination with `git merge-tree` in the local clone (only objects are written;
 * no branch, index or working tree changes). Results are kept per (PR commit, destination commit),
 * so a PR is only re-checked, and the clone only fetched, when either moves.
 */

const execFileAsync = promisify(execFile);
const checked = new Map<string, boolean>();

/** Exit 1 = conflicts; 0 = clean; anything else (a missing commit…) counts as clean. */
async function hasConflicts(
  repoPath: string,
  destination: string,
  source: string,
): Promise<boolean> {
  try {
    await execFileAsync(
      "git",
      ["merge-tree", "--write-tree", "--no-messages", destination, source],
      {
        cwd: repoPath,
        timeout: 60_000,
        maxBuffer: 8 * 1024 * 1024,
      },
    );
    return false;
  } catch (err) {
    return (err as { code?: unknown }).code === 1;
  }
}

/** Sets `hasConflicts` on `prs` (in place) for those with a local clone. A pair (PR commit,
 *  destination commit) already checked is answered from memory without touching the clone; the
 *  repo is only fetched when some pair is new. */
export async function markConflicts(
  prs: PullRequest[],
  localRepos: Record<string, string>,
): Promise<void> {
  const byRepo = new Map<string, PullRequest[]>();
  for (const pr of prs) {
    if (!pr.sourceHash || !pr.sourceBranch || !pr.destinationBranch || !localRepos[pr.repo])
      continue;
    const known = pr.destinationHash
      ? checked.get(`${pr.repo}|${pr.sourceHash}|${pr.destinationHash}`)
      : undefined;
    if (known !== undefined) {
      pr.hasConflicts = known;
      continue;
    }
    byRepo.set(pr.repo, [...(byRepo.get(pr.repo) ?? []), pr]);
  }
  for (const [repo, repoPrs] of byRepo) {
    const repoPath = localRepos[repo] ?? "";
    const branches = [
      ...new Set(repoPrs.flatMap((pr) => [pr.sourceBranch ?? "", pr.destinationBranch ?? ""])),
    ];
    const fetched = await runGit(["fetch", "origin", ...branches], repoPath, {
      nonInteractive: true,
      timeoutMs: 120_000,
    }).then(
      () => true,
      () => false,
    );
    if (!fetched) continue;
    for (const pr of repoPrs) {
      const destination = await runGit(
        ["rev-parse", `origin/${pr.destinationBranch}`],
        repoPath,
      ).catch(() => null);
      if (!destination || !pr.sourceHash) continue;
      const conflicts = await hasConflicts(repoPath, destination, pr.sourceHash);
      checked.set(`${repo}|${pr.sourceHash}|${destination}`, conflicts);
      // Also under the short hashes the API gives, so the next look finds it without git.
      if (pr.destinationHash) {
        checked.set(`${repo}|${pr.sourceHash}|${pr.destinationHash}`, conflicts);
      }
      pr.hasConflicts = conflicts;
    }
  }
}
