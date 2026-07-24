import {
  Check,
  Copy,
  DollarSign,
  Folder,
  Hash,
  Loader2,
  MessageSquare,
  Pencil,
  Play,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { useToast } from "../hooks/useToast";
import type { PendingAction } from "../hooks/useSessions";
import type { Session } from "../types/session";
import { PromptPreviewModal } from "./PromptPreviewModal";
import { RenameSessionModal } from "./RenameSessionModal";
import { Tooltip } from "./Tooltip";
import { UsageDetailsModal } from "./UsageDetailsModal";
import { formatUpdatedAt } from "../utils/formatDate";

type SessionCardProps = {
  session: Session;
  pendingAction?: PendingAction;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onContinue: (session: Session) => void;
  onDeleteRequest: (session: Session) => void;
  onRename: (session: Session, title: string) => void;
};

const COPIED_FEEDBACK_DURATION_MS = 2500;

export function SessionCard({
  session,
  pendingAction,
  selected,
  onToggleSelect,
  onContinue,
  onDeleteRequest,
  onRename,
}: SessionCardProps) {
  const isDeleting = pendingAction === "delete";
  const isContinuing = pendingAction === "continue";
  const isRenaming = pendingAction === "rename";
  const isBusy = isDeleting || isContinuing || isRenaming;
  const [copiedId, setCopiedId] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showUsage, setShowUsage] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const { showToast } = useToast();
  const resumeCommand = `claude --resume ${session.id}`;

  const handleCopySessionId = async () => {
    try {
      await navigator.clipboard.writeText(session.id);
      setCopiedId(true);
      showToast("Session ID copied to clipboard.", "success");
      setTimeout(() => setCopiedId(false), COPIED_FEEDBACK_DURATION_MS);
    } catch {
      showToast("Could not copy the session ID.", "error");
    }
  };

  const handleCopyCommand = async () => {
    const command = resumeCommand;
    try {
      await navigator.clipboard.writeText(command);
      setCopiedCommand(true);
      showToast("Command copied to clipboard.", "success");
      setTimeout(() => setCopiedCommand(false), COPIED_FEEDBACK_DURATION_MS);
    } catch {
      showToast("Could not copy the command.", "error");
    }
  };

  const renameButton = (
    <button
      type="button"
      onClick={() => setShowRenameModal(true)}
      disabled={isBusy || session.isActive}
      aria-label="Rename session"
      className="inline-flex shrink-0 items-center justify-center rounded p-1 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
    >
      {isRenaming ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Pencil className="h-3.5 w-3.5" />
      )}
    </button>
  );

  // Directory-missing is checked first: it's the more actionable problem to surface if a
  // session somehow ended up both without its original folder and (per stale process-list data)
  // still "active" — an edge case, but this keeps the tooltip pointing at the fixable issue.
  const continueDisabledReason = session.directoryMissing
    ? "Recreate the original folder (or a symlink to it) before resuming — the Claude CLI resolves sessions by working directory."
    : session.isActive
      ? "This session is already open in a terminal."
      : null;

  const continueButton = (
    <span className="flex flex-1">
      <button
        type="button"
        onClick={() => onContinue(session)}
        disabled={isBusy || continueDisabledReason !== null}
        className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-gray-700 dark:hover:bg-gray-600"
      >
        {isContinuing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        Continue (terminal)
      </button>
    </span>
  );

  const deleteButton = (
    <button
      type="button"
      onClick={() => onDeleteRequest(session)}
      disabled={isBusy || session.isActive}
      className="inline-flex items-center justify-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-red-400 dark:hover:bg-red-950/50"
    >
      {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      Delete
    </button>
  );

  return (
    <div
      className={`relative flex flex-col gap-2 justify-between rounded-xl border bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:bg-gray-900 ${
        selected
          ? "border-gray-900 ring-2 ring-gray-900/20 dark:border-gray-100 dark:ring-gray-100/20"
          : "border-gray-200 dark:border-gray-800"
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggleSelect(session.id)}
        disabled={isBusy || session.isActive}
        aria-label={selected ? "Deselect session" : "Select session"}
        className="absolute -top-1.5 -left-1.5 h-4 w-4 shrink-0 accent-gray-900 disabled:cursor-not-allowed disabled:opacity-40 dark:accent-gray-100"
      />

      <Tooltip
        content={
          session.isActive
            ? "Active — a terminal currently has this session resumed"
            : "Inactive — no terminal currently has this session resumed"
        }
      >
        <span
          aria-label={session.isActive ? "Active session" : "Inactive session"}
          className={`absolute -top-1 left-4 h-3 w-3 rounded-full border-2 border-white shadow dark:border-gray-900 ${
            session.isActive ? "bg-green-500 animate-pulse" : "bg-red-400"
          }`}
        />
      </Tooltip>

      <div className="flex items-start justify-between gap-2">
        <label className="flex min-w-0 items-start gap-2">
          <h2
            className="line-clamp-2 text-base font-semibold text-gray-900 dark:text-gray-100"
            title={session.title}
          >
            {session.title}
          </h2>
        </label>
        {session.isActive ? (
          // Same disabled-button-tooltip wrapper trick as the Continue button below — a native
          // `disabled` button won't reliably fire hover events on its own.
          <Tooltip content="Close this session in its terminal before renaming.">
            <span className="inline-flex shrink-0">{renameButton}</span>
          </Tooltip>
        ) : (
          <Tooltip content="Rename session">{renameButton}</Tooltip>
        )}
      </div>

      {session.directoryMissing && (
        <div
          className="flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
          title="This session's original directory no longer exists"
        >
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
          Original folder missing
        </div>
      )}

      <span
        className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400"
        title={"Project"}
      >
        <Folder className="h-3.5 w-3.5" />
        {session.project}
      </span>

      <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
        <span className="inline-flex items-center gap-1 font-mono text-[10px]" title={"Session ID"}>
          <Hash className="h-3.5 w-3.5" />
          {session.id}
        </span>
        <Tooltip content={copiedId ? "Session ID copied!" : "Copy session ID"}>
          <button
            type="button"
            onClick={handleCopySessionId}
            aria-label="Copy session ID"
            className="inline-flex items-center justify-center rounded p-1 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            {copiedId ? (
              <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </Tooltip>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Updated {formatUpdatedAt(session.updatedAt)}
        </p>
        <div className="flex items-center gap-1">
          {session.usage.models.length > 0 && (
            <Tooltip content="View token usage and estimated cost">
              <button
                type="button"
                onClick={() => setShowUsage(true)}
                aria-label="View usage and cost"
                className="inline-flex items-center justify-center rounded p-1 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                <DollarSign className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          )}
          {session.prompts.length > 0 && (
            <Tooltip content="Preview prompts sent in this session">
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                aria-label="Preview prompts"
                className="inline-flex items-center justify-center rounded p-1 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                <MessageSquare className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 text-sm text-gray-600 border-t border-gray-100 pt-3 dark:text-gray-400 dark:border-gray-800">
        <span
          className="inline-flex items-center gap-1 font-mono text-[8px]"
          title={"Resume command"}
        >
          {resumeCommand}
        </span>
        <Tooltip content={copiedCommand ? "Resume command copied!" : "Copy resume command"}>
          <button
            type="button"
            onClick={handleCopyCommand}
            aria-label="Copy resume command"
            className="inline-flex items-center justify-center rounded p-1 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            {copiedCommand ? (
              <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </Tooltip>
      </div>

      <div className="flex gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
        {continueDisabledReason !== null ? (
          // Native `disabled` buttons don't reliably fire hover events, so the tooltip needs a
          // separate, non-disabled wrapper — same pattern Radix's own docs recommend for
          // disabled-button tooltips (the wrapping `<span>` inside continueButton is that layer).
          <Tooltip content={continueDisabledReason}>{continueButton}</Tooltip>
        ) : (
          continueButton
        )}
        {session.isActive ? (
          <Tooltip content="Close this session in its terminal before deleting.">
            <span className="inline-flex shrink-0">{deleteButton}</span>
          </Tooltip>
        ) : (
          deleteButton
        )}
      </div>

      <PromptPreviewModal
        session={session}
        open={showPreview}
        onClose={() => setShowPreview(false)}
      />
      <UsageDetailsModal session={session} open={showUsage} onClose={() => setShowUsage(false)} />
      {showRenameModal && (
        <RenameSessionModal
          currentTitle={session.title}
          onSave={(title) => {
            setShowRenameModal(false);
            onRename(session, title);
          }}
          onCancel={() => setShowRenameModal(false)}
        />
      )}
    </div>
  );
}
