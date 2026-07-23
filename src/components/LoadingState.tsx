import { Loader2 } from "lucide-react";

export function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-gray-500 dark:text-gray-400">
      <Loader2 className="h-8 w-8 animate-spin text-gray-400 dark:text-gray-500" />
      <p className="mt-3 text-sm">Loading sessions...</p>
    </div>
  );
}
