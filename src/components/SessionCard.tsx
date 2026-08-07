import {
  Bot,
  Check,
  Clock,
  Code2,
  Copy,
  DollarSign,
  Folder,
  GitFork,
  GitMerge,
  Lightbulb,
  Loader2,
  MessageSquare,
  Pencil,
  Play,
  RotateCcw,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useToast } from "../hooks/useToast";
import type { PendingAction } from "../hooks/useSessions";
import type { Session } from "../types/session";
import { Button } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";
import { PromptPreviewModal } from "./PromptPreviewModal";
import { InsightsModal } from "./InsightsModal";
import { NicknameModal } from "./NicknameModal";
import { ResetRootConfirmModal } from "./ResetRootConfirmModal";
import { SessionSizeMeter } from "./SessionSizeMeter";
import { SubagentsModal } from "./SubagentsModal";
import { ToolbarIconButton } from "./ToolbarIconButton";
import { Tooltip } from "./Tooltip";
import { UsageDetailsModal } from "./UsageDetailsModal";
import { WorktreeToRootModal } from "./WorktreeToRootModal";
import { formatActiveTime, formatUpdatedAt } from "../utils/formatDate";
import { formatWorktreePath } from "../utils/formatPath";

type SessionCardProps = {
  session: Session;
  pendingAction?: PendingAction;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onContinue: (session: Session) => void;
  onDeleteRequest: (session: Session) => void;
  onSetNickname: (session: Session, nickname: string) => void;
  onOpenInVSCode: (session: Session) => void;
  onOpenMissingWorktreeRootInVSCode: (session: Session) => void;
  onStartNewSessionAtMissingWorktreeRoot: (session: Session) => Promise<void>;
  onDeleteWorktree: (session: Session) => void;
  onWorktreeSyncComplete: (session: Session) => void;
};

const COPIED_FEEDBACK_DURATION_MS = 2500;

