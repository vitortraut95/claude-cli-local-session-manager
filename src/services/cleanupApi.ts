import axios from "axios";
import { withServerErrorMessage } from "../utils/apiClient";
import type { CleanupFinding, WorktreeSkipReason } from "../../shared/cleanup";
export type { CleanupFinding, StaleSession, WorktreeSkipReason } from "../../shared/cleanup";

const client = axios.create({
  baseURL: "/cleanup",
});

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
