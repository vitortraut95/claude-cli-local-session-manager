import { Loader2, Play, Scissors, TriangleAlert } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import type { Session } from "../types/session";
import { formatBytes } from "../utils/sessionSize";
import { Button } from "./Button";
import { Modal } from "./Modal";

type SessionSizeGateModalProps = {
  session: Session;
  isContinuing: boolean;
  onContinueAnyway: () => void;
  onCompactInstead: () => void;
  onCancel: () => void;
};

/**
 * Shown instead of resuming directly once `resumeSession` (useSessions.ts) finds the session's
 * `.jsonl` past the "healthy" size threshold — offers a real alternative (compact & continue in a
 * lighter pt2) alongside the option to just continue in the large session anyway, rather than
 * either silently resuming into it or blocking the Resume button outright.
 */
export function SessionSizeGateModal({
  session,
  isContinuing,
  onContinueAnyway,
  onCompactInstead,
  onCancel,
}: SessionSizeGateModalProps) {
  const { t } = useLanguage();

  return (
    <Modal open title={t("sizeGateModal.title")} onClose={onCancel} size="md">
      <p className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        {t("sizeGateModal.body", { size: formatBytes(session.sizeBytes) })}
      </p>

      <div className="mt-4 rounded-lg border border-violet-200 p-3 dark:border-violet-900/60">
        <p className="flex items-center gap-1.5 text-sm font-medium text-violet-700 dark:text-violet-400">
          <Scissors className="h-4 w-4 shrink-0" />
          {t("sizeGateModal.compact.title")}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {t("sizeGateModal.compact.body")}
        </p>
        <div className="mt-2">
          <Button variant="outline" size="sm" onClick={onCompactInstead}>
            {t("sizeGateModal.compact.button")}
          </Button>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-gray-200 p-3 dark:border-gray-800">
        <p className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
          <Play className="h-4 w-4 shrink-0" />
          {t("sizeGateModal.continueAnyway.title")}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {t("sizeGateModal.continueAnyway.body")}
        </p>
        <div className="mt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isContinuing}
            onClick={onContinueAnyway}
            icon={isContinuing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          >
            {t("sizeGateModal.continueAnyway.button")}
          </Button>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button variant="outline" onClick={onCancel} disabled={isContinuing}>
          {t("sizeGateModal.cancel")}
        </Button>
      </div>
    </Modal>
  );
}
