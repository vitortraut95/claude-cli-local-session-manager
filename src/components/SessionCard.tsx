import {
  Bot,
  Check,
  Clock,
  Code2,
  Copy,
  DollarSign,
  Folder,
  GitBranch,
  GitFork,
  Lightbulb,
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
import { Button } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";
import { CreateWorktreeModal } from "./CreateWorktreeModal";
import { PromptPreviewModal } from "./PromptPreviewModal";
import { InsightsModal } from "./InsightsModal";
import { NicknameModal } from "./NicknameModal";
import { SessionSizeMeter } from "./SessionSizeMeter";
import { SubagentsModal } from "./SubagentsModal";
import { ToolbarIconButton } from "./ToolbarIconButton";
import { Tooltip } from "./Tooltip";
import { UsageDetailsModal } from "./UsageDetailsModal";
import { formatActiveTime, formatUpdatedAt } from "../utils/formatDate";
import { formatWorktreePath } from "../utils/formatPath";

type SessionCardProps = {
  session: Session;
  pendingAction?: PendingAction;
  selected: boolean;
  hasSiblingActiveSession: boolean;
  onToggleSelect: (id: string) => void;
  onContinue: (session: Session) => void;
  onDeleteRequest: (session: Session) => void;
  onSetNickname: (session: Session, nickname: string) => void;
  onOpenInVSCode: (session: Session) => void;
  onCreateWorktree: (session: Session, name: string) => void;
  onDeleteWorktree: (session: Session) => void;
};

const COPIED_FEEDBACK_DURATION_MS = 2500;

export function SessionCard({
  session,
  pendingAction,
  selected,
  hasSiblingActiveSession,
  onToggleSelect,
  onContinue,
  onDeleteRequest,
  onSetNickname,
  onOpenInVSCode,
  onCreateWorktree,
  onDeleteWorktree,
}: SessionCardProps) {
  const isDeleting = pendingAction === "delete";
  const isContinuing = pendingAction === "continue";
  const isSettingNickname = pendingAction === "nickname";
  const isOpeningVSCode = pendingAction === "vscode";
  const isCreatingWorktree = pendingAction === "worktree-create";
  const isDeletingWorktree = pendingAction === "worktree-delete";
  const isBusy = isDeleting || isContinuing || isSettingNickname;
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showUsage, setShowUsage] = useState(false);
  const [showSubagents, setShowSubagents] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [showCreateWorktreeModal, setShowCreateWorktreeModal] = useState(false);
  const [showDeleteWorktreeConfirm, setShowDeleteWorktreeConfirm] = useState(false);
  const { showToast } = useToast();
  const resumeCommand = `claude --resume ${session.id}`;
  const worktreePathParts =
    session.isWorktree && session.workingDirectory
      ? formatWorktreePath(session.workingDirectory)
      : null;

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

  const nicknameButton = (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setShowNicknameModal(true)}
      disabled={isBusy || session.isActive}
      aria-label={session.nickname ? "Edit local nickname" : "Add local nickname"}
      icon={
        isSettingNickname ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Pencil className="h-3.5 w-3.5" />
        )
      }
    />
  );

  // Unlike Delete/nickname-edit, Resume stays clickable even while the session is already active
  // elsewhere: onContinue (useSessions.ts resumeSession) does a fresh live check and, if it's
  // still active, offers a choice (create a worktree, or stop that terminal and resume here)
  // instead of just refusing outright. Only a missing directory blocks it outright — there's
  // nothing to offer an alternative for there.
  const continueDisabledReason = session.directoryMissing
    ? "Recreate the original folder (or a symlink to it) before resuming — the Claude CLI resolves sessions by working directory."
    : null;

  const continueButton = (
    <span className="flex flex-1">
      <Button
        variant="primary"
        size="sm"
        fullWidth
        onClick={() => onContinue(session)}
        disabled={isBusy || continueDisabledReason !== null}
        icon={
          isContinuing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />
        }
      >
        Resume (terminal)
      </Button>
    </span>
  );

  const deleteButton = (
    <Button
      variant="outline-danger"
      size="sm"
      onClick={() => onDeleteRequest(session)}
      disabled={isBusy || session.isActive}
      icon={
        isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />
      }
    >
      Delete
    </Button>
  );

  return (
    <div
      className={`relative flex flex-col gap-2 justify-between rounded-xl border bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:bg-gray-900 ${
        selected
          ? "border-gray-900 ring-2 ring-gray-900/20 dark:border-gray-100 dark:ring-gray-100/20"
          : "border-gray-200 dark:border-gray-800"
      }`}
    >
      {/* The only floating element on the card: active/inactive status stacked directly above
          the select checkbox, so the top-left corner reads as one cluster instead of scattered
          badges (insights/copy/usage/preview all live in the in-flow toolbar row below instead). */}
      <div className="absolute -top-2 -left-1.5 flex items-center gap-1">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(session.id)}
          disabled={isBusy || session.isActive}
          aria-label={selected ? "Deselect session" : "Select session"}
          className="h-4 w-4 shrink-0 accent-gray-900 disabled:cursor-not-allowed disabled:opacity-40 dark:accent-gray-100"
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
            className={`h-3 w-3 rounded-full border-2 border-white shadow dark:border-gray-900 ${
              session.isActive ? "bg-green-500 animate-pulse" : "bg-red-400"
            }`}
          />
        </Tooltip>
      </div>

      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2
            className="line-clamp-2 text-base font-semibold text-gray-900 dark:text-gray-100"
            title={session.title}
          >
            {session.title}
          </h2>
          {session.nickname && (
            <span
              className="line-clamp-1 text-xs italic text-gray-500 dark:text-gray-400"
              title="Local nickname — only shown in this app"
            >
              {session.nickname}
            </span>
          )}
        </div>
        {session.isActive ? (
          // Same disabled-button-tooltip wrapper trick as the Continue button below — a native
          // `disabled` button won't reliably fire hover events on its own.
          <Tooltip content="Close this session in its terminal before changing its nickname.">
            <span className="inline-flex shrink-0">{nicknameButton}</span>
          </Tooltip>
        ) : (
          <Tooltip content={session.nickname ? "Edit local nickname" : "Add local nickname"}>
            {nicknameButton}
          </Tooltip>
        )}
      </div>

      {session.directoryMissing && (
        <div
          className="flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
          title={
            session.workingDirectory
              ? `Original directory no longer exists: ${session.workingDirectory}`
              : "This session's original directory no longer exists"
          }
        >
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
          Original folder missing
        </div>
      )}

      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Tooltip
            content={
              session.isWorktree
                ? `Git worktree — ${session.workingDirectory}`
                : (session.workingDirectory ?? session.project)
            }
          >
            <span className="flex min-w-0 items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
              {session.isWorktree ? (
                <GitFork className="h-3.5 w-3.5 shrink-0 text-violet-500 dark:text-violet-400" />
              ) : (
                <Folder className="h-3.5 w-3.5 shrink-0" />
              )}
              {worktreePathParts ? (
                <span className="flex min-w-0 flex-col break-all">
                  <span className="text-xs text-gray-500 dark:text-gray-500">
                    {worktreePathParts.prefix}
                  </span>
                  <span>Worktree name: {worktreePathParts.name}</span>
                </span>
              ) : (
                <span className="break-all">
                  {session.workingDirectory?.split("/").pop() ?? session.project}
                </span>
              )}
            </span>
          </Tooltip>

          {!session.directoryMissing && (
            <Tooltip content="Open this folder in VS Code">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenInVSCode(session)}
                disabled={isOpeningVSCode}
                aria-label="Open in VS Code"
                icon={
                  isOpeningVSCode ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Code2 className="h-3.5 w-3.5" />
                  )
                }
              >
                code .
              </Button>
            </Tooltip>
          )}
        </div>

        {session.gitBranch && (
          <span
            className="flex min-w-0 items-center gap-1 text-sm text-gray-600 dark:text-gray-400"
            title={`Git branch: ${session.gitBranch}`}
          >
            <GitBranch className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {session.isWorktree && "Worktree branch: "}
              {session.gitBranch}
            </span>
          </span>
        )}

        {hasSiblingActiveSession && (
          <Tooltip content="Another terminal already has this project open — check out a branch in a separate worktree instead of fighting over the same files.">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateWorktreeModal(true)}
              disabled={isCreatingWorktree}
              icon={
                isCreatingWorktree ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <GitFork className="h-3.5 w-3.5" />
                )
              }
            >
              Create worktree
            </Button>
          </Tooltip>
        )}
      </div>

      <div>
        {session.subagentCount > 0 ? (
          <Tooltip content="View what each subagent did — their token usage is included in the cost above">
            <button
              type="button"
              onClick={() => setShowSubagents(true)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 hover:underline dark:text-gray-400 dark:hover:text-gray-200"
            >
              <Bot className="h-3.5 w-3.5" />
              {session.subagentCount} subagent{session.subagentCount === 1 ? "" : "s"}
            </button>
          </Tooltip>
        ) : (
          <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <Bot className="h-3.5 w-3.5" />
            No subagents
          </span>
        )}
      </div>

      <p className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
        Updated {formatUpdatedAt(session.updatedAt)}
        {session.activeTimeMs > 0 && (
          <Tooltip content="Actual time Claude spent processing this session, summed across turns">
            <span className="inline-flex items-center gap-0.5">
              · <Clock className="h-3 w-3" /> {formatActiveTime(session.activeTimeMs)} active
            </span>
          </Tooltip>
        )}
      </p>

      {/* Card action toolbar — one standardized-size icon per action, colored by kind so they
          stay easy to tell apart at a glance as more get added here over time. */}
      <div className="flex flex-wrap items-center gap-4 border-t border-gray-100 pt-3 dark:border-gray-800">
        <ToolbarIconButton
          tooltip="Insights — tips to spend fewer tokens"
          ariaLabel="View insights"
          color="amber"
          onClick={() => setShowInsights(true)}
          icon={<Lightbulb className="h-4 w-4" />}
        />
        {session.usage.models.length > 0 && (
          <ToolbarIconButton
            tooltip="View token usage and estimated cost"
            ariaLabel="View usage and cost"
            color="green"
            onClick={() => setShowUsage(true)}
            icon={<DollarSign className="h-4 w-4" />}
          />
        )}
        {session.prompts.length > 0 && (
          <ToolbarIconButton
            tooltip="Preview prompts sent in this session"
            ariaLabel="Preview prompts"
            color="blue"
            onClick={() => setShowPreview(true)}
            icon={<MessageSquare className="h-4 w-4" />}
          />
        )}
        {session.isWorktree && (
          <ToolbarIconButton
            tooltip={
              session.isActive
                ? "Close this session in its terminal before cleaning up the worktree."
                : "Clean up this worktree — removes its folder and the branch git created for it. Doesn't touch the session transcript."
            }
            ariaLabel="Clean up worktree"
            color="red"
            disabled={session.isActive || isDeletingWorktree}
            onClick={() => setShowDeleteWorktreeConfirm(true)}
            icon={
              isDeletingWorktree ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <GitFork className="h-4 w-4" />
              )
            }
          />
        )}
      </div>

      <div className="flex items-center gap-1 text-sm text-gray-600 border-t border-gray-100 pt-3 dark:text-gray-400 dark:border-gray-800">
        <span
          className="inline-flex items-center gap-1 font-mono text-[10px]"
          title={"Resume command"}
        >
          {resumeCommand}
        </span>
        <Tooltip content={copiedCommand ? "Resume command copied!" : "Copy resume command"}>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopyCommand}
            aria-label="Copy resume command"
            icon={
              copiedCommand ? (
                <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )
            }
          />
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

      <div className="-mx-4 -mb-4 mt-1">
        <SessionSizeMeter sizeBytes={session.sizeBytes} />
      </div>

      <PromptPreviewModal
        session={session}
        open={showPreview}
        onClose={() => setShowPreview(false)}
      />
      <UsageDetailsModal session={session} open={showUsage} onClose={() => setShowUsage(false)} />
      <SubagentsModal
        session={session}
        open={showSubagents}
        onClose={() => setShowSubagents(false)}
      />
      <InsightsModal session={session} open={showInsights} onClose={() => setShowInsights(false)} />
      {showNicknameModal && (
        <NicknameModal
          currentNickname={session.nickname ?? ""}
          onSave={(nickname) => {
            setShowNicknameModal(false);
            onSetNickname(session, nickname);
          }}
          onCancel={() => setShowNicknameModal(false)}
        />
      )}
      {showCreateWorktreeModal && (
        <CreateWorktreeModal
          defaultName={session.gitBranch ?? ""}
          isLoading={isCreatingWorktree}
          onCreate={(name) => {
            setShowCreateWorktreeModal(false);
            onCreateWorktree(session, name);
          }}
          onCancel={() => setShowCreateWorktreeModal(false)}
        />
      )}
      <ConfirmDialog
        open={showDeleteWorktreeConfirm}
        title="Clean up worktree"
        message="This removes the worktree's folder and the worktree-<name> branch git created for it, freeing the disk space it used. Uncommitted changes there will block the deletion — commit or stash them first if you need to keep them. The session transcript itself isn't affected."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={() => {
          setShowDeleteWorktreeConfirm(false);
          onDeleteWorktree(session);
        }}
        onCancel={() => setShowDeleteWorktreeConfirm(false)}
      />
    </div>
  );
}
