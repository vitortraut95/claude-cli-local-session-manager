import {
  ChevronDown,
  Clock,
  Code2,
  Folder,
  GitBranch,
  GitFork,
  GitMerge,
  GitPullRequest,
  Layers,
  LayoutGrid,
  Loader2,
  MessageSquare,
  Pencil,
  Play,
  RotateCcw,
  Share,
  SquareTerminal,
  Trash2,
  TriangleAlert,
  Info,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import jenkinsIcon from "../assets/jenkins.svg";
import { useLanguage } from "../hooks/useLanguage";
import { useToast } from "../hooks/useToast";
import type { PendingAction } from "../hooks/useSessions";
import * as cleanupApi from "../services/cleanupApi";
import * as sessionsApi from "../services/sessionsApi";
import type { Session, WorkStatus } from "../types/session";
import { Button } from "./Button";
import { ExportSessionModal } from "./ExportSessionModal";
import { ConfirmDialog } from "./ConfirmDialog";
import { JenkinsLinksModal } from "./JenkinsLinksModal";
import { LinkifiedText } from "./LinkifiedText";
import { TaskModal } from "./TaskModal";
import { TaskReposLine } from "./TaskReposLine";
import { PromptPreviewModal } from "./PromptPreviewModal";
import { NicknameModal } from "./NicknameModal";
import { SessionBranchesModal } from "./SessionBranchesModal";
import { OpenPrBaseChoiceModal } from "./OpenPrBaseChoiceModal";
import { ResetRootConfirmModal } from "./ResetRootConfirmModal";
import { SessionSizeMeter } from "./SessionSizeMeter";
import { ToolbarIconButton } from "./ToolbarIconButton";
import { Tooltip } from "./Tooltip";
import { PreviewLinks } from "./PreviewLinks";
import { TaskHistoryModal } from "./TaskHistoryModal";
import { WorkStatusSelect } from "./WorkStatusSelect";
import { WorktreeToRootModal } from "./WorktreeToRootModal";
import { formatActiveTime, formatUpdatedAt } from "../utils/formatDate";
import { formatWorktreePath } from "../utils/formatPath";
import { DEFAULT_BRANCHES } from "../utils/branches";
import { getTaskJenkinsGroups } from "../utils/jenkins";
import { useTeamLinks } from "../hooks/useTeamLinks";
import { resolveSessionBranches } from "../utils/sessionBranches";
import { resolveApiErrorMessage } from "../utils/apiClient";

const DONE_WORKTREE_KEPT_KEYS = {
  "not-pushed": "sessionCard.doneWorktree.keptNotPushed",
  "uncommitted-changes": "sessionCard.doneWorktree.keptDirty",
  "active-session": "sessionCard.doneWorktree.keptActive",
} as const;

type SessionCardProps = {
  session: Session;
  pendingAction?: PendingAction;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  /** `layout` = where the user picked to open it; omitted = the `terminalLayout` preference. */
  onContinue: (session: Session, layout?: "tabs" | "limux-grid") => void;
  onDeleteRequest: (session: Session) => void;
  onSetNickname: (session: Session, nickname: string) => void;
  onSetBranches: (session: Session, origin: string, destination: string) => void;
  /** Resolves true once saved. */
  onSetStatus: (session: Session, status: WorkStatus | null) => Promise<boolean>;
  onOpenInVSCode: (session: Session) => void;
  onOpenInCursor: (session: Session) => void;
  onOpenMissingWorktreeRootInVSCode: (session: Session) => void;
  onStartNewSessionAtMissingWorktreeRoot: (session: Session) => Promise<void>;
  onDeleteWorktree: (session: Session) => void;
  onWorktreeSyncComplete: (session: Session) => void;
  onFilterByTask: (taskKey: string) => void;
  onTaskChanged: () => void;
};

export function SessionCard({
  session,
  pendingAction,
  selected,
  onToggleSelect,
  onContinue,
  onDeleteRequest,
  onSetNickname,
  onSetBranches,
  onSetStatus,
  onOpenInVSCode,
  onOpenInCursor,
  onOpenMissingWorktreeRootInVSCode,
  onStartNewSessionAtMissingWorktreeRoot,
  onDeleteWorktree,
  onWorktreeSyncComplete,
  onFilterByTask,
  onTaskChanged,
}: SessionCardProps) {
  const { t } = useLanguage();
  const isDeleting = pendingAction === "delete";
  const isContinuing = pendingAction === "continue";
  const isSettingNickname = pendingAction === "nickname";
  const isSettingBranches = pendingAction === "branches";
  const isOpeningVSCode = pendingAction === "vscode";
  const isOpeningCursor = pendingAction === "cursor";
  const isDeletingWorktree = pendingAction === "worktree-delete";
  const isResumingAtMissingWorktreeRoot = pendingAction === "missing-root-resume";
  const isBusy = isDeleting || isContinuing || isSettingNickname;
  const [resumingAtRoot, setResumingAtRoot] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [showBranchesModal, setShowBranchesModal] = useState(false);
  // null = closed; otherwise whether it opens straight on the "add repo" form.
  const [taskModal, setTaskModal] = useState<{ addRepo: boolean } | null>(null);
  const [showDeleteWorktreeConfirm, setShowDeleteWorktreeConfirm] = useState(false);
  // Offered right after the card is marked done: the cleanup that removing its worktree means.
  const [doneWorktreeFinding, setDoneWorktreeFinding] = useState<cleanupApi.CleanupFinding | null>(
    null,
  );
  const [removingDoneWorktree, setRemovingDoneWorktree] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showWorktreeToRootModal, setShowWorktreeToRootModal] = useState(false);
  const [showResetRootConfirm, setShowResetRootConfirm] = useState(false);
  const [showOpenPrBaseChoice, setShowOpenPrBaseChoice] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showJenkinsModal, setShowJenkinsModal] = useState(false);
  const [openingPrUrl, setOpeningPrUrl] = useState(false);
  const { showToast } = useToast();
  const worktreePathParts =
    session.isWorktree && session.workingDirectory
      ? formatWorktreePath(session.workingDirectory)
      : null;
  const { origin: originBranch, destination: taskBranch } = resolveSessionBranches(session);
  // `gitBranch` is null when the folder isn't a git repo, where a job link would be meaningless.
  const teamLinks = useTeamLinks();
  const jenkinsGroups =
    session.directoryMissing || session.gitBranch === null || session.isAppRepo
      ? null
      : getTaskJenkinsGroups(
          teamLinks.jenkinsBaseUrl,
          teamLinks.envPreviews,
          session,
          taskBranch ?? null,
          originBranch,
        );

  /** Marking a worktree session done offers to remove its worktree when that's safe now (merged,
   *  or every commit on origin); otherwise says why it stays. */
  const handleStatusChange = async (status: WorkStatus | null) => {
    const saved = await onSetStatus(session, status);
    if (!saved || status !== "done" || !session.isWorktree || session.directoryMissing) return;
    try {
      const result = await cleanupApi.fetchWorktreeCleanupForSession(session.id);
      if (result?.finding) {
        setDoneWorktreeFinding(result.finding);
      } else if (
        result?.reason === "not-pushed" ||
        result?.reason === "uncommitted-changes" ||
        result?.reason === "active-session"
      ) {
        showToast(t(DONE_WORKTREE_KEPT_KEYS[result.reason]), "error");
      }
    } catch {
      // Only an offer: the Cleanup window still lists it later.
    }
  };

  const handleRemoveDoneWorktree = async () => {
    if (!doneWorktreeFinding) return;
    setRemovingDoneWorktree(true);
    try {
      await cleanupApi.executeCleanupFinding(doneWorktreeFinding);
      showToast(t("sessionCard.doneWorktree.removed"), "success");
      setDoneWorktreeFinding(null);
      onWorktreeSyncComplete(session);
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "cleanupModal.runError"), "error");
    } finally {
      setRemovingDoneWorktree(false);
    }
  };

  // The URL needs a server-side git call, so it's fetched on click. A non-default base branch
  // goes through OpenPrBaseChoiceModal, since the plain link diffs against the default branch.
  const handleOpenPr = async () => {
    if (!taskBranch) return;
    if (
      originBranch &&
      originBranch !== taskBranch &&
      originBranch !== session.defaultBranch &&
      !DEFAULT_BRANCHES.has(originBranch)
    ) {
      setShowOpenPrBaseChoice(true);
      return;
    }
    setOpeningPrUrl(true);
    try {
      const url = await sessionsApi.fetchPrUrl(session.id, taskBranch);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "sessionCard.openPr.error"), "error");
    } finally {
      setOpeningPrUrl(false);
    }
  };

  const nicknameButton = (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setShowNicknameModal(true)}
      disabled={isBusy}
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

  // Resume stays enabled for an active session: onContinue re-checks and offers a conflict choice.
  const continueDisabledReason = session.directoryMissing
    ? t("sessionCard.continueDisabled.directoryMissing")
    : null;

  const continueButton = (
    <span className="flex flex-1">
      {teamLinks.gridLayout ? (
        <ResumeLayoutMenu
          disabled={isBusy || continueDisabledReason !== null}
          busy={isContinuing}
          onPick={(layout) => onContinue(session, layout)}
        />
      ) : (
        <Button
          variant="primary"
          size="sm"
          fullWidth
          onClick={() => onContinue(session, "tabs")}
          disabled={isBusy || continueDisabledReason !== null}
          icon={
            isContinuing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )
          }
        >
          {t("sessionCard.resumeButton")}
        </Button>
      )}
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
      <div className="absolute -left-1.5 top-0 flex -translate-y-1/2 items-center gap-1">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(session.id)}
          disabled={isBusy || session.isActive}
          aria-label={
            selected ? t("sessionCard.checkbox.deselect") : t("sessionCard.checkbox.select")
          }
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
            aria-label={
              session.isActive
                ? t("sessionCard.status.activeLabel")
                : t("sessionCard.status.inactiveLabel")
            }
            className={`h-3 w-3 rounded-full border-2 border-white shadow dark:border-gray-900 ${
              session.isActive ? "bg-green-500 animate-pulse" : "bg-red-400"
            }`}
          />
        </Tooltip>
        <WorkStatusSelect
          value={session.status ?? null}
          taskKey={session.taskKey ?? null}
          saving={pendingAction === "status"}
          onChange={(status) => void handleStatusChange(status)}
        />
        {session.hasHistory && (
          <Tooltip content={t("history.open")}>
            <button
              type="button"
              onClick={() => setShowHistory(true)}
              aria-label={t("history.open")}
              className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 shadow-sm hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        )}
      </div>

      <div className="mt-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2
            className="line-clamp-2 text-base font-semibold text-gray-900 dark:text-gray-100"
            title={session.title}
          >
            {session.title}
          </h2>
          {session.nickname && (
            <span
              className="line-clamp-3 break-words text-xs italic text-gray-500 dark:text-gray-400"
              title={`${session.nickname}\n\n${t("sessionCard.nickname.localOnly")}`}
            >
              <LinkifiedText text={session.nickname} />
            </span>
          )}
          {session.gitBranch !== null && !session.directoryMissing && !session.isAppRepo && (
            <div className="flex min-w-0 items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
              <GitBranch className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 break-all">
                {originBranch && originBranch !== taskBranch && (
                  <>
                    {t("sessionCard.branches.originLabel")}{" "}
                    <span className="text-gray-800 dark:text-gray-200">{originBranch}</span>
                    {" · "}
                  </>
                )}
                {t("sessionCard.branches.destinationLabel")}{" "}
                <span className="font-medium text-gray-800 dark:text-gray-200">{taskBranch}</span>
              </span>
              <Tooltip content={t("sessionCard.branches.edit")}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowBranchesModal(true)}
                  disabled={isSettingBranches}
                  aria-label={t("sessionCard.branches.edit")}
                  icon={
                    isSettingBranches ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Pencil className="h-3 w-3" />
                    )
                  }
                />
              </Tooltip>
            </div>
          )}
          <PreviewLinks
            previews={session.previews ?? []}
            onChanged={() => onWorktreeSyncComplete(session)}
          />
          <TaskReposLine
            session={session}
            onFilterByTask={onFilterByTask}
            onAddRepo={() => setTaskModal({ addRepo: true })}
          />
        </div>
        <Tooltip
          content={
            session.nickname ? t("sessionCard.nickname.edit") : t("sessionCard.nickname.add")
          }
        >
          {nicknameButton}
        </Tooltip>
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

          {!session.directoryMissing && (
            <Tooltip content={t("sessionCard.openInCursorTooltip")}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenInCursor(session)}
                disabled={isOpeningCursor}
                aria-label={t("sessionCard.openInCursorAriaLabel")}
                icon={
                  isOpeningCursor ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Code2 className="h-3.5 w-3.5" />
                  )
                }
              >
                {t("sessionCard.cursorButton")}
              </Button>
            </Tooltip>
          )}

          {session.isWorktree && !session.directoryMissing && (
            // Enabled even while active: "copy" mode only reads the worktree, and the modal itself
            // blocks "checkout" mode while the worktree's session is active.
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

      {/* Each action uses its own ToolbarIconButtonColor; pick an unused one for a new action. */}
      <div className="flex flex-wrap items-center gap-4 border-t border-gray-100 pt-3 dark:border-gray-800">
        {session.prompts.length > 0 && (
          <ToolbarIconButton
            tooltip={t("sessionCard.previewTooltip")}
            ariaLabel={t("sessionCard.previewAriaLabel")}
            color="blue"
            onClick={() => setShowPreview(true)}
            icon={<MessageSquare className="h-4 w-4" />}
          />
        )}
        {!session.directoryMissing && !session.isAppRepo && (
          <ToolbarIconButton
            tooltip={t("taskModal.open")}
            ariaLabel={t("taskModal.open")}
            color="violet"
            onClick={() => setTaskModal({ addRepo: false })}
            icon={<Layers className="h-4 w-4" />}
          />
        )}
        <ToolbarIconButton
          tooltip={t("sessionCard.exportTooltip")}
          ariaLabel={t("sessionCard.exportAriaLabel")}
          color="teal"
          onClick={() => setShowExportModal(true)}
          icon={<Share className="h-4 w-4" />}
        />
        {session.isWorktree && !session.directoryMissing && (
          <ToolbarIconButton
            tooltip={t("sessionCard.resetRootTooltip")}
            ariaLabel={t("sessionCard.resetRootAriaLabel")}
            color="amber"
            onClick={() => setShowResetRootConfirm(true)}
            icon={<RotateCcw className="h-4 w-4" />}
          />
        )}
        {jenkinsGroups && (
          <ToolbarIconButton
            tooltip={t("sessionCard.openJenkinsTooltip")}
            ariaLabel={t("sessionCard.openJenkinsAriaLabel")}
            color="neutral"
            onClick={() => setShowJenkinsModal(true)}
            // Multi-color logo: the button color only drives the hover background.
            icon={<img src={jenkinsIcon} alt="" className="h-6 w-6" />}
          />
        )}
        {taskBranch && !session.directoryMissing && !session.isAppRepo && (
          <ToolbarIconButton
            tooltip={t("sessionCard.openPrTooltip")}
            ariaLabel={t("sessionCard.openPrAriaLabel")}
            color="lime"
            disabled={openingPrUrl}
            onClick={() => void handleOpenPr()}
            icon={
              openingPrUrl ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <GitPullRequest className="h-4 w-4" />
              )
            }
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

      <div className="flex gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
        {continueDisabledReason !== null ? (
          // Disabled buttons don't fire hover events; continueButton's wrapping `<span>` carries
          // the tooltip.
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
      {taskModal && (
        <TaskModal
          session={session}
          startAddingRepo={taskModal.addRepo}
          onClose={() => setTaskModal(null)}
          onChanged={onTaskChanged}
          onSetNickname={(nickname) => onSetNickname(session, nickname)}
          onSetBranches={(origin, destination) => onSetBranches(session, origin, destination)}
        />
      )}
      {showBranchesModal && (
        <SessionBranchesModal
          session={session}
          onSave={(origin, destination) => {
            setShowBranchesModal(false);
            onSetBranches(session, origin, destination);
          }}
          onCancel={() => setShowBranchesModal(false)}
        />
      )}
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
          // `session` is pre-refresh here; checkout mode already removed the worktree, so
          // isWorktree is corrected by hand to avoid a stale "clean up worktree" checkbox.
          onOfferDeleteSession={() => onDeleteRequest({ ...session, isWorktree: false })}
        />
      )}
      {showResetRootConfirm && (
        <ResetRootConfirmModal session={session} onClose={() => setShowResetRootConfirm(false)} />
      )}
      {showJenkinsModal && jenkinsGroups && (
        <JenkinsLinksModal groups={jenkinsGroups} onClose={() => setShowJenkinsModal(false)} />
      )}
      {showExportModal && (
        <ExportSessionModal session={session} onClose={() => setShowExportModal(false)} />
      )}
      {showOpenPrBaseChoice && (
        <OpenPrBaseChoiceModal session={session} onClose={() => setShowOpenPrBaseChoice(false)} />
      )}
      {showHistory && <TaskHistoryModal session={session} onClose={() => setShowHistory(false)} />}
      <ConfirmDialog
        open={doneWorktreeFinding !== null}
        title={t("sessionCard.doneWorktree.title")}
        message={t(
          doneWorktreeFinding?.kind === "remove-merged-worktree"
            ? "sessionCard.doneWorktree.mergedMessage"
            : "sessionCard.doneWorktree.message",
          { branch: doneWorktreeFinding?.branch ?? "?" },
        )}
        confirmLabel={t("sessionCard.doneWorktree.confirm")}
        cancelLabel={t("sessionCard.doneWorktree.keep")}
        isLoading={removingDoneWorktree}
        onConfirm={() => void handleRemoveDoneWorktree()}
        onCancel={() => setDoneWorktreeFinding(null)}
      />
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

/** Resume when sessions open in the Limux grid: asks whether this one goes to the grid or to a
 *  terminal of its own. */
function ResumeLayoutMenu({
  disabled,
  busy,
  onPick,
}: {
  disabled: boolean;
  busy: boolean;
  onPick: (layout: "tabs" | "limux-grid") => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const options = [
    {
      layout: "limux-grid" as const,
      label: t("sessionCard.resumeIn.grid"),
      icon: <LayoutGrid className="h-4 w-4" />,
    },
    {
      layout: "tabs" as const,
      label: t("sessionCard.resumeIn.terminal"),
      icon: <SquareTerminal className="h-4 w-4" />,
    },
  ];

  return (
    <div ref={containerRef} className="relative flex flex-1">
      <Button
        variant="primary"
        size="sm"
        fullWidth
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        icon={busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
      >
        {t("sessionCard.resumeIn.button")}
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-0 z-20 mb-1 w-full min-w-44 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900"
        >
          {options.map((option) => (
            <button
              key={option.layout}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onPick(option.layout);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-800"
            >
              <span className="text-gray-500 dark:text-gray-400">{option.icon}</span>
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
