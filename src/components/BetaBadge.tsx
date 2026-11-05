import { Sparkles } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";

/** Marks a feature still in beta (the board automations). */
export function BetaBadge({ className = "" }: { className?: string }) {
  const { t } = useLanguage();
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase shadow-sm dark:from-violet-400 dark:to-fuchsia-400 dark:text-gray-950 ${className}`}
    >
      <Sparkles className="h-3 w-3" aria-hidden="true" />
      {t("common.beta")}
    </span>
  );
}
