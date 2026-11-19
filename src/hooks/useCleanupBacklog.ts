import { useCallback, useEffect, useState } from "react";
import { fetchCleanupFindings, type CleanupFinding } from "../services/cleanupApi";

/** Above either, the Cleanup item is highlighted. */
const MANY_ITEMS = 20;
const MANY_BYTES = 500 * 1024 * 1024;
/** The scan walks every repo; it waits for the page's own first loads. */
const FIRST_SCAN_DELAY_MS = 5_000;

export type CleanupBacklog = { items: number; bytes: number; heavy: boolean };

/** Worktrees, sessions and task files each count as an item; cache only counts by size. */
export function summarizeFindings(findings: CleanupFinding[]): CleanupBacklog {
  let items = 0;
  let bytes = 0;
  for (const finding of findings) {
    if (finding.kind === "prune-worktrees") {
      items += finding.staleBranches.length;
    } else if (finding.kind === "prune-old-sessions") {
      items += finding.staleSessions.length;
      bytes += finding.staleSessions.reduce((sum, s) => sum + s.sizeBytes, 0);
    } else if (finding.kind === "remove-task-files") {
      const files = finding.staleFiles ?? [];
      if (finding.fileGroup !== "figma-cache") items += files.length;
      bytes += files.reduce((sum, f) => sum + f.sizeBytes, 0);
    } else {
      items += 1;
    }
  }
  return { items, bytes, heavy: items >= MANY_ITEMS || bytes >= MANY_BYTES };
}

/** How much the Cleanup panel would offer: scanned once after load and again on `recheck`
 *  (the panel closing). A failed scan just shows no highlight. */
export function useCleanupBacklog() {
  const [backlog, setBacklog] = useState<CleanupBacklog | null>(null);

  const recheck = useCallback(() => {
    fetchCleanupFindings().then(
      (findings) => setBacklog(summarizeFindings(findings)),
      () => setBacklog(null),
    );
  }, []);

  useEffect(() => {
    const timer = setTimeout(recheck, FIRST_SCAN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [recheck]);

  return { backlog, recheck };
}
