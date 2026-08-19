import { Loader2 } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";

export function LoadingState() {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center justify-center py-24 text-stone-500 dark:text-stone-400">
      <Loader2 className="h-8 w-8 animate-spin text-stone-400 dark:text-stone-500" />
      <p className="mt-3 text-sm">{t("loadingState.message")}</p>
    </div>
  );
}
