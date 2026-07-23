import { AlertTriangle, RefreshCw } from "lucide-react";

type ErrorStateProps = {
  message: string;
  onRetry: () => void;
};

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 py-16 text-center dark:border-red-900/50 dark:bg-red-950/30">
      <AlertTriangle className="h-10 w-10 text-red-400 dark:text-red-500" />
      <p className="mt-3 text-sm font-medium text-red-800 dark:text-red-300">Erro ao carregar sessões</p>
      <p className="mt-1 max-w-sm text-sm text-red-600 dark:text-red-400">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-800 dark:bg-gray-900 dark:text-red-400 dark:hover:bg-red-950/50"
      >
        <RefreshCw className="h-4 w-4" />
        Tentar novamente
      </button>
    </div>
  );
}
