import { Loader2, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

type ModalSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

type ModalProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  isConfirmLoading?: boolean;
  confirmVariant?: "primary" | "danger";
  size?: ModalSize;
  icon?: ReactNode;
};

/**
 * Shared modal shell: standardizes the document.body portal, overlay, Escape/click-outside
 * handling, and the optional confirm/cancel footer. Portalled to document.body because these
 * modals are triggered from inside SessionCard, whose `hover:-translate-y-0.5` class makes it a
 * CSS containing block for `position: fixed` descendants while hovered — mounting outside its DOM
 * subtree avoids the card clipping the modal to its own bounds.
 */
export function Modal({
  open,
  title,
  children,
  onClose,
  onConfirm,
  onCancel,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isConfirmLoading = false,
  confirmVariant = "primary",
  size = "md",
  icon,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const confirmButtonClass =
    confirmVariant === "danger"
      ? "inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
      : "inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-gray-700 dark:hover:bg-gray-600";

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`flex max-h-[80vh] w-full ${SIZE_CLASSES[size]} flex-col rounded-xl bg-white shadow-xl dark:bg-gray-900`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-4 dark:border-gray-800">
          <div className="flex items-start gap-3">
            {icon}
            <h2
              className="line-clamp-1 text-base font-semibold text-gray-900 dark:text-gray-100"
              title={title}
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-4">{children}</div>

        {(onConfirm ?? onCancel) && (
          <div className="flex justify-end gap-2 border-t border-gray-100 p-4 dark:border-gray-800">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isConfirmLoading}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {cancelLabel}
              </button>
            )}
            {onConfirm && (
              <button
                type="button"
                onClick={onConfirm}
                disabled={isConfirmLoading}
                className={confirmButtonClass}
              >
                {isConfirmLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {confirmLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
