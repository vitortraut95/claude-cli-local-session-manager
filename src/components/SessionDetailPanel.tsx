import {
  ArrowRight,
  Code2,
  ExternalLink,
  Folder,
  GitBranch,
  GitFork,
  GitPullRequest,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Play,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import jenkinsIcon from "../assets/jenkins.svg";
import { useLanguage } from "../hooks/useLanguage";
import { useSessionActions, type SessionHandlers } from "../hooks/useSessionActions";
import type { PendingAction } from "../hooks/useSessions";
import * as sessionsApi from "../services/sessionsApi";
import * as tasksApi from "../services/tasksApi";
import type { Session, TranscriptTurn } from "../../shared/session";
import { formatUpdatedAt } from "../utils/formatDate";
import { formatWorktreePath } from "../utils/formatPath";
import { sessionDisplayTitle } from "../utils/sessionTitle";
import type { AttentionReason } from "../utils/sessionGroups";
import { AnchoredMenu } from "./AnchoredMenu";
import { Button } from "./Button";
import { InlineDeleteConfirm, type DeleteOptions } from "./InlineDeleteConfirm";
import { LaunchLayoutButton } from "./LaunchLayoutButton";
import { LinkifiedText } from "./LinkifiedText";
import { MissingDirectoryNotice } from "./MissingDirectoryNotice";
import { PreviewLinks } from "./PreviewLinks";
import { MenuItem, SessionMenuItems } from "./SessionRow";
import { TaskHistoryView } from "./TaskHistoryModal";
import { Tooltip } from "./Tooltip";
import { WorkStatusSelect } from "./WorkStatusSelect";
import { attentionText } from "./attentionText";

type Tab = "overview" | "conversation" | "history";

type SessionDetailPanelProps = {
  session: Session;
  pendingAction?: PendingAction;
  handlers: SessionHandlers;
  reason: AttentionReason | null;
  onClose: () => void;
  onDelete: (session: Session, options: DeleteOptions) => void;
};

function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="border-b border-gray-100 py-4 last:border-b-0 dark:border-gray-800">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

const linkButton =
  "inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-sm font-medium text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-500/10";

/**
 * Keyed by the session's id by its parent, so another session starts fresh on its overview.
 *
 * Everything about one session beside the list:
 * task and status, resume / editor / PR, then tabs with the overview (branches, folder, task
 * repositories, local previews, first prompt, links), the conversation and the task's history.
 * Delete is confirmed in the footer itself.
 */
export function SessionDetailPanel({
  session,
  pendingAction,
  handlers,
  reason,
  onClose,
  onDelete,
}: SessionDetailPanelProps) {
  const { t, language } = useLanguage();
  const actions = useSessionActions(session, handlers, pendingAction);
  const [tab, setTab] = useState<Tab>("overview");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [taskLink, setTaskLink] = useState<{ key: string; link: string | null } | null>(null);
  const tabsId = useId();
  const key = session.taskKey ?? session.testKey ?? null;
  const title = sessionDisplayTitle(session);
  const busy = actions.busy.deleting || actions.busy.continuing || actions.busy.nickname;
  const worktree =
    session.isWorktree && session.workingDirectory
      ? formatWorktreePath(session.workingDirectory)
      : null;

  // The ticket's link (saved with the task); the key alone when there's none.
  useEffect(() => {
    if (!session.taskKey) return;
    let cancelled = false;
    const taskKey = session.taskKey;
    tasksApi
      .fetchTask(taskKey)
      .then((details) => {
        if (!cancelled) setTaskLink({ key: taskKey, link: details.link });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [session.taskKey]);
  const jiraLink = taskLink && taskLink.key === session.taskKey ? taskLink.link : null;

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: t("detail.tab.overview") },
    { id: "conversation", label: t("detail.tab.conversation") },
    ...(session.hasHistory ? [{ id: "history" as const, label: t("detail.tab.history") }] : []),
  ];

  return (
    <aside aria-label={t("detail.label")} className="flex h-full min-h-0 flex-col bg-panel">
      <div className="flex flex-col gap-3 border-b border-gray-200 px-5 pt-4 pb-4 dark:border-gray-800">
        <div className="flex items-center gap-2">
          {key ? (
            jiraLink ? (
              <a
                href={jiraLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-mono text-sm text-violet-700 hover:underline dark:text-violet-300"
              >
                {key}
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                <span className="sr-only">{t("detail.openInJira")}</span>
              </a>
            ) : (
              <span className="font-mono text-sm text-violet-700 dark:text-violet-300">{key}</span>
            )
          ) : (
            actions.canOpenTask && (
              <button
                type="button"
                onClick={() => actions.open({ kind: "task", addRepo: false })}
                className="inline-flex min-h-7 items-center rounded-md border border-dashed border-gray-300 px-2 text-xs text-gray-600 hover:border-gray-400 hover:text-gray-900 dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-100"
              >
                {t("detail.linkTask")}
              </button>
            )
          )}
          <span className="flex-1" />
          <span
            className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ${
              session.isActive
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
            }`}
          >
            {session.isActive ? t("sessions.live.running") : t("sessions.live.stopped")}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t("detail.close")}
            icon={<X className="h-4 w-4" />}
          />
        </div>

        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg leading-snug font-semibold tracking-tight break-words text-gray-900 dark:text-gray-100">
              {title}
            </h2>
            {session.nickname && (
              <p
                className="mt-0.5 line-clamp-2 text-xs text-gray-500 dark:text-gray-400"
                title={session.title}
              >
                {session.title}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => actions.open({ kind: "nickname" })}
            disabled={busy}
            aria-label={
              session.nickname ? t("sessionCard.nickname.edit") : t("sessionCard.nickname.add")
            }
            title={t("sessionCard.nickname.localOnly")}
            icon={
              actions.busy.nickname ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Pencil className="h-4 w-4" />
              )
            }
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
          <span id={`${tabsId}-status`}>{t("detail.status")}</span>
          <WorkStatusSelect
            value={session.status ?? null}
            taskKey={session.taskKey ?? null}
            testKey={session.testKey ?? null}
            saving={actions.busy.status}
            onChange={(status) => void actions.changeStatus(status)}
          />
          {session.taskKey && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t("detail.status.task", { key: session.taskKey })}
            </span>
          )}
        </div>

        {reason && (
          <p
            className={`rounded-lg px-3 py-2 text-sm ${
              reason.kind === "waitingUser"
                ? "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
                : "bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-300"
            }`}
          >
            {attentionText(reason, t)}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <span className="flex min-w-40 flex-1">
            <LaunchLayoutButton
              fullWidth
              label={t("sessionCard.resumeIn.button")}
              icon={<Play className="h-4 w-4" />}
              busy={actions.busy.continuing}
              disabled={busy || session.directoryMissing}
              onLaunch={(layout) => handlers.onContinue(session, layout)}
            />
          </span>
          <AnchoredMenu
            align="right"
            disabled={session.directoryMissing || actions.busy.vscode || actions.busy.cursor}
            buttonClassName="min-h-10 gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
            label={
              <>
                {actions.busy.vscode || actions.busy.cursor ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Code2 className="h-4 w-4" />
                )}
                {t("sessionCard.openEditor")}
              </>
            }
          >
            {(close) => (
              <div className="flex min-w-48 flex-col">
                <MenuItem
                  icon={<Code2 className="h-4 w-4" />}
                  label={t("sessionCard.openEditor.vscode")}
                  onClick={() => {
                    close();
                    handlers.onOpenInVSCode(session);
                  }}
                />
                <MenuItem
                  icon={<Code2 className="h-4 w-4" />}
                  label={t("sessionCard.openEditor.cursor")}
                  onClick={() => {
                    close();
                    handlers.onOpenInCursor(session);
                  }}
                />
              </div>
            )}
          </AnchoredMenu>
          {actions.canOpenPr && (
            <Button
              variant="outline"
              onClick={() => void actions.openPr()}
              disabled={actions.openingPrUrl}
              icon={
                actions.openingPrUrl ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <GitPullRequest className="h-4 w-4" />
                )
              }
            >
              PR
            </Button>
          )}
          <AnchoredMenu
            align="right"
            hideChevron
            ariaLabel={t("sessions.row.more")}
            buttonClassName="min-h-10 w-10 justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
            label={<MoreHorizontal className="h-4 w-4" />}
          >
            {(close) => (
              <SessionMenuItems
                session={session}
                actions={actions}
                handlers={handlers}
                close={close}
                onDelete={() => setConfirmingDelete(true)}
              />
            )}
          </AnchoredMenu>
        </div>
      </div>

      <div
        role="tablist"
        aria-label={t("detail.label")}
        className="flex gap-1 border-b border-gray-200 px-3 dark:border-gray-800"
      >
        {tabs.map((item) => {
          const selected = item.id === tab;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`${tabsId}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`${tabsId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(item.id)}
              onKeyDown={(event) => {
                if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
                const index = tabs.findIndex((entry) => entry.id === tab);
                const next =
                  tabs[(index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length]!;
                setTab(next.id);
                document.getElementById(`${tabsId}-tab-${next.id}`)?.focus();
              }}
              className={`h-11 px-2.5 text-sm font-medium ${
                selected
                  ? "text-gray-900 shadow-[inset_0_-2px_0_var(--color-violet-600)] dark:text-gray-100 dark:shadow-[inset_0_-2px_0_var(--color-violet-400)]"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${tabsId}-panel`}
        aria-labelledby={`${tabsId}-tab-${tab}`}
        className="min-h-0 flex-1 overflow-y-auto px-5"
      >
        {tab === "overview" && (
          <div className="pb-4">
            {session.directoryMissing && (
              <div className="pt-4">
                <MissingDirectoryNotice
                  session={session}
                  isOpeningVSCode={actions.busy.vscode}
                  isResumingAtMissingWorktreeRoot={actions.busy.missingRootResume}
                  onOpenMissingWorktreeRootInVSCode={handlers.onOpenMissingWorktreeRootInVSCode}
                  onStartNewSessionAtMissingWorktreeRoot={
                    handlers.onStartNewSessionAtMissingWorktreeRoot
                  }
                />
              </div>
            )}

            {actions.showsBranches && (
              <Section
                title={t("detail.branches")}
                action={
                  <button
                    type="button"
                    onClick={() => actions.open({ kind: "branches" })}
                    disabled={actions.busy.branches}
                    className={linkButton}
                  >
                    {actions.busy.branches && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {t("detail.edit")}
                  </button>
                }
              >
                <p className="flex flex-wrap items-center gap-2 font-mono text-sm">
                  {actions.originBranch && actions.originBranch !== actions.taskBranch && (
                    <>
                      <span className="text-gray-600 dark:text-gray-400">
                        {actions.originBranch}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                    </>
                  )}
                  <span className="inline-flex items-center gap-1.5 text-gray-900 dark:text-gray-100">
                    <GitBranch className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                    {actions.taskBranch}
                  </span>
                </p>
              </Section>
            )}

            <Section title={t("detail.folder")}>
              <p
                className="flex items-start gap-2 text-sm text-gray-800 dark:text-gray-200"
                title={session.workingDirectory ?? session.project}
              >
                {session.isWorktree ? (
                  <GitFork
                    className="mt-0.5 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400"
                    aria-hidden="true"
                  />
                ) : (
                  <Folder className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                )}
                <span className="min-w-0 break-all">
                  {worktree ? (
                    <>
                      {t("detail.worktree", { name: worktree.name })}
                      <span className="block font-mono text-xs text-gray-500 dark:text-gray-400">
                        {worktree.prefix}
                      </span>
                    </>
                  ) : (
                    <span className="font-mono text-xs">
                      {session.workingDirectory ?? session.project}
                    </span>
                  )}
                </span>
              </p>
            </Section>

            {actions.canOpenTask && (
              <Section
                title={t("detail.repos")}
                action={
                  <button
                    type="button"
                    onClick={() => actions.open({ kind: "task", addRepo: false })}
                    className={linkButton}
                  >
                    {t("detail.manageTask")}
                  </button>
                }
              >
                {(session.taskRepos?.length ?? 0) > 0 ? (
                  <ul className="flex flex-col gap-2">
                    {session.taskRepos!.map((repo) => {
                      const isThis =
                        repo.repoRoot === session.repoRoot && repo.branch === session.gitBranch;
                      return (
                        <li
                          key={`${repo.repoRoot}:${repo.branch}`}
                          className="flex items-start gap-2.5 text-sm"
                        >
                          <Folder
                            className="mt-0.5 h-4 w-4 shrink-0 text-gray-400"
                            aria-hidden="true"
                          />
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="text-gray-900 dark:text-gray-100">{repo.project}</span>
                            <span className="truncate font-mono text-xs text-gray-500 dark:text-gray-400">
                              {repo.branch}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                            {isThis
                              ? t("detail.repos.this")
                              : t("detail.repos.sessions", { count: repo.sessionIds.length })}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                <button
                  type="button"
                  onClick={() => actions.open({ kind: "task", addRepo: true })}
                  className={`${linkButton} mt-1 -ml-2`}
                >
                  {t("detail.addRepo")}
                </button>
              </Section>
            )}

            <Section title={t("detail.previews")}>
              {(session.previews?.length ?? 0) > 0 ? (
                <PreviewLinks
                  variant="list"
                  previews={session.previews ?? []}
                  onChanged={() => handlers.onWorktreeSyncComplete(session)}
                />
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t("detail.noPreviews")}</p>
              )}
            </Section>

            <Section title={t("detail.firstPrompt")}>
              {session.prompts[0] ? (
                <>
                  <p className="line-clamp-6 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm whitespace-pre-line break-words text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200">
                    <LinkifiedText text={session.prompts[0]} />
                  </p>
                  <button
                    type="button"
                    onClick={() => setTab("conversation")}
                    className={`${linkButton} mt-1 -ml-2`}
                  >
                    {t("detail.openConversation")}
                  </button>
                </>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t("detail.noPrompt")}</p>
              )}
            </Section>

            {(actions.canOpenPr || actions.jenkinsGroups !== null || key !== null) && (
              <Section title={t("detail.links")}>
                <div className="flex flex-wrap gap-2">
                  {actions.canOpenPr && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void actions.openPr()}
                      disabled={actions.openingPrUrl}
                      icon={<GitPullRequest className="h-3.5 w-3.5" />}
                    >
                      {t("sessions.menu.pr")}
                    </Button>
                  )}
                  {actions.jenkinsGroups && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => actions.open({ kind: "jenkins" })}
                      icon={<img src={jenkinsIcon} alt="" className="h-4 w-4" />}
                    >
                      {t("sessions.menu.jenkins")}
                    </Button>
                  )}
                  {key && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlers.onFilterByTask(key)}
                      icon={<Search className="h-3.5 w-3.5" />}
                    >
                      {t("detail.filterByTask", { key })}
                    </Button>
                  )}
                </div>
              </Section>
            )}
          </div>
        )}

        {tab === "conversation" && (
          <ConversationList
            session={session}
            onOpen={(index) => actions.open({ kind: "preview", index })}
          />
        )}

        {tab === "history" && (
          <div className="py-4">
            <TaskHistoryView session={session} />
          </div>
        )}
      </div>

      {confirmingDelete ? (
        <div className="border-t border-gray-200 dark:border-gray-800">
          <InlineDeleteConfirm
            session={session}
            onCancel={() => setConfirmingDelete(false)}
            onConfirm={(options) => {
              setConfirmingDelete(false);
              onDelete(session, options);
            }}
          />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 px-5 py-3 dark:border-gray-800">
          <span className="flex-1 text-xs text-gray-500 dark:text-gray-400">
            {t("detail.updated", { when: formatUpdatedAt(session.updatedAt, language) })}
          </span>
          {session.isWorktree && (
            <Tooltip
              content={session.isActive ? t("sessionCard.cleanupWorktree.disabledTooltip") : null}
            >
              <span className="inline-flex">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => actions.open({ kind: "deleteWorktree" })}
                  disabled={session.isActive || actions.busy.worktreeDelete}
                  className="text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                  icon={<GitFork className="h-3.5 w-3.5" />}
                >
                  {t("sessions.menu.removeWorktree")}
                </Button>
              </span>
            </Tooltip>
          )}
          <Tooltip content={session.isActive ? t("sessions.menu.deleteActive") : null}>
            <span className="inline-flex">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmingDelete(true)}
                disabled={session.isActive || actions.busy.deleting}
                className="text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                icon={
                  actions.busy.deleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )
                }
              >
                {t("sessions.menu.delete")}
              </Button>
            </span>
          </Tooltip>
        </div>
      )}
      {actions.dialogs}
    </aside>
  );
}

/** Every prompt of the session (newest last), each opening the full conversation on it. */
function ConversationList({
  session,
  onOpen,
}: {
  session: Session;
  onOpen: (index: number) => void;
}) {
  const { t } = useLanguage();
  const [turns, setTurns] = useState<TranscriptTurn[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    sessionsApi
      .fetchSessionTranscript(session.id)
      .then((result) => {
        if (!cancelled) setTurns(result);
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        setTurns(session.prompts.map((prompt) => ({ prompt, timestamp: null, items: [] })));
      });
    return () => {
      cancelled = true;
    };
    // session.prompts only feeds the fallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  if (turns === null) {
    return (
      <p className="flex items-center gap-2 py-4 text-sm text-gray-500 dark:text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("transcriptModal.loading")}
      </p>
    );
  }
  if (turns.length === 0) {
    return (
      <p className="py-4 text-sm text-gray-500 dark:text-gray-400">{t("transcriptModal.empty")}</p>
    );
  }
  return (
    <div className="flex flex-col gap-2 py-4">
      {failed && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {t("transcriptModal.loadError")}
        </p>
      )}
      <ol className="flex flex-col gap-2">
        {turns.map((turn, index) => {
          const tools = turn.items.filter((item) => item.kind === "tool").length;
          return (
            <li key={index}>
              <button
                type="button"
                onClick={() => onOpen(index)}
                className="flex w-full flex-col gap-1 rounded-lg border border-gray-200 bg-white p-3 text-left hover:border-violet-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-violet-500/50"
              >
                <span className="flex justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>
                    #{index + 1}
                    {turn.timestamp &&
                      ` · ${new Date(turn.timestamp).toLocaleString([], {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`}
                  </span>
                  {tools > 0 && <span>{t("transcriptModal.toolCount", { count: tools })}</span>}
                </span>
                <span className="line-clamp-3 text-sm break-words text-gray-800 dark:text-gray-200">
                  {turn.prompt}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-violet-700 dark:text-violet-300">
                  <MessageSquare className="h-3 w-3" aria-hidden="true" />
                  {t("detail.conversation.open")}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
