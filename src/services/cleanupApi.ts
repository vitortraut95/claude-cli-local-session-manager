import axios from "axios";
import { withServerErrorMessage } from "../utils/apiClient";

const client = axios.create({
  baseURL: "/cleanup",
});

export type StaleSession = {
  id: string;
  title: string;
  updatedAt: string;
  sizeBytes: number;
};

export type CleanupFinding = {
  id: string;
  kind:
    | "prune-worktrees"
    | "remove-merged-worktree"
    | "remove-abandoned-worktree"
    | "remove-done-task-worktree"
    | "prune-old-sessions";
  command: string;
  repoRoot: string;
  /** Only set for `prune-worktrees`; empty for the other kinds. */
  staleBranches: string[];
  worktreePath: string | null;
  branch: string | null;
  /** Only set for `remove-merged-worktree`; null for the other kinds. */
  defaultBranch: string | null;
  /** Only set for `prune-old-sessions` — the sessions beyond the configured keep-count for this
   *  repo that this finding would delete, most-recently-updated first; empty for the other kinds. */
  staleSessions: StaleSession[];
  /** Only set for `prune-old-sessions` — how many of this repo's most-recent sessions are being
   *  kept; 0 for the other kinds. */
  keepCount: number;
};

export async function fetchCleanupFindings(): Promise<CleanupFinding[]> {
  const { data } = await withServerErrorMessage(() =>
    client.get<{ findings: CleanupFinding[] }>("/findings"),
  );
  return data.findings;
}

/** Sends the finding object as listed; the server re-validates it before acting. */
export async function executeCleanupFinding(finding: CleanupFinding): Promise<void> {
  await withServerErrorMessage(() => client.post("/findings/execute", finding));
}

/** Why a session's worktree has nothing to offer right now. */
export type WorktreeSkipReason =
  "default-branch" | "uncommitted-changes" | "active-session" | "not-done" | "not-pushed";

/** A card's "remove worktree" check: the finding to confirm (merged, or done + pushed), or why
 *  there's none; null when the session isn't in a linked worktree. */
export async function fetchWorktreeCleanupForSession(
  sessionId: string,
): Promise<{ finding: CleanupFinding | null; reason: WorktreeSkipReason | null } | null> {
  const { data } = await withServerErrorMessage(() =>
    client.get<{
      result: { finding: CleanupFinding | null; reason: WorktreeSkipReason | null } | null;
    }>(`/worktree-for-session/${encodeURIComponent(sessionId)}`),
  );
  return data.result;
}
