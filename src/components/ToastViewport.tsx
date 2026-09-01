import { CheckCircle2, X, XCircle } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import { Button } from "./Button";
import type { ToastItem } from "../hooks/useToast";

type ToastViewportProps = {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
};

export function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  const { t } = useLanguage();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-4 z-50 flex w-full max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg transition-all ${
            toast.variant === "success"
              ? "border-green-200 bg-green-50 text-green-800 dark:border-green-900/90 dark:bg-green-950/90 dark:text-green-300"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-900/90 dark:bg-red-950/90 dark:text-red-300"
          }`}
        >
          {toast.variant === "success" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
          ) : (
            <XCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
          )}
          <p className="flex-1 text-sm font-medium">{toast.message}</p>
          <Button
            variant="unstyled"
            size="icon"
            onClick={() => onDismiss(toast.id)}
            className="text-current/60 hover:bg-black/5 dark:hover:bg-white/10"
            aria-label={t("toast.closeAriaLabel")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
