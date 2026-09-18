import { Loader2 } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";

type LoadingStateProps = {
  /** Only set once the mount-time scan has run long enough to be worth explaining — see
   *  useSessions.ts's scan-progress polling for why this never fires on a warm cache. */
  scanProgress?: { done: number; total: number } | null;
};

export function LoadingState({ scanProgress }: LoadingStateProps = {}) {
  const { t } = useLanguage();
  const scanning = scanProgress && scanProgress.total > 0;
  const percent = scanning ? Math.min(100, Math.round((scanProgress.done / scanProgress.total) * 100)) : 0;

  return (
    <div className="flex flex-col items-center justify-center py-24 text-gray-500 dark:text-gray-400">
      <Loader2 className="h-8 w-8 animate-spin text-gray-400 dark:text-gray-500" />
      {scanning ? (
        <>
          <p className="mt-3 max-w-sm text-center text-sm">{t("loadingState.scanning.title")}</p>
          <div className="mt-3 h-1.5 w-48 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-full rounded-full bg-gray-400 transition-all duration-300 dark:bg-gray-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-2 text-xs">
            {t("loadingState.scanning.progress", {
              done: scanProgress.done,
              total: scanProgress.total,
            })}
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm">{t("loadingState.message")}</p>
      )}
    </div>
  );
}
