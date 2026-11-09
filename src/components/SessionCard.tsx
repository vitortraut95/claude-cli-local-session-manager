import {
  Code2,
  Folder,
  GitBranch,
  GitFork,
  GitPullRequest,
  Layers,
  Loader2,
  MessageSquare,
  Pencil,
  Play,
  Trash2,
  Info,
} from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import type { PendingAction } from "../hooks/useSessions";
import { useSessionActions, type SessionHandlers } from "../hooks/useSessionActions";
import type { Session } from "../../shared/session";
import { AnchoredMenu } from "./AnchoredMenu";
import { Button } from "./Button";
import { LaunchLayoutButton } from "./LaunchLayoutButton";
import { LinkifiedText } from "./LinkifiedText";
import { MissingDirectoryNotice } from "./MissingDirectoryNotice";
import { TaskReposLine } from "./TaskReposLine";
import { ToolbarIconButton } from "./ToolbarIconButton";
import { Tooltip } from "./Tooltip";
import { PreviewLinks } from "./PreviewLinks";
import { WorkStatusSelect } from "./WorkStatusSelect";
import { formatWorktreePath } from "../utils/formatPath";

type SessionCardProps = SessionHandlers & {
  session: Session;
  pendingAction?: PendingAction;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onDeleteRequest: (session: Session) => void;
  /** Opens the session's detail panel (from its title). */
  onOpenDetails?: (session: Session) => void;
};

export function SessionCard({
  session,
  pendingAction,
  selected,
  onToggleSelect,
  onDeleteRequest,
  onOpenDetails,
  ...handlers
}: SessionCardProps) {
  const { t } = useLanguage();
  const actions = useSessionActions(session, handlers, pendingAction);
  const { onContinue, onOpenInVSCode, onOpenInCursor, onFilterByTask, onWorktreeSyncComplete } =
    handlers;
  const { onOpenMissingWorktreeRootInVSCode, onStartNewSessionAtMissingWorktreeRoot } = handlers;
  const isDeleting = actions.busy.deleting;
  const isContinuing = actions.busy.continuing;
  const isSettingNickname = actions.busy.nickname;
  const isSettingBranches = actions.busy.branches;
  const isOpeningVSCode = actions.busy.vscode;
  const isOpeningCursor = actions.busy.cursor;
  const isDeletingWorktree = actions.busy.worktreeDelete;
  const isResumingAtMissingWorktreeRoot = actions.busy.missingRootResume;
  const isBusy = isDeleting || isContinuing || isSettingNickname;
  const setOpenModal = actions.open;
  const openingPrUrl = actions.openingPrUrl;
  const { originBranch, taskBranch } = actions;
  const worktreePathParts =
    session.isWorktree && session.workingDirectory
      ? formatWorktreePath(session.workingDirectory)
      : null;

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
        label={t(actions.gridLayout ? "sessionCard.resumeIn.button" : "sessionCard.resumeButton")}
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
      className={`relative flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:bg-gray-900 ${
        selected
          ? "border-violet-500 ring-2 ring-violet-500/20 dark:border-violet-400 dark:ring-violet-400/20"
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
            className={`h-3 w-3 rounded-full border-2 shadow ${
              session.isActive
                ? "border-white bg-emerald-500 dark:border-gray-900 dark:bg-emerald-400"
                : "border-gray-400 bg-white dark:border-gray-500 dark:bg-gray-900"
            }`}
          />
        </Tooltip>
        <WorkStatusSelect
          value={session.status ?? null}
          taskKey={session.taskKey ?? null}
          testKey={session.testKey ?? null}
          saving={pendingAction === "status"}
          onChange={(status) => void actions.changeStatus(status)}
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
      </div>

      <div className="mt-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h2
            className="line-clamp-2 text-base font-semibold text-gray-900 dark:text-gray-100"
            title={session.title}
          >
            {onOpenDetails ? (
              <button
                type="button"
                onClick={() => onOpenDetails(session)}
                className="text-left hover:text-violet-700 dark:hover:text-violet-300"
              >
                {session.title}
              </button>
            ) : (
              session.title
            )}
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
      <div className="mt-auto flex flex-wrap items-center gap-4 border-t border-gray-100 pt-3 dark:border-gray-800">
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
        {taskBranch && !session.directoryMissing && !session.isAppRepo && (
          <ToolbarIconButton
            tooltip={t("sessionCard.openPrTooltip")}
            ariaLabel={t("sessionCard.openPrAriaLabel")}
            color="lime"
            disabled={openingPrUrl}
            onClick={() => void actions.openPr()}
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

      {actions.dialogs}
    </div>
  );
}
