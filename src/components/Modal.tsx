import { Loader2, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../hooks/useLanguage";
import type { TerminalLayout } from "../services/preferencesApi";
import { Button } from "./Button";
import { LaunchLayoutButton } from "./LaunchLayoutButton";

type ModalSize = "sm" | "md" | "lg" | "xl" | "xxl" | "xxxl";

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  xxl: "max-w-6xl",
  xxxl: "max-w-[84rem]",
};

type ModalProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  onConfirm?: () => void;
  /** In place of `onConfirm` when confirming opens a Claude session: with the Limux grid as the
   *  layout, the button asks whether it opens in the grid or in a terminal. */
  onConfirmLaunch?: (layout?: TerminalLayout) => void;
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
 * Shared modal shell: document.body portal, overlay, Escape handling and optional footer. Portalled
 * because SessionCard's hover transform makes it a containing block for `position: fixed`
 * descendants, which would clip the modal to the card.
 *
 * No close on backdrop click, so an accidental click outside doesn't discard in-progress input.
 */
export function Modal({
  open,
  title,
  children,
  onClose,
  onConfirm,
  onConfirmLaunch,
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

  // Escape and the X button can't close the modal while a request is in flight (isConfirmLoading).
  const handleClose = () => {
    if (!isConfirmLoading) onClose();
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isConfirmLoading) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, isConfirmLoading, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-600/80 px-4">
      <div
        role="dialog"
        aria-modal="true"
        className={`flex max-h-[98dvh] w-full ${SIZE_CLASSES[size]} flex-col rounded-xl bg-white shadow-xl dark:bg-gray-900`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-8 py-4 dark:border-gray-800">
          <div className="flex items-start gap-3">
            {icon}
            <h2
              className="line-clamp-1 text-base font-semibold text-gray-900 dark:text-gray-100"
              title={title}
            >
              {title}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            aria-label={t("modal.closeAriaLabel")}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="overflow-y-auto px-8 py-4">{children}</div>

        {(onConfirm ?? onConfirmLaunch ?? onCancel) && (
          <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-8 py-4 dark:border-gray-800">
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
              {onConfirmLaunch ? (
                <LaunchLayoutButton
                  label={resolvedConfirmLabel}
                  busy={isConfirmLoading}
                  disabled={isConfirmDisabled}
                  onLaunch={onConfirmLaunch}
                  align="right"
                />
              ) : (
                onConfirm && (
                  <Button
                    variant={confirmVariant === "danger" ? "danger" : "primary"}
                    onClick={onConfirm}
                    disabled={isConfirmLoading || isConfirmDisabled}
                    icon={isConfirmLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  >
                    {resolvedConfirmLabel}
                  </Button>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
