import { Share, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useToast } from "../hooks/useToast";
import * as sessionsApi from "../services/sessionsApi";
import type { Session } from "../types/session";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { Modal } from "./Modal";

type ExportSessionModalProps = {
  session: Session;
  onClose: () => void;
};

/**
 * Confirm step before downloading a session's export file (see server-side `exportSession`) —
 * exists mainly to say plainly that the file holds the *whole* conversation, including every file
 * and command output Claude saw, before it gets sent to someone else.
 */
export function ExportSessionModal({ session, onClose }: ExportSessionModalProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await sessionsApi.exportSession(session.id);
      showToast(t("exportSessionModal.success"), "success");
      onClose();
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "exportSessionModal.error"), "error");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal
      open
      title={t("exportSessionModal.title")}
      onClose={onClose}
      onCancel={onClose}
      onConfirm={() => void handleExport()}
      confirmLabel={t("exportSessionModal.confirm")}
      cancelLabel={t("exportSessionModal.cancel")}
      isConfirmLoading={exporting}
      size="md"
      icon={<Share className="h-5 w-5 text-gray-500 dark:text-gray-400" />}
    >
      <p className="text-sm text-gray-600 dark:text-gray-400">{t("exportSessionModal.intro")}</p>

      <div className="mt-4 flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{t("exportSessionModal.sensitiveWarning")}</p>
      </div>

      <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        {t("exportSessionModal.recipientHint")}
      </p>
    </Modal>
  );
}
