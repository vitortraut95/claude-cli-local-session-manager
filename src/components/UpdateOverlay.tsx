import { AlertTriangle, Loader2 } from "lucide-react";
import { createPortal } from "react-dom";
import { useLanguage } from "../hooks/useLanguage";
import { Button } from "./Button";

type UpdateOverlayProps = {
  updating: boolean;
  error: string | null;
  onDismissError: () => void;
};

/**
 * Full-screen overlay for the startup auto-update. Portaled to `document.body` so it covers the
 * whole viewport. Not dismissible while in progress, so nothing runs during the reset + install;
 * only the `error` state can be closed.
 */
export function UpdateOverlay({ updating, error, onDismissError }: UpdateOverlayProps) {
  const { t } = useLanguage();

  if (!updating && !error) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/70 backdrop-blur-sm dark:bg-black/80">
      <div className="mx-4 flex max-w-sm flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white p-6 text-center shadow-xl dark:border-gray-800 dark:bg-gray-900">
        {error ? (
          <>
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-500" />
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {t("updateOverlay.errorTitle")}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{error}</p>
            <Button variant="outline" size="sm" onClick={onDismissError} className="mt-1">
              {t("updateOverlay.dismiss")}
            </Button>
          </>
        ) : (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-gray-700 dark:text-gray-300" />
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {t("updateOverlay.title")}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("updateOverlay.subtitle")}
            </p>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
