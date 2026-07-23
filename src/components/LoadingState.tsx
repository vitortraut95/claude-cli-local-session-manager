import { Loader2 } from "lucide-react";

export function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-gray-500">
      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      <p className="mt-3 text-sm">Carregando sessões...</p>
    </div>
  );
}
