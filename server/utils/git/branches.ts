import { AppError } from "../httpError.js";
import { runGit } from "./core.js";

export async function branchExists(cwd: string, branch: string): Promise<boolean> {
  try {
    await runGit(["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], cwd);
    return true;
  } catch {
    return false;
  }
}

const ORIGIN_HEAD_REF_PATTERN = /^refs\/remotes\/origin\/(.+)$/;

/** The repo's default branch: `origin/HEAD`, else a local `main`/`master`, else the current one. */
export async function getDefaultBaseBranch(cwd: string): Promise<string> {
  try {
    const ref = await runGit(["symbolic-ref", "refs/remotes/origin/HEAD"], cwd);
    const match = ORIGIN_HEAD_REF_PATTERN.exec(ref);
    if (match?.[1]) return match[1];
  } catch {
    // No origin, or no origin/HEAD set — fall through.
  }

  for (const candidate of ["main", "master"]) {
    if (await branchExists(cwd, candidate)) return candidate;
  }

  try {
    return await runGit(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
  } catch {
    return "main";
  }
}

/**
 * Updates only the `origin/<baseBranch>` remote-tracking ref, which is safe even while
 * `baseBranch` is checked out somewhere (fetching into the local branch would be refused).
 */
async function fetchOriginBranch(cwd: string, baseBranch: string): Promise<void> {
  await runGit(
    ["fetch", "origin", `refs/heads/${baseBranch}:refs/remotes/origin/${baseBranch}`],
    cwd,
    { nonInteractive: true, timeoutMs: 30_000 },
  );
}

/**
 * The starting ref for a new task's branch: a freshly fetched `origin/<baseBranch>`, falling back
 * to the local branch (offline, no origin, local-only). `useLocalBranch` always uses the local
 * branch, keeping unpushed commits.
 */
export async function resolveBaseBranchRef(
  cwd: string,
  baseBranch: string,
  useLocalBranch = false,
): Promise<string> {
  if (useLocalBranch) {
    if (await branchExists(cwd, baseBranch)) return baseBranch;
    throw new AppError(
      "TASK_BASE_BRANCH_NOT_FOUND",
      `Base branch "${baseBranch}" was not found locally.`,
    );
  }

  const fetched = await fetchOriginBranch(cwd, baseBranch)
    .then(() => true)
    .catch(() => false);
  if (fetched) return `origin/${baseBranch}`;

  if (await branchExists(cwd, baseBranch)) return baseBranch;

  throw new AppError(
    "TASK_BASE_BRANCH_NOT_FOUND",
    `Base branch "${baseBranch}" was not found locally or on origin.`,
  );
}

/** `git branch -D`; git still refuses when `branch` is checked out in `cwd`. */
export async function deleteLocalBranch(cwd: string, branch: string): Promise<void> {
  await runGit(["branch", "-D", branch], cwd);
}

/** Creates a new branch off `baseBranchRef` and checks it out directly in `repoRoot`. */
export async function checkoutNewBranch(
  repoRoot: string,
  branchName: string,
  baseBranchRef: string,
): Promise<void> {
  // `--no-track`: see createWorktreeWithBranch.
  await runGit(["checkout", "--no-track", "-b", branchName, baseBranchRef], repoRoot);
}

/** True if every commit on `branch` is an ancestor of `ontoBranch` (local refs only, no fetch). */
export async function isBranchMerged(
  repoRoot: string,
  branch: string,
  ontoBranch: string,
): Promise<boolean> {
  try {
    await runGit(["merge-base", "--is-ancestor", branch, ontoBranch], repoRoot);
    return true;
  } catch {
    return false;
  }
}

/** True when `branch` has a commit no other ref (branch, remote-tracking branch, tag) reaches,
 *  i.e. deleting it would lose history. */
export async function branchHasUniqueCommits(repoRoot: string, branch: string): Promise<boolean> {
  try {
    const count = await runGit(
      [
        "rev-list",
        "--count",
        `refs/heads/${branch}`,
        "--not",
        // Short name: with `--branches`, `--exclude` matches without the `refs/heads/` prefix.
        `--exclude=${branch}`,
        "--branches",
        "--remotes",
        "--tags",
      ],
      repoRoot,
    );
    return Number(count.trim()) > 0;
  } catch {
    // Can't tell: treat as "has commits" so nothing is offered for deletion on a guess.
    return true;
  }
}

/** True when `origin/<branch>` exists (as last fetched — no fetch here) and holds every commit of
 *  the local branch, so dropping the local checkout loses nothing that isn't on the remote. */
export async function isBranchPushed(repoRoot: string, branch: string): Promise<boolean> {
  try {
    const count = await runGit(
      ["rev-list", "--count", `refs/remotes/origin/${branch}..refs/heads/${branch}`],
      repoRoot,
    );
    return Number(count.trim()) === 0;
  } catch {
    // No such remote branch (never pushed), or can't tell.
    return false;
  }
}

export async function checkoutExistingBranch(cwd: string, branch: string): Promise<void> {
  await runGit(["checkout", branch], cwd);
}
