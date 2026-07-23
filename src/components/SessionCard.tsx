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

const COPIED_FEEDBACK_DURATION_MS = 2500;

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

  const handleCopySessionId = async () => {
    try {
      await navigator.clipboard.writeText(session.id);
      setCopied(true);
      showToast("Session ID copied to clipboard.", "success");
      setTimeout(() => setCopied(false), COPIED_FEEDBACK_DURATION_MS);
    } catch {
      showToast("Could not copy the session ID.", "error");
    }
  }

  const handleCopyCommand = async () => {
    const command = resumeCommand;
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      showToast("Command copied to clipboard.", "success");
      setTimeout(() => setCopied(false), COPIED_FEEDBACK_DURATION_MS);
    } catch {
      showToast("Could not copy the command.", "error");
    }
  };

  return (
    <div className="flex flex-col gap-2 justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
      <h2
        className="line-clamp-2 text-base font-semibold text-gray-900 dark:text-gray-100"
        title={session.title}
      >
        {session.title}
      </h2>

      <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400" title={"Project"}>
        <Folder className="h-3.5 w-3.5" />
        {session.project}
      </span>

      <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
        <span className="inline-flex items-center gap-1 font-mono text-[10px]" title={"Session ID"}>
          <Hash className="h-3.5 w-3.5" />
          {session.id}
        </span>
        <Tooltip content={copied ? "Session ID copied!" : "Copy session ID"}>
          <button
            type="button"
            onClick={handleCopySessionId}
            aria-label="Copy session ID"
            className="inline-flex items-center justify-center rounded p-1 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </Tooltip>
      </div>

      <p className="text-xs text-gray-600 dark:text-gray-400">
        Updated {formatUpdatedAt(session.updatedAt)}
      </p>

      <div className="flex items-center gap-1 text-sm text-gray-600 border-t border-gray-100 pt-3 dark:text-gray-400 dark:border-gray-800">
        <span className="inline-flex items-center gap-1 font-mono text-[8px]" title={"Resume command"}>
          {resumeCommand}
        </span>
        <Tooltip content={copied ? "Resume command copied!" : "Copy resume command"}>
          <button
            type="button"
            onClick={handleCopyCommand}
            aria-label="Copy resume command"
            className="inline-flex items-center justify-center rounded p-1 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </Tooltip>
      </div>

      <div className="flex gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
        <button
          type="button"
          onClick={() => onContinue(session)}
          disabled={isBusy}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-gray-700 dark:hover:bg-gray-600"
        >
          {isContinuing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          Continue (terminal)
        </button>
        <button
          type="button"
          onClick={() => onDeleteRequest(session)}
          disabled={isBusy}
          className="inline-flex items-center justify-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-red-400 dark:hover:bg-red-950/50"
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          Delete
        </button>
      </div>
    </div>
  );
}
