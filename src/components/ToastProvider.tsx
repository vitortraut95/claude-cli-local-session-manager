import { useCallback, useRef, useState, type ReactNode } from "react";
import { ToastContext, type ToastItem, type ToastVariant } from "../hooks/useToast";
import { ToastViewport } from "./ToastViewport";

const TOAST_DURATION_MS = 3500;
// Error toasts sometimes carry actionable troubleshooting text (e.g. a shell command to copy) —
// give those more time to read/copy than a short success confirmation.
const ERROR_TOAST_DURATION_MS = 10000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "success") => {
      const id = `toast-${nextId.current++}`;
      setToasts((current) => [...current, { id, message, variant }]);
      const duration = variant === "error" ? ERROR_TOAST_DURATION_MS : TOAST_DURATION_MS;
      setTimeout(() => dismissToast(id), duration);
    },
    [dismissToast],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}
