import { Inbox, SearchX } from "lucide-react";

type EmptyStateProps = {
  hasSearchQuery: boolean;
};

export function EmptyState({ hasSearchQuery }: EmptyStateProps) {
  const Icon = hasSearchQuery ? SearchX : Inbox;

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
      <Icon className="h-10 w-10 text-gray-300" />
      <p className="mt-3 text-sm font-medium text-gray-900">
        {hasSearchQuery ? "Nenhuma sessão encontrada" : "Nenhuma sessão do Claude encontrada"}
      </p>
      <p className="mt-1 max-w-sm text-sm text-gray-500">
        {hasSearchQuery
          ? "Tente ajustar os termos da busca."
          : "Ainda não há sessões registradas em ~/.claude/projects."}
      </p>
    </div>
  );
}
