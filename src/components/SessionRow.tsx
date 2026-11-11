import {
  Code2,
  Folder,
  GitBranch,
  GitFork,
  GitPullRequest,
  Globe,
  History,
  Layers,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  PanelRight,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useSessionActions, type SessionHandlers } from "../hooks/useSessionActions";
import type { PendingAction } from "../hooks/useSessions";
import type { Session } from "../../shared/session";
import { formatUpdatedAt } from "../utils/formatDate";
import { sessionDisplayTitle, sessionRepoName } from "../utils/sessionTitle";
import type { AttentionReason } from "../utils/sessionGroups";
import { AnchoredMenu } from "./AnchoredMenu";
import { InlineDeleteConfirm, type DeleteOptions } from "./InlineDeleteConfirm";
import { LaunchLayoutButton } from "./LaunchLayoutButton";
import { LiveDot } from "./LiveDot";
import { Tooltip } from "./Tooltip";
import { WorkStatusSelect } from "./WorkStatusSelect";
import { attentionText } from "./attentionText";

type SessionRowProps = {
  session: Session;
  pendingAction?: PendingAction;
  handlers: SessionHandlers;
  reason: AttentionReason | null;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  /** Its detail panel is the one open. */
  current: boolean;
  onOpenDetails: (session: Session) => void;
  onDelete: (session: Session, options: DeleteOptions) => void;
};

