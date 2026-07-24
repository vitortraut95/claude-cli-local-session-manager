import { AlertTriangle } from "lucide-react";
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
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      onConfirm={onConfirm}
      onCancel={onCancel}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      isConfirmLoading={isLoading}
      confirmVariant="danger"
      size="sm"
      icon={
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/50">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
        </div>
      }
    >
      <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
    </Modal>
  );
}