export function SessionCard({
  session,
  pendingAction,
  selected,
  onToggleSelect,
  onContinue,
  onDeleteRequest,
  onSetNickname,
  onOpenInVSCode,
  onOpenMissingWorktreeRootInVSCode,
  onStartNewSessionAtMissingWorktreeRoot,
  onDeleteWorktree,
  onWorktreeSyncComplete,
}: SessionCardProps) {
  const { t } = useLanguage();
  const isDeleting = pendingAction === "delete";
  const isContinuing = pendingAction === "continue";
  const isSettingNickname = pendingAction === "nickname";
  const isOpeningVSCode = pendingAction === "vscode";
  const isDeletingWorktree = pendingAction === "worktree-delete";
  const isResumingAtMissingWorktreeRoot = pendingAction === "missing-root-resume";
  const isBusy = isDeleting || isContinuing || isSettingNickname;
  const [resumingAtRoot, setResumingAtRoot] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showUsage, setShowUsage] = useState(false);
  const [showSubagents, setShowSubagents] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [showDeleteWorktreeConfirm, setShowDeleteWorktreeConfirm] = useState(false);
  const [showWorktreeToRootModal, setShowWorktreeToRootModal] = useState(false);
  const [showResetRootConfirm, setShowResetRootConfirm] = useState(false);
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
      showToast(t("sessionCard.copyCommand.success"), "success");
      setTimeout(() => setCopiedCommand(false), COPIED_FEEDBACK_DURATION_MS);
    } catch {
      showToast(t("sessionCard.copyCommand.error"), "error");
    }
  };

  const nicknameButton = (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setShowNicknameModal(true)}
      disabled={isBusy || session.isActive}
      aria-label={session.nickname ? t("sessionCard.nickname.edit") : t("sessionCard.nickname.add")}
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
    ? t("sessionCard.continueDisabled.directoryMissing")
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
        {t("sessionCard.resumeButton")}
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
      {t("sessionCard.deleteButton")}
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
          aria-label={selected ? t("sessionCard.checkbox.deselect") : t("sessionCard.checkbox.select")}
          className="h-4 w-4 shrink-0 accent-gray-900 disabled:cursor-not-allowed disabled:opacity-40 dark:accent-gray-100"
        />
        <Tooltip
          content={
            session.isActive
              ? t("sessionCard.status.activeTooltip")
              : t("sessionCard.status.inactiveTooltip")
          }
        >
          <span
            aria-label={session.isActive ? t("sessionCard.status.activeLabel") : t("sessionCard.status.inactiveLabel")}
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
              title={t("sessionCard.nickname.localOnly")}
            >
              {session.nickname}
            </span>
          )}
        </div>
        {session.isActive ? (
          // Same disabled-button-tooltip wrapper trick as the Continue button below — a native
          // `disabled` button won't reliably fire hover events on its own.
          <Tooltip content={t("sessionCard.nickname.disabledTooltip")}>
            <span className="inline-flex shrink-0">{nicknameButton}</span>
          </Tooltip>
        ) : (
          <Tooltip content={session.nickname ? t("sessionCard.nickname.edit") : t("sessionCard.nickname.add")}>
            {nicknameButton}
          </Tooltip>
        )}
      </div>

      {session.directoryMissing && (
        <div className="flex flex-col gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
          <div
            className="flex items-center gap-1.5"
            title={
              session.workingDirectory
                ? t("sessionCard.directoryMissing.tooltipWithPath", {
                    path: session.workingDirectory,
                  })
                : t("sessionCard.directoryMissing.tooltipNoPath")
            }
          >
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
            {t("sessionCard.directoryMissing.title")}
          </div>

          {session.missingWorktreeRepoRoot && (
            <div className="flex flex-col gap-1.5 pl-0.5 font-normal text-gray-600 dark:text-gray-400">
              <span className="break-all">
                {t("sessionCard.directoryMissing.removedWorktree")}{" "}
                <span className="font-mono">{session.missingWorktreeRepoRoot}</span>
              </span>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenMissingWorktreeRootInVSCode(session)}
                  disabled={isOpeningVSCode}
                  aria-label={t("sessionCard.directoryMissing.openRootAriaLabel")}
                  icon={
                    isOpeningVSCode ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Code2 className="h-3.5 w-3.5" />
                    )
                  }
                >
                  {t("sessionCard.codeButton")}
                </Button>
                <Tooltip content={t("sessionCard.directoryMissing.newSessionTooltip")}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      setResumingAtRoot(true);
                      try {
                        await onStartNewSessionAtMissingWorktreeRoot(session);
                      } finally {
                        setResumingAtRoot(false);
                      }
                    }}
                    disabled={resumingAtRoot || isResumingAtMissingWorktreeRoot}
                    icon={
                      resumingAtRoot || isResumingAtMissingWorktreeRoot ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )
                    }
                  >
                    {t("sessionCard.newSessionAtRootButton")}
                  </Button>
                </Tooltip>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Tooltip
            content={
              session.isWorktree
                ? t("sessionCard.worktreeTooltip", { path: session.workingDirectory ?? "" })
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
                  <span>
                    {t("sessionCard.worktreeNameLabel", { name: worktreePathParts.name })}
                  </span>
                </span>
              ) : (
                <span className="break-all">
                  {session.workingDirectory?.split("/").pop() ?? session.project}
                </span>
              )}
            </span>
          </Tooltip>

          {!session.directoryMissing && (
            <Tooltip content={t("sessionCard.openInVSCodeTooltip")}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenInVSCode(session)}
                disabled={isOpeningVSCode}
                aria-label={t("sessionCard.openInVSCodeAriaLabel")}
                icon={
                  isOpeningVSCode ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Code2 className="h-3.5 w-3.5" />
                  )
                }
              >
                {t("sessionCard.codeButton")}
              </Button>
            </Tooltip>
          )}

          {session.isWorktree && !session.directoryMissing && (
            // Unlike Delete/nickname-edit, this stays clickable even while the session is
            // active: "copy" mode never touches the worktree (only reads it, writes to root) and
            // only requires root to be free, so it's server-side safe regardless of this
            // session's own active state (see applyWorktreeCopyToRoot in sessionService.ts).
            // "checkout" mode does need the worktree closed first, but the modal's own preview
            // step already blocks continuing in that specific case
            // (blockedByActiveSession/worktreeHasActiveSession in WorktreeToRootModal.tsx) — no
            // need to block opening the modal at all just because copy mode would still work.
            <Tooltip content={t("sessionCard.worktreeToRoot.tooltip")}>
              <Button
                variant="outline-danger"
                size="sm"
                onClick={() => setShowWorktreeToRootModal(true)}
                aria-label={t("sessionCard.worktreeToRoot.ariaLabel")}
                icon={<GitMerge className="h-3.5 w-3.5" />}
              >
                {t("sessionCard.worktreeToRootButton")}
              </Button>
            </Tooltip>
          )}
        </div>
      </div>

      <div>
        {session.subagentCount > 0 ? (
          <Tooltip content={t("sessionCard.subagents.tooltip")}>
            <button
              type="button"
              onClick={() => setShowSubagents(true)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 hover:underline dark:text-gray-400 dark:hover:text-gray-200"
            >
              <Bot className="h-3.5 w-3.5" />
              {session.subagentCount === 1
                ? t("sessionCard.subagentCount.one", { count: session.subagentCount })
                : t("sessionCard.subagentCount.many", { count: session.subagentCount })}
            </button>
          </Tooltip>
        ) : (
          <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <Bot className="h-3.5 w-3.5" />
            {t("sessionCard.subagentCount.none")}
          </span>
        )}
      </div>

      <p className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
        {t("sessionCard.updatedPrefix")} {formatUpdatedAt(session.updatedAt)}
        {session.activeTimeMs > 0 && (
          <Tooltip content={t("sessionCard.activeTimeTooltip")}>
            <span className="inline-flex items-center gap-0.5">
              · <Clock className="h-3 w-3" /> {formatActiveTime(session.activeTimeMs)}{" "}
              {t("sessionCard.activeSuffix")}
            </span>
          </Tooltip>
        )}
      </p>

      {/* Card action toolbar — one standardized-size icon per action, colored by kind so they
          stay easy to tell apart at a glance as more get added here over time. */}
      <div className="flex flex-wrap items-center gap-4 border-t border-gray-100 pt-3 dark:border-gray-800">
        <ToolbarIconButton
          tooltip={t("sessionCard.insightsTooltip")}
          ariaLabel={t("sessionCard.insightsAriaLabel")}
          color="amber"
          onClick={() => setShowInsights(true)}
          icon={<Lightbulb className="h-4 w-4" />}
        />
        {session.usage.models.length > 0 && (
          <ToolbarIconButton
            tooltip={t("sessionCard.usageTooltip")}
            ariaLabel={t("sessionCard.usageAriaLabel")}
            color="green"
            onClick={() => setShowUsage(true)}
            icon={<DollarSign className="h-4 w-4" />}
          />
        )}
        {session.prompts.length > 0 && (
          <ToolbarIconButton
            tooltip={t("sessionCard.previewTooltip")}
            ariaLabel={t("sessionCard.previewAriaLabel")}
            color="blue"
            onClick={() => setShowPreview(true)}
            icon={<MessageSquare className="h-4 w-4" />}
          />
        )}
        {session.isWorktree && !session.directoryMissing && (
          <ToolbarIconButton
            tooltip={t("sessionCard.resetRootTooltip")}
            ariaLabel={t("sessionCard.resetRootAriaLabel")}
            color="amber"
            onClick={() => setShowResetRootConfirm(true)}
            icon={<RotateCcw className="h-4 w-4" />}
          />
        )}
        {session.isWorktree && (
          <ToolbarIconButton
            tooltip={
              session.isActive
                ? t("sessionCard.cleanupWorktree.disabledTooltip")
                : t("sessionCard.cleanupWorktree.tooltip")
            }
            ariaLabel={t("sessionCard.cleanupWorktreeAriaLabel")}
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
          title={t("sessionCard.resumeCommandTitle")}
        >
          {resumeCommand}
        </span>
        <Tooltip
          content={
            copiedCommand
              ? t("sessionCard.copyCommandTooltip.copied")
              : t("sessionCard.copyCommandTooltip.default")
          }
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopyCommand}
            aria-label={t("sessionCard.copyCommandAriaLabel")}
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
          <Tooltip content={t("sessionCard.deleteDisabledTooltip")}>
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
      {showWorktreeToRootModal && (
        <WorktreeToRootModal
          session={session}
          onClose={() => setShowWorktreeToRootModal(false)}
          onComplete={() => onWorktreeSyncComplete(session)}
          // `session` is still the pre-refresh prop here — checkout mode's own success is what
          // guarantees the worktree is already gone, so isWorktree is corrected by hand rather
          // than waiting for the parent's list refresh (which only runs once this modal closes)
          // to catch up. Without this, the delete-confirm dialog offers a stale "clean up
          // worktree" checkbox for a worktree that no longer exists.
          onOfferDeleteSession={() => onDeleteRequest({ ...session, isWorktree: false })}
        />
      )}
      {showResetRootConfirm && (
        <ResetRootConfirmModal session={session} onClose={() => setShowResetRootConfirm(false)} />
      )}
      <ConfirmDialog
        open={showDeleteWorktreeConfirm}
        title={t("sessionCard.deleteWorktreeConfirm.title")}
        message={t("sessionCard.deleteWorktreeConfirm.message")}
        confirmLabel={t("sessionCard.deleteButton")}
        cancelLabel={t("sessionCard.cancelButton")}
        onConfirm={() => {
          setShowDeleteWorktreeConfirm(false);
          onDeleteWorktree(session);
        }}
        onCancel={() => setShowDeleteWorktreeConfirm(false)}
      />
    </div>
  );
}
