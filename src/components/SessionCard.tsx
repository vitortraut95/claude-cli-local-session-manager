import {
  Code2,
  Folder,
  GitBranch,
  GitFork,
  GitPullRequest,
  Info,
  Layers,
  Loader2,
  MessageSquare,
  PauseCircle,
  Pencil,
  Play,
  Share,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import jenkinsIcon from "../assets/jenkins.svg";
import { useLanguage } from "../hooks/useLanguage";
import { useToast } from "../hooks/useToast";
import type { PendingAction } from "../hooks/useSessions";
import * as cleanupApi from "../services/cleanupApi";
import * as sessionsApi from "../services/sessionsApi";
import type { TerminalLayout } from "../services/preferencesApi";
import type { Session, WorkStatus } from "../../shared/session";
import { AnchoredMenu } from "./AnchoredMenu";
import { Button } from "./Button";
import { ExportSessionModal } from "./ExportSessionModal";
import { ConfirmDialog } from "./ConfirmDialog";
import { JenkinsLinksModal } from "./JenkinsLinksModal";
import { LaunchLayoutButton } from "./LaunchLayoutButton";
import { LinkifiedText } from "./LinkifiedText";
import { MissingDirectoryNotice } from "./MissingDirectoryNotice";
import { TaskModal } from "./TaskModal";
import { TaskReposLine } from "./TaskReposLine";
import { PromptPreviewModal } from "./PromptPreviewModal";
import { NicknameModal } from "./NicknameModal";
import { SessionBranchesModal } from "./SessionBranchesModal";
import { OpenPrBaseChoiceModal } from "./OpenPrBaseChoiceModal";
import { ToolbarIconButton } from "./ToolbarIconButton";
import { Tooltip } from "./Tooltip";
import { PreviewLinks } from "./PreviewLinks";
import { TaskHistoryModal } from "./TaskHistoryModal";
import { WorkStatusSelect } from "./WorkStatusSelect";
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

/** The one dialog a card can have open. `task.addRepo` opens it straight on the "add repo" form;
 *  `doneWorktree` is offered right after the card is marked done (the cleanup that removing its
 *  worktree means). */
type CardModal =
  | { kind: "preview" }
  | { kind: "nickname" }
  | { kind: "branches" }
  | { kind: "task"; addRepo: boolean }
  | { kind: "history" }
  | { kind: "export" }
  | { kind: "jenkins" }
  | { kind: "openPrBase" }
  | { kind: "deleteWorktree" }
  | { kind: "doneWorktree"; finding: cleanupApi.CleanupFinding };

type SessionCardProps = {
  session: Session;
  pendingAction?: PendingAction;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  /** `layout` = where the user picked to open it; omitted = the `terminalLayout` preference. */
  onContinue: (session: Session, layout?: TerminalLayout) => void;
  onDeleteRequest: (session: Session) => void;
  onSetNickname: (session: Session, nickname: string) => void;
  onSetBranches: (session: Session, origin: string, destination: string) => void;
  /** Resolves true once saved. */
  onSetStatus: (session: Session, status: WorkStatus | null) => Promise<boolean>;
  onOpenInVSCode: (session: Session) => void;
  onOpenInCursor: (session: Session) => void;
  onOpenMissingWorktreeRootInVSCode: (session: Session) => void;
  onStartNewSessionAtMissingWorktreeRoot: (
    session: Session,
    layout?: TerminalLayout,
  ) => Promise<void>;
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
  const [openModal, setOpenModal] = useState<CardModal | null>(null);
  const closeModal = () => setOpenModal(null);
  const doneWorktreeFinding = openModal?.kind === "doneWorktree" ? openModal.finding : null;
  const [removingDoneWorktree, setRemovingDoneWorktree] = useState(false);
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
        const finding = result.finding;
        // Never replaces a dialog the user opened meanwhile.
        setOpenModal((current) => current ?? { kind: "doneWorktree", finding });
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
      closeModal();
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
      setOpenModal({ kind: "openPrBase" });
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
      onClick={() => setOpenModal({ kind: "nickname" })}
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
      <LaunchLayoutButton
        size="sm"
        fullWidth
        label={t(teamLinks.gridLayout ? "sessionCard.resumeIn.button" : "sessionCard.resumeButton")}
        icon={<Play className="h-4 w-4" />}
        busy={isContinuing}
        disabled={isBusy || continueDisabledReason !== null}
        onLaunch={(layout) => onContinue(session, layout)}
      />
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
      className={`relative flex flex-col gap-3 justify-between rounded-xl border bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:bg-gray-900 ${
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
          testKey={session.testKey ?? null}
          saving={pendingAction === "status"}
          onChange={(status) => void handleStatusChange(status)}
        />
        {session.hasHistory && (
          <Tooltip content={t("history.open")}>
            <button
              type="button"
              onClick={() => setOpenModal({ kind: "history" })}
              aria-label={t("history.open")}
              className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 shadow-sm hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        )}
        {session.usagePaused && (
          <Tooltip content={t("sessionCard.usagePaused.tooltip")}>
            <span className="flex h-5 items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 text-xs font-medium text-amber-800 shadow-sm dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300">
              <PauseCircle className="h-3.5 w-3.5" />
              {t("sessionCard.usagePaused.label")}
            </span>
          </Tooltip>
        )}
      </div>

      <div className="mt-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1.5">
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
                  onClick={() => setOpenModal({ kind: "branches" })}
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
          {(Boolean(session.taskKey) || (session.previews?.length ?? 0) > 0) && (
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
              <TaskReposLine
                session={session}
                onFilterByTask={onFilterByTask}
                onAddRepo={() => setOpenModal({ kind: "task", addRepo: true })}
              />
              <PreviewLinks
                previews={session.previews ?? []}
                onChanged={() => onWorktreeSyncComplete(session)}
              />
            </div>
          )}
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
        <MissingDirectoryNotice
          session={session}
          isOpeningVSCode={isOpeningVSCode}
          isResumingAtMissingWorktreeRoot={isResumingAtMissingWorktreeRoot}
          onOpenMissingWorktreeRootInVSCode={onOpenMissingWorktreeRootInVSCode}
          onStartNewSessionAtMissingWorktreeRoot={onStartNewSessionAtMissingWorktreeRoot}
        />
      )}

      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
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
        </div>
      </div>

      {/* Each action uses its own ToolbarIconButtonColor; pick an unused one for a new action. */}
      <div className="flex flex-wrap items-center gap-4 border-t border-gray-100 pt-3 dark:border-gray-800">
        {session.prompts.length > 0 && (
          <ToolbarIconButton
            tooltip={t("sessionCard.previewTooltip")}
            ariaLabel={t("sessionCard.previewAriaLabel")}
            color="blue"
            onClick={() => setOpenModal({ kind: "preview" })}
            icon={<MessageSquare className="h-4 w-4" />}
          />
        )}
        {!session.directoryMissing && !session.isAppRepo && (
          <ToolbarIconButton
            tooltip={t("taskModal.open")}
            ariaLabel={t("taskModal.open")}
            color="violet"
            onClick={() => setOpenModal({ kind: "task", addRepo: false })}
            icon={<Layers className="h-4 w-4" />}
          />
        )}
        <ToolbarIconButton
          tooltip={t("sessionCard.exportTooltip")}
          ariaLabel={t("sessionCard.exportAriaLabel")}
          color="teal"
          onClick={() => setOpenModal({ kind: "export" })}
          icon={<Share className="h-4 w-4" />}
        />
        {jenkinsGroups && (
          <ToolbarIconButton
            tooltip={t("sessionCard.openJenkinsTooltip")}
            ariaLabel={t("sessionCard.openJenkinsAriaLabel")}
            color="neutral"
            onClick={() => setOpenModal({ kind: "jenkins" })}
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
            onClick={() => setOpenModal({ kind: "deleteWorktree" })}
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
        <AnchoredMenu
          disabled={session.directoryMissing || isOpeningVSCode || isOpeningCursor}
          buttonClassName="shrink-0 gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          label={
            <>
              {isOpeningVSCode || isOpeningCursor ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Code2 className="h-3.5 w-3.5" />
              )}
              {t("sessionCard.openEditor")}
            </>
          }
        >
          {(close) =>
            (
              [
                { label: t("sessionCard.openEditor.vscode"), open: onOpenInVSCode },
                { label: t("sessionCard.openEditor.cursor"), open: onOpenInCursor },
              ] as const
            ).map((editor) => (
              <button
                key={editor.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  close();
                  editor.open(session);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800"
              >
                <Code2 className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                {editor.label}
              </button>
            ))
          }
        </AnchoredMenu>
        {session.isActive ? (
          <Tooltip content={t("sessionCard.deleteDisabledTooltip")}>
            <span className="inline-flex shrink-0">{deleteButton}</span>
          </Tooltip>
        ) : (
          deleteButton
        )}
      </div>

      <PromptPreviewModal
        session={session}
        open={openModal?.kind === "preview"}
        onClose={closeModal}
      />
      {openModal?.kind === "task" && (
        <TaskModal
          session={session}
          startAddingRepo={openModal.addRepo}
          onClose={closeModal}
          onChanged={onTaskChanged}
          onSetNickname={(nickname) => onSetNickname(session, nickname)}
          onSetBranches={(origin, destination) => onSetBranches(session, origin, destination)}
        />
      )}
      {openModal?.kind === "branches" && (
        <SessionBranchesModal
          session={session}
          onSave={(origin, destination) => {
            closeModal();
            onSetBranches(session, origin, destination);
          }}
          onCancel={closeModal}
        />
      )}
      {openModal?.kind === "nickname" && (
        <NicknameModal
          currentNickname={session.nickname ?? ""}
          onSave={(nickname) => {
            closeModal();
            onSetNickname(session, nickname);
          }}
          onCancel={closeModal}
        />
      )}
      {openModal?.kind === "jenkins" && jenkinsGroups && (
        <JenkinsLinksModal groups={jenkinsGroups} onClose={closeModal} />
      )}
      {openModal?.kind === "export" && (
        <ExportSessionModal session={session} onClose={closeModal} />
      )}
      {openModal?.kind === "openPrBase" && (
        <OpenPrBaseChoiceModal session={session} onClose={closeModal} />
      )}
      {openModal?.kind === "history" && <TaskHistoryModal session={session} onClose={closeModal} />}
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
        onCancel={closeModal}
      />
      <ConfirmDialog
        open={openModal?.kind === "deleteWorktree"}
        title={t("sessionCard.deleteWorktreeConfirm.title")}
        message={t("sessionCard.deleteWorktreeConfirm.message")}
        confirmLabel={t("sessionCard.deleteButton")}
        cancelLabel={t("sessionCard.cancelButton")}
        onConfirm={() => {
          closeModal();
          onDeleteWorktree(session);
        }}
        onCancel={closeModal}
      />
    </div>
  );
}
