import { Inbox, SearchX } from "lucide-react";

type EmptyStateProps = {
  hasSearchQuery: boolean;
};

export function EmptyState({ hasSearchQuery }: EmptyStateProps) {
  const Icon = hasSearchQuery ? SearchX : Inbox;

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center dark:border-gray-700 dark:bg-gray-900">
      <Icon className="h-10 w-10 text-gray-300 dark:text-gray-700" />
      <p className="mt-3 text-sm font-medium text-gray-900 dark:text-gray-100">
        {hasSearchQuery ? "No sessions found" : "No Claude sessions found"}
      </p>
      <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">
        {hasSearchQuery
          ? "Try adjusting your search terms."
          : "No sessions recorded yet in ~/.claude/projects."}
      </p>
    </div>
  );
}
