import { AlertTriangle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useToast } from "../hooks/useToast";
import * as cleanupApi from "../services/cleanupApi";
import type { CleanupFinding } from "../services/cleanupApi";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { formatUpdatedAt } from "../utils/formatDate";
import { formatBytes } from "../utils/sessionSize";

type CleanupModalProps = {
  open: boolean;
  onClose: () => void;
  /** Fired right after any finding is successfully executed, so the page's session list can drop
   *  whatever was just deleted — only `prune-old-sessions` actually changes it, but firing this
   *  unconditionally keeps the wiring simple (the same cheap refresh NewTaskModal's
   *  `onTaskCreated` already triggers). */
  onFindingExecuted?: () => void;
};

/** Renders a finding's title/description from its structured data rather than a pre-rendered
 *  server-side string — cleanupService.ts only knows English, so building the copy here is what
 *  lets it participate in the app's i18n instead of always showing up in English regardless of
 *  the selected language. */
function findingTitle(finding: CleanupFinding, t: ReturnType<typeof useLanguage>["t"]): string {
  const project = finding.repoRoot.split("/").pop() ?? finding.repoRoot;
  if (finding.kind === "prune-worktrees") {
    return t("cleanupModal.finding.prune.title", { project });
  }
  if (finding.kind === "prune-old-sessions") {
    return t("cleanupModal.finding.oldSessions.title", { count: finding.staleSessions.length, project });
  }
  return t("cleanupModal.finding.merged.title", { branch: finding.branch ?? "?" });
}

function findingDescription(finding: CleanupFinding, t: ReturnType<typeof useLanguage>["t"]): string {
  if (finding.kind === "prune-worktrees") {
    return t("cleanupModal.finding.prune.description", {
      count: finding.staleBranches.length,
      branches: finding.staleBranches.join(", "),
    });
  }
  if (finding.kind === "prune-old-sessions") {
    const freedBytes = finding.staleSessions.reduce((sum, s) => sum + s.sizeBytes, 0);
    return t("cleanupModal.finding.oldSessions.description", {
      keep: finding.keepCount,
      count: finding.staleSessions.length,
      freed: formatBytes(freedBytes),
    });
  }
  return t("cleanupModal.finding.merged.description", {
    branch: finding.branch ?? "?",
    defaultBranch: finding.defaultBranch ?? "?",
  });
}

/**
 * Lists local, one-click-safe cleanup findings (currently: stale worktree git metadata, and
 * worktrees whose branch is already merged — see cleanupService.ts for exactly what qualifies)
 * and lets each be fixed independently. Not always-mounted like NewTaskModal — there's no
 * in-progress form input here worth preserving across an accidental close, so a plain
 * conditional-fetch-on-open is enough.
 */
export function CleanupModal({ open, onClose, onFindingExecuted }: CleanupModalProps) {
  const { showToast } = useToast();
  const { t } = useLanguage();

  const [findings, setFindings] = useState<CleanupFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [executingId, setExecutingId] = useState<string | null>(null);

  // Re-fetched every time the modal opens (not just once on mount) — deferred via a 0ms timer so
  // its setState calls happen in a callback, not synchronously in the effect body (same pattern
  // as NewTaskModal's project-folder refresh).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      setLoadError(null);
      cleanupApi
        .fetchCleanupFindings()
        .then((list) => {
          if (!cancelled) setFindings(list);
        })
        .catch((err) => {
          if (!cancelled) {
            setLoadError(
              resolveApiErrorMessage(err, t, "cleanupModal.loadError"),
            );
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, t]);

  const handleExecute = async (finding: CleanupFinding) => {
    setExecutingId(finding.id);
    try {
      await cleanupApi.executeCleanupFinding(finding);
      setFindings((current) => current.filter((item) => item.id !== finding.id));
      showToast(t("cleanupModal.resolved"), "success");
      onFindingExecuted?.();
    } catch (err) {
      showToast(
        resolveApiErrorMessage(err, t, "cleanupModal.runError"),
        "error",
      );
    } finally {
      setExecutingId(null);
    }
  };

  return (
    <Modal
      open={open}
      title={t("cleanupModal.title")}
      onClose={onClose}
      onCancel={onClose}
      cancelLabel={t("cleanupModal.close")}
      size="xl"
    >
      <div className="flex flex-col gap-2 mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-400">
        <p>
          <strong>{t("cleanupModal.howItWorks.label")}</strong> {t("cleanupModal.howItWorks.body")}
        </p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>
            <strong>{t("cleanupModal.finding.manualDelete.label")}</strong>{" "}
            {t("cleanupModal.finding.manualDelete.body")}
          </li>
          <li>
            <strong>{t("cleanupModal.finding.mergedBranch.label")}</strong>{" "}
            {t("cleanupModal.finding.mergedBranch.body")}
          </li>
          <li>
            <strong>{t("cleanupModal.finding.oldSessions.label")}</strong>{" "}
            {t("cleanupModal.finding.oldSessions.body")}
          </li>
        </ul>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("cleanupModal.loading")}
        </p>
      ) : loadError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
      ) : findings.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("cleanupModal.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {findings.map((finding) => (
            <li
              key={finding.id}
              className="rounded-lg border border-gray-200 p-3 dark:border-gray-800"
            >
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {findingTitle(finding, t)}
              </p>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {findingDescription(finding, t)}
              </p>
              {finding.kind === "prune-old-sessions" && (
                <>
                  <p className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-400">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {t("cleanupModal.finding.oldSessions.warning")}
                  </p>
                  <ul className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-800">
                    {finding.staleSessions.map((session) => (
                      <li
                        key={session.id}
                        className="flex items-center justify-between gap-2 border-b border-gray-100 px-2 py-1 text-xs last:border-b-0 dark:border-gray-800/60"
                      >
                        <span className="truncate text-gray-700 dark:text-gray-300">
                          {session.title}
                        </span>
                        <span className="shrink-0 text-gray-400 dark:text-gray-500">
                          {formatUpdatedAt(session.updatedAt)} · {formatBytes(session.sizeBytes)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <div className="mt-3 flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExecute(finding)}
                  disabled={executingId !== null}
                  icon={
                    executingId === finding.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : undefined
                  }
                >
                  {t("cleanupModal.run")}
                </Button>
              </div>
              {finding.command && (
                <p className="mt-2 break-all font-mono text-xs text-gray-400 dark:text-gray-500">
                  {finding.command}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
