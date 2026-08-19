import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useToast } from "../hooks/useToast";
import * as cleanupApi from "../services/cleanupApi";
import type { CleanupFinding } from "../services/cleanupApi";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { resolveApiErrorMessage } from "../utils/apiClient";

type CleanupModalProps = {
  open: boolean;
  onClose: () => void;
};

/** Renders a finding's title/description from its structured data rather than a pre-rendered
 *  server-side string — cleanupService.ts only knows English, so building the copy here is what
 *  lets it participate in the app's i18n instead of always showing up in English regardless of
 *  the selected language. */
function findingTitle(finding: CleanupFinding, t: ReturnType<typeof useLanguage>["t"]): string {
  if (finding.kind === "prune-worktrees") {
    return t("cleanupModal.finding.prune.title", { project: finding.repoRoot.split("/").pop() ?? finding.repoRoot });
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
export function CleanupModal({ open, onClose }: CleanupModalProps) {
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
              <p className="mt-2 break-all font-mono text-xs text-gray-400 dark:text-gray-500">
                {finding.command}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
