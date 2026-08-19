import { Loader2, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../hooks/useLanguage";
import { Button } from "./Button";

type ModalSize = "sm" | "md" | "lg" | "xl" | "xxl";

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  xxl: "max-w-6xl",
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
  isConfirmDisabled?: boolean;
  confirmVariant?: "primary" | "danger";
  size?: ModalSize;
  icon?: ReactNode;
  /** Optional third footer action (e.g. "Clear"), rendered on the opposite side from
   *  Cancel/Confirm so it can't be mistaken for either of them. */
  onSecondary?: () => void;
  secondaryLabel?: string;
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
  confirmLabel,
  cancelLabel,
  isConfirmLoading = false,
  isConfirmDisabled = false,
  confirmVariant = "primary",
  size = "md",
  icon,
  onSecondary,
  secondaryLabel,
}: ModalProps) {
  const { t } = useLanguage();
  const resolvedConfirmLabel = confirmLabel ?? t("modal.confirmDefault");
  const resolvedCancelLabel = cancelLabel ?? t("modal.cancelDefault");

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-600/80 px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`flex max-h-[98dvh] w-full ${SIZE_CLASSES[size]} flex-col rounded-xl bg-white shadow-xl dark:bg-stone-700`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-8 py-4 dark:border-stone-800">
          <div className="flex items-start gap-3">
            {icon}
            <h2
              className="line-clamp-1 text-base font-semibold text-stone-900 dark:text-stone-100"
              title={title}
            >
              {title}
            </h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={t("modal.closeAriaLabel")}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="overflow-y-auto px-8 py-4">{children}</div>

        {(onConfirm ?? onCancel) && (
          <div className="flex items-center justify-between gap-2 border-t border-stone-100 px-8 py-4 dark:border-stone-800">
            <div>
              {onSecondary && (
                <Button variant="ghost" onClick={onSecondary} disabled={isConfirmLoading}>
                  {secondaryLabel}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {onCancel && (
                <Button variant="outline" onClick={onCancel} disabled={isConfirmLoading}>
                  {resolvedCancelLabel}
                </Button>
              )}
              {onConfirm && (
                <Button
                  variant={confirmVariant === "danger" ? "danger" : "primary"}
                  onClick={onConfirm}
                  disabled={isConfirmLoading || isConfirmDisabled}
                  icon={isConfirmLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                >
                  {resolvedConfirmLabel}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
