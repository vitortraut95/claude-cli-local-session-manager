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
  kind: "prune-worktrees" | "remove-merged-worktree" | "prune-old-sessions";
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

/** Sends the exact finding object the list returned — the server re-validates it from scratch
 *  rather than trusting it, so this is just "which one to act on", not a shortcut around safety
 *  checks. */
export async function executeCleanupFinding(finding: CleanupFinding): Promise<void> {
  await withServerErrorMessage(() => client.post("/findings/execute", finding));
}
