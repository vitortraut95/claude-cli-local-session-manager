import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Copy,
  History,
  LayoutGrid,
  LayoutList,
  Plus,
  RefreshCw,
  SquareTerminal,
  Trash2,
  X,
  Clock,
  Layers,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import type { DeleteOptions } from "../components/InlineDeleteConfirm";
import { PageHeader } from "../components/PageHeader";
import { Pagination } from "../components/Pagination";
import { PerPageSelect } from "../components/PerPageSelect";
import { ProjectFilter } from "../components/ProjectFilter";
import { ResumeConflictModal } from "../components/ResumeConflictModal";
import { SearchBar } from "../components/SearchBar";
import { SessionCard } from "../components/SessionCard";
import { SessionDetailPanel } from "../components/SessionDetailPanel";
import { SessionRow } from "../components/SessionRow";
import { Tooltip } from "../components/Tooltip";
import { WorkStatusFilter } from "../components/WorkStatusFilter";
import { attentionText } from "../components/attentionText";
import { useLanguage } from "../hooks/useLanguage";
import type { SessionHandlers } from "../hooks/useSessionActions";
import type { QuickFilter, useSessions } from "../hooks/useSessions";
import { useShell } from "../hooks/useShell";
import { useUrlParam } from "../hooks/useUrlState";
import type { Session } from "../../shared/session";
import { DEFAULT_BRANCHES } from "../utils/branches";
import { formatUpdatedAt } from "../utils/formatDate";
import {
  attentionReason,
  SESSION_GROUPS,
  sessionGroup,
  sessionKey,
  type SessionGroup,
  type TaskProblems,
} from "../utils/sessionGroups";

const VIEW_KEY = "sessions.view";

type SessionsPageProps = {
  sessions: ReturnType<typeof useSessions>;
  problems: TaskProblems;
};

function readViewMode(): "list" | "cards" {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "cards" ? "cards" : "list";
  } catch {
    return "list";
  }
}

const GROUP_LABEL = {
  attention: "sessions.group.attention",
  running: "sessions.group.running",
  stopped: "sessions.group.stopped",
  done: "sessions.group.done",
} as const;

/** "Updated 10 s ago", kept current. */
function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/**
 * The home page: every session, what needs the user first (grouped list, or the cards), with the
 * filters, bulk delete and a detail panel beside the list for the selected session.
 */