/** A menu entry of the row's "⋯". */
export function MenuItem({
  icon,
  label,
  onClick,
  disabled = false,
  danger = false,
  hint,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  hint?: string;
}) {
  const button = (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
        danger
          ? "text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          : "text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
      }`}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-current opacity-80">
        {icon}
      </span>
      {label}
    </button>
  );
  // A disabled button fires no hover: the tooltip saying why goes on a span around it.
  return hint ? (
    <Tooltip content={hint}>
      <span className="block">{button}</span>
    </Tooltip>
  ) : (
    button
  );
}

/**
 * One session in the grouped list: what it is (title, task, repo, branch, why it needs you), its
 * status, how many local URLs serve it, when it last changed, Resume, and every other action in
 * "⋯". Deleting asks on the row itself.
 */
export function SessionRow({
  session,
  pendingAction,
  handlers,
  reason,
  selected,
  onToggleSelect,
  current,
  onOpenDetails,
  onDelete,
}: SessionRowProps) {
  const { t, language } = useLanguage();
  const actions = useSessionActions(session, handlers, pendingAction);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const busy = actions.busy.deleting || actions.busy.continuing || actions.busy.nickname;
  const title = sessionDisplayTitle(session);
  const otherRepos = (session.taskRepos ?? []).filter(
    (repo) => !(repo.repoRoot === session.repoRoot && repo.branch === session.gitBranch),
  ).length;
  const previewCount = session.previews?.length ?? 0;
  const branch = actions.taskBranch ?? session.gitBranch;

  if (confirmingDelete) {
    return (
      <li className="border-t border-gray-100 first:border-t-0 dark:border-gray-800">
        <InlineDeleteConfirm
          session={session}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={(options) => {
            setConfirmingDelete(false);
            onDelete(session, options);
          }}
        />
        {actions.dialogs}
      </li>
    );
  }

  return (
    <li
      className={`group/row flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-gray-100 px-3 py-2.5 first:border-t-0 sm:px-4 dark:border-gray-800 ${
        current
          ? "bg-violet-50 shadow-[inset_2px_0_0_var(--color-violet-600)] dark:bg-violet-500/10"
          : "hover:bg-gray-50 dark:hover:bg-gray-800/40"
      }`}
    >
      <Tooltip content={session.isActive ? t("sessionCard.deleteDisabledTooltip") : null}>
        <span className="inline-flex shrink-0">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(session.id)}
            disabled={busy || session.isActive}
            aria-label={
              selected ? t("sessionCard.checkbox.deselect") : t("sessionCard.checkbox.select")
            }
            className="h-4 w-4 accent-violet-600 disabled:cursor-not-allowed disabled:opacity-30 dark:accent-violet-400"
          />
        </span>
      </Tooltip>
      <LiveDot active={session.isActive} />

      <button
        type="button"
        onClick={() => onOpenDetails(session)}
        aria-current={current ? "true" : undefined}
        aria-label={`${title} · ${t("sessions.row.details")}`}
        className="flex min-w-0 flex-[1_1_16rem] flex-col gap-1 rounded-md py-0.5 text-left"
      >
        <span
          className="truncate text-sm font-medium text-gray-900 dark:text-gray-100"
          title={session.title}
        >
          {title}
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-600 dark:text-gray-400">
          <span
            className={`font-mono ${
              session.taskKey || session.testKey || session.reviewKey
                ? "text-violet-700 dark:text-violet-300"
                : "text-gray-500 dark:text-gray-500"
            }`}
          >
            {session.taskKey ?? session.testKey ?? session.reviewKey ?? t("sessions.noTask")}
          </span>
          <span className="inline-flex min-w-0 items-center gap-1">
            {session.isWorktree ? (
              <GitFork
                className="h-3 w-3 shrink-0 text-violet-600 dark:text-violet-400"
                aria-hidden="true"
              />
            ) : (
              <Folder className="h-3 w-3 shrink-0" aria-hidden="true" />
            )}
            <span className="truncate">{sessionRepoName(session)}</span>
            {otherRepos > 0 && <span className="text-gray-500">+{otherRepos}</span>}
          </span>
          <span className="sm:hidden">{formatUpdatedAt(session.updatedAt, language)}</span>
          {branch && !session.isAppRepo && (
            <span className="inline-flex min-w-0 items-center gap-1 font-mono text-gray-500 dark:text-gray-500">
              <GitBranch className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{branch}</span>
            </span>
          )}
        </span>
        {reason && (
          <span
            className={`text-xs font-medium ${
              reason.kind === "waitingUser"
                ? "text-amber-700 dark:text-amber-400"
                : "text-red-700 dark:text-red-400"
            }`}
          >
            {attentionText(reason, t)}
          </span>
        )}
      </button>

      <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-x-2 gap-y-2 sm:gap-x-3">
        <WorkStatusSelect
          value={session.status ?? null}
          taskKey={session.taskKey ?? null}
          testKey={session.testKey ?? null}
          reviewKey={session.reviewKey ?? null}
          saving={actions.busy.status}
          onChange={(status) => void actions.changeStatus(status)}
        />
        <span
          className="hidden w-10 items-center gap-1 text-xs text-gray-600 tabular-nums sm:inline-flex dark:text-gray-400"
          title={t("sessions.previews", { count: previewCount })}
        >
          {previewCount > 0 && (
            <>
              <Globe className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">{t("sessions.previews", { count: previewCount })}</span>
              <span aria-hidden="true">{previewCount}</span>
            </>
          )}
        </span>
        <span className="hidden w-24 text-right text-xs text-gray-500 sm:inline dark:text-gray-400">
          {formatUpdatedAt(session.updatedAt, language)}
        </span>
        <LaunchLayoutButton
          size="sm"
          variant="outline"
          label={t("sessionCard.resumeIn.button")}
          icon={<Play className="h-3.5 w-3.5" />}
          busy={actions.busy.continuing}
          disabled={busy || session.directoryMissing}
          onLaunch={(layout) => handlers.onContinue(session, layout)}
          align="right"
        />
        <AnchoredMenu
          align="right"
          hideChevron
          ariaLabel={t("sessions.row.more")}
          buttonClassName="h-8 w-8 justify-center rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          label={<MoreHorizontal className="h-4 w-4" />}
        >
          {(close) => (
            <SessionMenuItems
              session={session}
              actions={actions}
              handlers={handlers}
              close={close}
              onOpenDetails={() => onOpenDetails(session)}
              onDelete={() => setConfirmingDelete(true)}
            />
          )}
        </AnchoredMenu>
      </div>
      {actions.dialogs}
    </li>
  );
}

/** The "⋯" menu's entries, shared by the list row and the detail panel. */
export function SessionMenuItems({
  session,
  actions,
  handlers,
  close,
  onOpenDetails,
  onDelete,
}: {
  session: Session;
  actions: ReturnType<typeof useSessionActions>;
  handlers: SessionHandlers;
  close: () => void;
  onOpenDetails?: () => void;
  onDelete: () => void;
}) {
  const { t } = useLanguage();
  const pick = (run: () => void) => () => {
    close();
    run();
  };
  const noFolder = session.directoryMissing;
  return (
    <div className="flex min-w-60 flex-col">
      {onOpenDetails && (
        <MenuItem
          icon={<PanelRight className="h-4 w-4" />}
          label={t("sessions.row.details")}
          onClick={pick(onOpenDetails)}
        />
      )}
      <MenuItem
        icon={<Pencil className="h-4 w-4" />}
        label={t("sessions.menu.nickname")}
        onClick={pick(() => actions.open({ kind: "nickname" }))}
      />
      {actions.showsBranches && (
        <MenuItem
          icon={<GitBranch className="h-4 w-4" />}
          label={t("sessions.menu.branches")}
          onClick={pick(() => actions.open({ kind: "branches" }))}
        />
      )}
      {actions.canOpenTask && (
        <MenuItem
          icon={<Layers className="h-4 w-4" />}
          label={t("sessions.menu.task")}
          onClick={pick(() => actions.open({ kind: "task", addRepo: false }))}
        />
      )}
      {session.prompts.length > 0 && (
        <MenuItem
          icon={<MessageSquare className="h-4 w-4" />}
          label={t("sessions.menu.conversation")}
          onClick={pick(() => actions.open({ kind: "preview" }))}
        />
      )}
      {session.hasHistory && (
        <MenuItem
          icon={<History className="h-4 w-4" />}
          label={t("sessions.menu.history")}
          onClick={pick(() => actions.open({ kind: "history" }))}
        />
      )}
      <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
      <MenuItem
        icon={<Code2 className="h-4 w-4" />}
        label={t("sessions.menu.vscode")}
        disabled={noFolder || actions.busy.vscode}
        onClick={pick(() => handlers.onOpenInVSCode(session))}
      />
      <MenuItem
        icon={<Code2 className="h-4 w-4" />}
        label={t("sessions.menu.cursor")}
        disabled={noFolder || actions.busy.cursor}
        onClick={pick(() => handlers.onOpenInCursor(session))}
      />
      {actions.canOpenPr && (
        <MenuItem
          icon={
            actions.openingPrUrl ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GitPullRequest className="h-4 w-4" />
            )
          }
          label={t("sessions.menu.pr")}
          disabled={actions.openingPrUrl}
          onClick={pick(() => void actions.openPr())}
        />
      )}
      <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
      {session.isWorktree && (
        <MenuItem
          icon={<GitFork className="h-4 w-4" />}
          label={t("sessions.menu.removeWorktree")}
          danger
          disabled={session.isActive || actions.busy.worktreeDelete}
          hint={session.isActive ? t("sessionCard.cleanupWorktree.disabledTooltip") : undefined}
          onClick={pick(() => actions.open({ kind: "deleteWorktree" }))}
        />
      )}
      <MenuItem
        icon={<Trash2 className="h-4 w-4" />}
        label={t("sessions.menu.delete")}
        danger
        disabled={session.isActive || actions.busy.deleting}
        hint={session.isActive ? t("sessions.menu.deleteActive") : undefined}
        onClick={pick(onDelete)}
      />
    </div>
  );
}
