import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { Modal } from "./Modal";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Extra content rendered below the message — e.g. a checkbox for an optional related action. */
  children?: ReactNode;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  isLoading = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  const { t } = useLanguage();
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      onConfirm={onConfirm}
      onCancel={onCancel}
      confirmLabel={confirmLabel ?? t("confirmDialog.confirm")}
      cancelLabel={cancelLabel ?? t("confirmDialog.cancel")}
      isConfirmLoading={isLoading}
      confirmVariant="danger"
      size="sm"
      icon={
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-vinho-600/10 dark:bg-vinho-900/40">
          <AlertTriangle className="h-5 w-5 text-vinho-600 dark:text-vinho-300" />
        </div>
      }
    >
      <p className="text-sm text-stone-500 dark:text-stone-400">{message}</p>
      {children}
    </Modal>
  );
}