export function SessionsPage({ sessions: state, problems }: SessionsPageProps) {
  const { t, language } = useLanguage();
  const shell = useShell();
  const {
    sessions,
    allSessions,
    totalCount,
    filteredCount,
    foldedDoneCount,
    groupCounts,
    showDone,
    setShowDone,
    sort,
    setSort,
    quickFilter,
    setQuickFilter,
    loadedAt,
    loading,
    scanProgress,
    error,
    searchQuery,
    setSearchQuery,
    projects,
    projectLabels,
    projectFilter,
    setProjectFilter,
    statusFilter,
    setStatusFilter,
    page,
    pageCount,
    perPage,
    setPage,
    setPerPage,
    pendingActions,
    selectedIds,
    toggleSelect,
    clearSelection,
    refresh,
    refreshSoon,
    removeSession,
    removeSessions,
    resumeSession,
    setNickname,
    setBranches,
    setStatus,
    openInVSCode,
    openInCursor,
    openMissingWorktreeRootInVSCode,
    startNewSessionAtMissingWorktreeRoot,
    createWorktree,
    deleteWorktree,
    resumeConflict,
    clearResumeConflict,
    stopAndCheckoutResume,
  } = state;
  const [viewMode, setViewModeState] = useState(readViewMode);
  const [selectedId, setSelectedId] = useUrlParam("session", "");
  const [cardPendingDeletion, setCardPendingDeletion] = useState<Session | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const now = useNow(10_000);

  const setViewMode = (mode: "list" | "cards") => {
    setViewModeState(mode);
    try {
      window.localStorage.setItem(VIEW_KEY, mode);
    } catch {
      // Remembered for this page load only.
    }
  };

  const selected = allSessions.find((session) => session.id === selectedId) ?? null;
  const closePanel = () => setSelectedId("");

  // "/" focuses the search; Esc closes the panel (when nothing else is open over it).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inField =
        target &&
        (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable);
      const inDialog = document.querySelector("[role='dialog'][aria-modal='true']") !== null;
      if (event.key === "/" && !inField && !inDialog) {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === "Escape" && !inField && !inDialog && selectedId) {
        setSelectedId("");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, setSelectedId]);

  // A task's sessions span several projects, so the project filter would hide the other repos'.
  // Goes through the search box (which also matches `taskKey`) so it's cleared like any search.
  const filterByTask = (taskKey: string) => {
    setSearchQuery(taskKey);
    setProjectFilter("");
    setStatusFilter("");
    setQuickFilter("");
  };

  const clearFilters = () => {
    setSearchQuery("");
    setProjectFilter("");
    setStatusFilter("");
    setQuickFilter("");
  };

  const handlers: SessionHandlers = {
    onContinue: (session, layout) => void resumeSession(session.id, layout),
    onSetNickname: (session, nickname) => void setNickname(session.id, nickname),
    onSetBranches: (session, origin, destination) =>
      void setBranches(session.id, origin, destination),
    onSetStatus: setStatus,
    onOpenInVSCode: (session) => void openInVSCode(session.id),
    onOpenInCursor: (session) => void openInCursor(session.id),
    onOpenMissingWorktreeRootInVSCode: (session) =>
      void openMissingWorktreeRootInVSCode(session.id),
    onStartNewSessionAtMissingWorktreeRoot: (session, layout) =>
      startNewSessionAtMissingWorktreeRoot(session, layout),
    onDeleteWorktree: (session) => void deleteWorktree(session.id),
    onWorktreeSyncComplete: () => refresh(),
    onFilterByTask: filterByTask,
    onTaskChanged: refreshSoon,
  };

  const deleteSession = (session: Session, options: DeleteOptions) => {
    if (session.id === selectedId) closePanel();
    void removeSession(
      session.id,
      options.cleanupWorktree,
      options.cleanupBranch,
      options.branchName,
    );
  };

  const confirmCardDelete = (options: DeleteOptions) => {
    if (!cardPendingDeletion) return;
    const session = cardPendingDeletion;
    setCardPendingDeletion(null);
    deleteSession(session, options);
  };

  const runningCount = allSessions.filter((session) => session.isActive).length;
  const attentionCount = allSessions.filter(
    (session) => sessionGroup(session, problems) === "attention",
  ).length;

  // Tasks the queue or the Board flags as failed that have no session to show it on.
  const taskOnlyProblems = useMemo(() => {
    const keys = new Set(allSessions.map(sessionKey).filter(Boolean));
    return [...problems.entries()].filter(([key]) => !keys.has(key));
  }, [allSessions, problems]);
  const showTaskOnly =
    taskOnlyProblems.length > 0 &&
    page === 1 &&
    searchQuery.trim() === "" &&
    !projectFilter &&
    !statusFilter &&
    quickFilter !== "running";

  const quickFilters: { id: QuickFilter; label: string; count: number }[] = [
    { id: "", label: t("sessions.quick.all"), count: totalCount },
    { id: "attention", label: t("sessions.quick.attention"), count: attentionCount },
    { id: "running", label: t("sessions.quick.running"), count: runningCount },
  ];

  const header = (
    <PageHeader
      title={t("sessions.title")}
      subtitle={
        loading && totalCount === 0
          ? t("sessions.loading")
          : t("sessions.summary", {
              total: totalCount,
              running: runningCount,
              attention: attentionCount,
            })
      }
      actions={
        <>
          <Tooltip
            content={t(
              shell.gridLayout ? "header.grid.tooltip" : "sessionsPage.resumeOpen.tooltip",
            )}
          >
            <Button
              variant="outline"
              onClick={() => void shell.resumeOpen()}
              disabled={shell.resumingOpen}
              icon={
                shell.gridLayout ? (
                  <LayoutGrid className="h-4 w-4" />
                ) : (
                  <History className="h-4 w-4" />
                )
              }
            >
              {t(shell.gridLayout ? "header.grid" : "header.resumeOpen")}
            </Button>
          </Tooltip>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <SearchBar ref={searchRef} value={searchQuery} onChange={setSearchQuery} shortcut="/" />
        <div role="group" aria-label={t("sessions.quick.label")} className="flex flex-wrap gap-1.5">
          {quickFilters.map((filter) => {
            const on = quickFilter === filter.id;
            return (
              <button
                key={filter.id || "all"}
                type="button"
                aria-pressed={on}
                onClick={() => setQuickFilter(filter.id)}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors ${
                  on
                    ? "border-violet-500 bg-violet-50 text-violet-800 dark:border-violet-400 dark:bg-violet-500/15 dark:text-violet-100"
                    : "border-gray-300 text-gray-700 hover:border-gray-400 hover:text-gray-900 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:text-gray-100"
                }`}
              >
                {filter.label}
                <span className="text-xs tabular-nums opacity-75">{filter.count}</span>
              </button>
            );
          })}
        </div>
        <ProjectFilter
          projects={projects}
          projectLabels={projectLabels}
          value={projectFilter}
          onChange={setProjectFilter}
        />
        <WorkStatusFilter value={statusFilter} onChange={setStatusFilter} />
        <span className="hidden flex-1 xl:block" />
        <div
          role="group"
          aria-label={t("sessions.view.label")}
          className="inline-flex rounded-lg border border-gray-300 p-0.5 dark:border-gray-700"
        >
          {(
            [
              ["list", LayoutList, t("sessions.view.list")],
              ["cards", LayoutGrid, t("sessions.view.cards")],
            ] as const
          ).map(([mode, Icon, label]) => (
            <Tooltip key={mode} content={label}>
              <button
                type="button"
                aria-pressed={viewMode === mode}
                aria-label={label}
                onClick={() => setViewMode(mode)}
                className={`flex h-8 w-9 items-center justify-center rounded-md ${
                  viewMode === mode
                    ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                    : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            </Tooltip>
          ))}
        </div>
        <div
          role="group"
          aria-label={t("sessions.sort.label")}
          className="inline-flex rounded-lg border border-gray-300 p-0.5 dark:border-gray-700"
        >
          {(
            [
              ["groups", Layers, t("sessions.sort.groups")],
              ["date", Clock, t("sessions.sort.date")],
            ] as const
          ).map(([mode, Icon, label]) => (
            <Tooltip key={mode} content={label}>
              <button
                type="button"
                aria-pressed={sort === mode}
                aria-label={label}
                onClick={() => setSort(mode)}
                className={`flex h-8 w-9 items-center justify-center rounded-md ${
                  sort === mode
                    ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                    : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            </Tooltip>
          ))}
        </div>
        <Tooltip content={t("sessionsPage.refresh")}>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            aria-label={t("sessionsPage.refresh")}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-xs text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-60 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {loadedAt !== null && (
              <span aria-live="polite">
                {t("sessions.updatedAgo", {
                  when: formatUpdatedAt(new Date(Math.min(loadedAt, now)).toISOString(), language),
                })}
              </span>
            )}
          </button>
        </Tooltip>
      </div>
    </PageHeader>
  );

  const renderRows = (rows: Session[]) => (
    <ul className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      {rows.map((session) => (
        <SessionRow
          key={session.id}
          session={session}
          pendingAction={pendingActions[session.id]}
          handlers={handlers}
          reason={attentionReason(session, problems)}
          selected={selectedIds.has(session.id)}
          onToggleSelect={toggleSelect}
          current={session.id === selectedId}
          onOpenDetails={(s) => setSelectedId(s.id === selectedId ? "" : s.id)}
          onDelete={deleteSession}
        />
      ))}
    </ul>
  );

  const renderGroups = () => {
    if (sort === "date") return renderRows(sessions);
    const byGroup = new Map<SessionGroup, Session[]>();
    for (const session of sessions) {
      const group = sessionGroup(session, problems);
      byGroup.set(group, [...(byGroup.get(group) ?? []), session]);
    }
    return SESSION_GROUPS.filter((group) => byGroup.has(group)).map((group) => (
      <section key={group} aria-labelledby={`group-${group}`} className="mt-5 first:mt-0">
        <div className="flex items-baseline gap-2 px-1 pb-2">
          <h2
            id={`group-${group}`}
            className="text-sm font-semibold text-gray-900 dark:text-gray-100"
          >
            {t(GROUP_LABEL[group])}
          </h2>
          <span className="text-xs text-gray-500 tabular-nums dark:text-gray-400">
            {groupCounts[group]}
          </span>
          {group === "attention" && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t("sessions.group.attention.hint")}
            </span>
          )}
          {group === "done" && showDone && (
            <button
              type="button"
              onClick={() => setShowDone(false)}
              className="ml-auto flex items-center gap-1 text-xs font-medium text-violet-700 hover:underline dark:text-violet-300"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              {t("sessions.done.hide")}
            </button>
          )}
        </div>
        {renderRows(byGroup.get(group)!)}
      </section>
    ));
  };

  const renderContent = (): ReactNode => {
    if (loading && totalCount === 0) return <ListSkeleton scanProgress={scanProgress} />;
    if (error) return <SessionsError message={error} onRetry={refresh} />;
    if (totalCount === 0) {
      return (
        <EmptyBlock
          icon={<SquareTerminal className="h-6 w-6" />}
          title={t("sessions.empty.title")}
          body={t("sessions.empty.body")}
        >
          <Button onClick={shell.openNewTask} icon={<Plus className="h-4 w-4" />}>
            {t("header.newTask")}
          </Button>
          <Button variant="outline" onClick={shell.openNewSession}>
            {t("header.newSession")}
          </Button>
        </EmptyBlock>
      );
    }
    if (filteredCount === 0) {
      return (
        <EmptyBlock
          icon={<X className="h-6 w-6" />}
          title={t("sessions.noResults.title")}
          body={t("sessions.noResults.body")}
        >
          <Button variant="outline" onClick={clearFilters}>
            {t("sessions.noResults.clear")}
          </Button>
        </EmptyBlock>
      );
    }

    return (
      <>
        {sessions.length > 0 &&
          (viewMode === "list" ? (
            renderGroups()
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3 3xl:grid-cols-4">
              {sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  pendingAction={pendingActions[session.id]}
                  selected={selectedIds.has(session.id)}
                  onToggleSelect={toggleSelect}
                  onDeleteRequest={setCardPendingDeletion}
                  onOpenDetails={(s) => setSelectedId(s.id)}
                  {...handlers}
                />
              ))}
            </div>
          ))}

        {(foldedDoneCount > 0 || (showDone && groupCounts.done > 0 && !searchQuery)) && (
          <button
            type="button"
            aria-expanded={showDone}
            onClick={() => setShowDone(!showDone)}
            className="mt-5 flex min-h-11 w-full items-center gap-2 rounded-xl border border-dashed border-gray-300 px-3 text-left text-sm text-gray-600 hover:border-gray-400 hover:text-gray-900 dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-100"
          >
            {showDone ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {showDone
              ? t("sessions.done.hide")
              : t("sessions.done.show", { count: foldedDoneCount })}
          </button>
        )}

        {pageCount > 1 || perPage !== 24 ? (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <Pagination page={page} pageCount={pageCount} onChange={setPage} />
            <PerPageSelect value={perPage} onChange={setPerPage} />
          </div>
        ) : null}
      </>
    );
  };

  return (
    <div className="flex min-h-dvh flex-col">
      {header}
      <div className="flex min-h-0 flex-1 items-start">
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-7" aria-label={t("sessions.title")}>
          {selectedIds.size > 0 && (
            <div className="sticky top-2 z-10 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-300 bg-white px-4 py-2 shadow-sm dark:border-violet-500/40 dark:bg-gray-900">
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                {t("sessionsPage.selectedCount", { count: selectedIds.size })}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  icon={<X className="h-3.5 w-3.5" />}
                >
                  {t("sessionsPage.clearSelection")}
                </Button>
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={() => setShowBulkDeleteConfirm(true)}
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                >
                  {t("sessionsPage.deleteSelected")}
                </Button>
              </div>
            </div>
          )}

          {showTaskOnly && !loading && !error && (
            <section aria-labelledby="task-only" className="mb-5">
              <h2
                id="task-only"
                className="px-1 pb-2 text-sm font-semibold text-gray-900 dark:text-gray-100"
              >
                {t("sessions.taskOnly.title")}
              </h2>
              <ul className="overflow-hidden rounded-xl border border-red-200 bg-white dark:border-red-500/30 dark:bg-gray-900">
                {taskOnlyProblems.map(([key, reason]) => (
                  <li
                    key={key}
                    className="flex flex-wrap items-center gap-3 border-t border-gray-100 px-4 py-2.5 first:border-t-0 dark:border-gray-800"
                  >
                    <AlertTriangle
                      className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400"
                      aria-hidden="true"
                    />
                    <span className="font-mono text-sm text-violet-700 dark:text-violet-300">
                      {key}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-red-700 dark:text-red-400">
                      {attentionText(reason, t)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        shell.navigate(reason.kind === "launchError" ? "queue" : "board")
                      }
                    >
                      {reason.kind === "launchError"
                        ? t("sessions.taskOnly.queue")
                        : t("sessions.taskOnly.board")}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {renderContent()}
        </main>

        {selected && (
          <>
            <div
              aria-hidden="true"
              onClick={closePanel}
              className="fixed inset-0 z-30 bg-gray-950/40 xl:hidden"
            />
            <div className="panel-in fixed inset-y-0 right-0 z-40 w-full max-w-lg border-l border-gray-200 shadow-2xl xl:sticky xl:top-0 xl:z-auto xl:h-dvh xl:w-[32rem] xl:max-w-none 2xl:w-[38rem] 3xl:w-[46rem] xl:shrink-0 xl:shadow-none dark:border-gray-800">
              <SessionDetailPanel
                key={selected.id}
                session={selected}
                pendingAction={pendingActions[selected.id]}
                handlers={handlers}
                reason={attentionReason(selected, problems)}
                onClose={closePanel}
                onDelete={deleteSession}
              />
            </div>
          </>
        )}
      </div>

      <DeleteCardDialog
        session={cardPendingDeletion}
        onCancel={() => setCardPendingDeletion(null)}
        onConfirm={confirmCardDelete}
      />

      <ConfirmDialog
        open={showBulkDeleteConfirm}
        title={t("sessionsPage.bulkDeleteConfirm.title")}
        message={t(
          selectedIds.size === 1
            ? "sessionsPage.bulkDeleteConfirm.message.one"
            : "sessionsPage.bulkDeleteConfirm.message.many",
          { count: selectedIds.size },
        )}
        confirmLabel={t("sessionsPage.delete")}
        cancelLabel={t("sessionsPage.cancel")}
        onConfirm={() => {
          setShowBulkDeleteConfirm(false);
          void removeSessions([...selectedIds]);
        }}
        onCancel={() => setShowBulkDeleteConfirm(false)}
      />

      {resumeConflict && (
        <ResumeConflictModal
          target={resumeConflict.target}
          sibling={resumeConflict.sibling}
          isCreatingWorktree={pendingActions[resumeConflict.target.id] === "worktree-create"}
          isSwitching={pendingActions[resumeConflict.target.id] === "continue"}
          onCreateWorktree={(name) => {
            void createWorktree(resumeConflict.target.id, name, resumeConflict.layout);
            clearResumeConflict();
          }}
          onStopAndCheckout={(branch) =>
            stopAndCheckoutResume(
              resumeConflict.target.id,
              resumeConflict.sibling.id,
              branch,
              resumeConflict.layout,
            )
          }
          onCancel={clearResumeConflict}
        />
      )}
    </div>
  );
}

/** The cards view's delete dialog, with the worktree / branch choices. */
function DeleteCardDialog({
  session,
  onCancel,
  onConfirm,
}: {
  session: Session | null;
  onCancel: () => void;
  onConfirm: (options: DeleteOptions) => void;
}) {
  const { t } = useLanguage();
  const [cleanupWorktree, setCleanupWorktree] = useState(true);
  const [cleanupBranch, setCleanupBranch] = useState(false);
  const branch = session?.gitBranch ?? null;
  const offersBranch = Boolean(
    session && !session.isWorktree && branch && !DEFAULT_BRANCHES.has(branch),
  );
  return (
    <ConfirmDialog
      open={session !== null}
      title={t("sessionsPage.deleteConfirm.title")}
      message={t("sessionsPage.deleteConfirm.message")}
      confirmLabel={t("sessionsPage.delete")}
      cancelLabel={t("sessionsPage.cancel")}
      onConfirm={() => {
        onConfirm({
          cleanupWorktree: Boolean(session?.isWorktree) && cleanupWorktree,
          cleanupBranch: offersBranch && cleanupBranch,
          branchName: branch ?? undefined,
        });
        setCleanupWorktree(true);
        setCleanupBranch(false);
      }}
      onCancel={() => {
        onCancel();
        setCleanupWorktree(true);
        setCleanupBranch(false);
      }}
    >
      {session?.isWorktree && (
        <label className="mt-3 flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
          <input
            type="checkbox"
            checked={cleanupWorktree}
            onChange={(event) => setCleanupWorktree(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-violet-600 dark:accent-violet-400"
          />
          {t("sessionsPage.deleteConfirm.cleanupWorktree")}
        </label>
      )}
      {offersBranch && (
        <label className="mt-3 flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
          <input
            type="checkbox"
            checked={cleanupBranch}
            onChange={(event) => setCleanupBranch(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-violet-600 dark:accent-violet-400"
          />
          {t("sessionsPage.deleteConfirm.cleanupBranch", { branch: branch ?? "" })}
        </label>
      )}
    </ConfirmDialog>
  );
}

function EmptyBlock({
  icon,
  title,
  body,
  children,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center dark:border-gray-700 dark:bg-gray-900">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
        {icon}
      </span>
      <p className="mt-4 text-base font-semibold text-gray-900 dark:text-gray-100">{title}</p>
      <p className="mt-1 max-w-md text-sm text-gray-600 dark:text-gray-400">{body}</p>
      {children && <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

/** Placeholder rows while the first scan runs, with its progress once it's worth showing. */
function ListSkeleton({ scanProgress }: { scanProgress: { done: number; total: number } | null }) {
  const { t } = useLanguage();
  const percent =
    scanProgress && scanProgress.total > 0
      ? Math.min(100, Math.round((scanProgress.done / scanProgress.total) * 100))
      : null;
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      {percent !== null && scanProgress ? (
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
            <span>{t("loadingState.scanning.title")}</span>
            <span className="tabular-nums">
              {t("loadingState.scanning.progress", {
                done: scanProgress.done,
                total: scanProgress.total,
              })}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t("loadingState.scanning.title")}
            className="h-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
          >
            <div className="h-full bg-violet-500 transition-all" style={{ width: `${percent}%` }} />
          </div>
        </div>
      ) : (
        <p className="sr-only" role="status">
          {t("loadingState.message")}
        </p>
      )}
      <ul
        aria-hidden="true"
        className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
      >
        {[0, 1, 2, 3, 4].map((index) => (
          <li
            key={index}
            className="flex items-center gap-4 border-t border-gray-100 px-4 py-4 first:border-t-0 dark:border-gray-800"
          >
            <span className="skeleton h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-700" />
            <span className="flex flex-1 flex-col gap-2">
              <span className="skeleton h-3 w-2/5 rounded bg-gray-200 dark:bg-gray-800" />
              <span className="skeleton h-2.5 w-1/4 rounded bg-gray-200 dark:bg-gray-800" />
            </span>
            <span className="skeleton h-6 w-28 rounded-full bg-gray-200 dark:bg-gray-800" />
            <span className="skeleton h-8 w-20 rounded-md bg-gray-200 dark:bg-gray-800" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function SessionsError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  return (
    <div
      role="alert"
      className="flex items-start gap-4 rounded-xl border border-red-200 bg-red-50 p-5 dark:border-red-500/30 dark:bg-red-950/30"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-red-900 dark:text-red-200">
          {t("sessions.error.title")}
        </p>
        <p className="mt-1 text-sm break-words text-red-800 dark:text-red-300">{message}</p>
        <p className="mt-1 text-sm text-red-800/80 dark:text-red-300/80">
          {t("sessions.error.hint")}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={onRetry} icon={<RefreshCw className="h-4 w-4" />}>
            {t("errorState.retry")}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              void navigator.clipboard
                ?.writeText(message)
                .then(() => setCopied(true))
                .catch(() => undefined);
            }}
            icon={<Copy className="h-4 w-4" />}
          >
            {copied ? t("sessions.error.copied") : t("sessions.error.copy")}
          </Button>
        </div>
      </div>
    </div>
  );
}
