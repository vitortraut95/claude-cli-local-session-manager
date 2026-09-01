import { AlertTriangle, RefreshCw } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import { Button } from "./Button";

type ErrorStateProps = {
  message: string;
  onRetry: () => void;
};

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 py-16 text-center dark:border-red-900/50 dark:bg-red-950/30">
      <AlertTriangle className="h-10 w-10 text-red-400 dark:text-red-500" />
      <p className="mt-3 text-sm font-medium text-red-800 dark:text-red-300">
        {t("errorState.title")}
      </p>
      <p className="mt-1 max-w-sm text-sm text-red-600 dark:text-red-400">{message}</p>
      <Button
        variant="outline-danger"
        onClick={onRetry}
        icon={<RefreshCw className="h-4 w-4" />}
        className="mt-4"
      >
        {t("errorState.retry")}
      </Button>
    </div>
  );
}
