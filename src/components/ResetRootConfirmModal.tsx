import { AlertTriangle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useToast } from "../hooks/useToast";
import * as sessionsApi from "../services/sessionsApi";
import type { RootStatus, Session } from "../types/session";
import { FileListBox, StashList } from "./WorktreeToRootModal";
import { Modal } from "./Modal";
import { resolveApiErrorMessage } from "../utils/apiClient";

type ResetRootConfirmModalProps = {
  session: Session;
  onClose: () => void;
};

/**
 * The standalone "Reset root" quick action — discards root's uncommitted changes without going
 * through the full "worktree → root" wizard (choice → preview → confirm → progress) just to reach
 * its shared first step. Meant for the exact repeated loop this app's own worktree → root feature
 * was built for: copy a worktree in to test, look at it, then reset before copying the next one.
 *
 * Mounted only while open (same convention as NicknameModal) — fetches root's live status
 * on open via the lighter `fetchRootStatus` (same endpoint the wizard's own confirm step uses),
 * deferred through a 0ms timer so the fetch's setState calls land in a callback rather than
 * synchronously in the effect body (same pattern CleanupModal/NewTaskModal use for their own
 * on-open fetches).
 */
export function ResetRootConfirmModal({ session, onClose }: ResetRootConfirmModalProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [status, setStatus] = useState<RootStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      sessionsApi
        .fetchRootStatus(session.id)
        .then((result) => {
          if (!cancelled) setStatus(result);
        })
        .catch((err) => {
          if (!cancelled) {
            setStatusError(
              resolveApiErrorMessage(err, t, "resetRootConfirmModal.statusErrorFallback"),
            );
          }
        })
        .finally(() => {
          if (!cancelled) setLoadingStatus(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [session.id, t]);

  const handleClose = () => {
    // The reset request is already firing server-side — closing mid-request wouldn't stop it.
    if (resetting) return;
    onClose();
  };

  const handleConfirm = async () => {
    setResetting(true);
    try {
      const { stashRef } = await sessionsApi.resetRootWorkingTree(session.id);
      showToast(
        stashRef
          ? t("resetRootConfirmModal.toast.resetWithStash", { stashRef })
          : t("resetRootConfirmModal.toast.resetClean"),
        "success",
      );
      onClose();
    } catch (err) {
      showToast(
        resolveApiErrorMessage(err, t, "resetRootConfirmModal.toast.resetErrorFallback"),
        "error",
      );
    } finally {
      setResetting(false);
    }
  };

  return (
    <Modal
      open
      title={t("resetRootConfirmModal.title")}
      onClose={handleClose}
      onCancel={resetting ? undefined : handleClose}
      onConfirm={handleConfirm}
      confirmLabel={t("resetRootConfirmModal.confirmLabel")}
      cancelLabel={t("resetRootConfirmModal.cancel")}
      confirmVariant="danger"
      isConfirmLoading={resetting}
      isConfirmDisabled={loadingStatus || statusError !== null}
      size="sm"
    >
      <div className="flex flex-col gap-3">
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {/* A single child span, not bare text + <code> siblings — this <p> is a flex container,
              and mixed text/element siblings at that level each become their own flex item
              (breaking normal text wrapping) instead of flowing as one paragraph. */}
          <span>
            {t("resetRootConfirmModal.warningIntro")} <code>git stash apply</code>
            {t("resetRootConfirmModal.warningMiddle")} <code>node_modules</code>
            {t("resetRootConfirmModal.warningEnd")}
          </span>
        </p>
        {loadingStatus && (
          <p className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("resetRootConfirmModal.loading")}
          </p>
        )}
        {statusError && <p className="text-sm text-red-600 dark:text-red-400">{statusError}</p>}
        {status && !loadingStatus && (
          <>
            <p className="text-sm text-stone-600 dark:text-stone-400">
              {t("resetRootConfirmModal.branchPrefix")}{" "}
              <span className="font-mono font-medium text-stone-800 dark:text-stone-200">
                {status.rootBranch ?? t("resetRootConfirmModal.detachedHead")}
              </span>
              .
            </p>
            <FileListBox
              title={
                status.rootDirtyFiles.length === 0
                  ? t("resetRootConfirmModal.dirtyNoneTitle")
                  : t("resetRootConfirmModal.dirtyTitle")
              }
              files={status.rootDirtyFiles}
              tone={status.rootDirtyFiles.length > 0 ? "danger" : "neutral"}
            />
            <StashList stashes={status.appStashes} />
          </>
        )}
      </div>
    </Modal>
  );
}
