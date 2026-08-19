import { Inbox, SearchX } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";

type EmptyStateProps = {
  hasSearchQuery: boolean;
};

export function EmptyState({ hasSearchQuery }: EmptyStateProps) {
  const { t } = useLanguage();
  const Icon = hasSearchQuery ? SearchX : Inbox;

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white py-16 text-center dark:border-stone-700 dark:bg-stone-900">
      <Icon className="h-10 w-10 text-stone-300 dark:text-stone-700" />
      <p className="mt-3 text-sm font-medium text-stone-900 dark:text-stone-100">
        {hasSearchQuery ? t("emptyState.noResultsTitle") : t("emptyState.noSessionsTitle")}
      </p>
      <p className="mt-1 max-w-sm text-sm text-stone-500 dark:text-stone-400">
        {hasSearchQuery
          ? t("emptyState.noResultsMessage")
          : t("emptyState.noSessionsMessage")}
      </p>
    </div>
  );
}
