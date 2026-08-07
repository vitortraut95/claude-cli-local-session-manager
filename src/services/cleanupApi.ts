import axios from "axios";
import { withServerErrorMessage } from "../utils/apiClient";

const client = axios.create({
  baseURL: "/cleanup",
});

export type CleanupFinding = {
  id: string;
  kind: "prune-worktrees" | "remove-merged-worktree";
  command: string;
  repoRoot: string;
  /** Only set for `prune-worktrees`; empty for `remove-merged-worktree`. */
  staleBranches: string[];
  worktreePath: string | null;
  branch: string | null;
  /** Only set for `remove-merged-worktree`; null for `prune-worktrees`. */
  defaultBranch: string | null;
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
