import { Check, Copy, Folder, Hash, Loader2, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "../hooks/useToast";
import type { PendingAction } from "../hooks/useSessions";
import type { Session } from "../types/session";
import { Tooltip } from "./Tooltip";
import { formatUpdatedAt } from "../utils/formatDate";

type SessionCardProps = {
  session: Session;
  pendingAction?: PendingAction;
  onContinue: (session: Session) => void;
  onDeleteRequest: (session: Session) => void;
};

const COPIED_FEEDBACK_DURATION_MS = 1500;

export function SessionCard({
  session,
  pendingAction,
  onContinue,
  onDeleteRequest,
}: SessionCardProps) {
  const isDeleting = pendingAction === "delete";
  const isContinuing = pendingAction === "continue";
  const isBusy = isDeleting || isContinuing;
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();
  const resumeCommand = `claude --resume ${session.id}`;

  const handleCopyCommand = async () => {
    const command = resumeCommand;
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      showToast("Comando copiado para a área de transferência.", "success");
      setTimeout(() => setCopied(false), COPIED_FEEDBACK_DURATION_MS);
    } catch {
      showToast("Não foi possível copiar o comando.", "error");
    }
  };

  return (
    <div className="group rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <h2 className="line-clamp-2 text-base font-semibold text-gray-900" title={session.title}>
        {session.title}
      </h2>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
        <span className="inline-flex items-center gap-1.5">
          <Folder className="h-3.5 w-3.5" />
          {session.project}
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono text-xs" title={session.id}>
          <Hash className="h-3.5 w-3.5" />
          {session.id.slice(0, 8)}
        </span>
        <Tooltip content={copied ? "Copiado!" : resumeCommand}>
          <button
            type="button"
            onClick={handleCopyCommand}
            aria-label="Copiar comando de continuação"
            className="inline-flex items-center justify-center rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </Tooltip>
      </div>

      <p className="mt-2 text-xs text-gray-400">Atualizado {formatUpdatedAt(session.updatedAt)}</p>

      <div className="mt-4 flex gap-2 border-t border-gray-100 pt-3">
        <button
          type="button"
          onClick={() => onContinue(session)}
          disabled={isBusy}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isContinuing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          Continuar
        </button>
        <button
          type="button"
          onClick={() => onDeleteRequest(session)}
          disabled={isBusy}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          Excluir
        </button>
      </div>
    </div>
  );
}
