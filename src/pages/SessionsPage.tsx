import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { Header } from "../components/Header";
import { LoadingState } from "../components/LoadingState";
import { Pagination } from "../components/Pagination";
import { PerPageSelect } from "../components/PerPageSelect";
import { ProjectFilter } from "../components/ProjectFilter";
import { WorkStatusFilter } from "../components/WorkStatusFilter";
import { ResumeConflictModal } from "../components/ResumeConflictModal";
import { SearchBar } from "../components/SearchBar";
import { SessionCard } from "../components/SessionCard";
import { useLanguage } from "../hooks/useLanguage";
import { useSessions } from "../hooks/useSessions";
import type { Session } from "../types/session";
import { DEFAULT_BRANCHES } from "../utils/branches";
import { RefreshCw, Trash2, X } from "lucide-react";

export function SessionsPage() {
  const {
    sessions,
    filteredCount,
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
    selectAllOnPage,
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
  } = useSessions();
  const { t } = useLanguage();
  const [sessionPendingDeletion, setSessionPendingDeletion] = useState<Session | null>(null);
  // Worktree sessions only; reset to on by each handleDeleteRequest.
  const [cleanupWorktreeOnDelete, setCleanupWorktreeOnDelete] = useState(true);
  // Non-worktree sessions with a known gitBranch only; reset to off (explicit opt-in) each time.
  const [cleanupBranchOnDelete, setCleanupBranchOnDelete] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Isolates one card by searching for its (unique) id and clearing the other filters.
  const handleJumpToSession = (id: string) => {
    setSearchQuery(id);
    setProjectFilter("");
    setStatusFilter("");
  };

  // A task's sessions span several projects, so the project filter would hide the other repos'.
  // Goes through the search box (which also matches `taskKey`) so it's cleared like any search.
  const handleFilterByTask = (taskKey: string) => {
    setSearchQuery(taskKey);
    setProjectFilter("");
    setStatusFilter("");
  };

  const handleDeleteRequest = (session: Session) => {
    setSessionPendingDeletion(session);
    setCleanupWorktreeOnDelete(true);
    setCleanupBranchOnDelete(false);
  };

  const handleConfirmDelete = async () => {
    if (!sessionPendingDeletion) return;
    const id = sessionPendingDeletion.id;
    const cleanupWorktree = sessionPendingDeletion.isWorktree && cleanupWorktreeOnDelete;
    const cleanupBranch =
      !sessionPendingDeletion.isWorktree &&
      cleanupBranchOnDelete &&
      !DEFAULT_BRANCHES.has(sessionPendingDeletion.gitBranch ?? "");
    const branchName = sessionPendingDeletion.gitBranch ?? undefined;
    setSessionPendingDeletion(null);
    await removeSession(id, cleanupWorktree, cleanupBranch, branchName);
  };

  const handleConfirmBulkDelete = async () => {
    setShowBulkDeleteConfirm(false);
    await removeSessions([...selectedIds]);
  };

  // Scrolls after the new page renders; from the click handler the smooth scroll would run
  // against the old document height and get clamped.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  const hasActiveFilter = searchQuery.trim().length > 0 || projectFilter.length > 0;

  const renderContent = () => {
    if (loading) return <LoadingState scanProgress={scanProgress} />;
    if (error) return <ErrorState message={error} onRetry={refresh} />;
    if (filteredCount === 0) return <EmptyState hasSearchQuery={hasActiveFilter} />;

    const rangeStart = (page - 1) * perPage + 1;
    const rangeEnd = Math.min(page * perPage, filteredCount);

    return (
      <>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t("sessionsPage.showingRange", {
              start: rangeStart,
              end: rangeEnd,
              total: filteredCount,
            })}
          </p>
          <Button variant="link" size="none" onClick={selectAllOnPage}>
            {t("sessionsPage.selectAllOnPage")}
          </Button>
        </div>

        {selectedIds.size > 0 && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 min-[2300px]:grid-cols-4!">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              pendingAction={pendingActions[session.id]}
              selected={selectedIds.has(session.id)}
              onToggleSelect={toggleSelect}
              onContinue={(s) => resumeSession(s.id)}
              onDeleteRequest={handleDeleteRequest}
              onSetNickname={(s, nickname) => setNickname(s.id, nickname)}
              onSetBranches={(s, origin, destination) => setBranches(s.id, origin, destination)}
              onSetStatus={setStatus}
              onOpenInVSCode={(s) => openInVSCode(s.id)}
              onOpenInCursor={(s) => openInCursor(s.id)}
              onOpenMissingWorktreeRootInVSCode={(s) => openMissingWorktreeRootInVSCode(s.id)}
              onStartNewSessionAtMissingWorktreeRoot={(s) =>
                startNewSessionAtMissingWorktreeRoot(s)
              }
              onDeleteWorktree={(s) => deleteWorktree(s.id)}
              onWorktreeSyncComplete={() => refresh()}
              onFilterByTask={handleFilterByTask}
              onTaskChanged={refreshSoon}
            />
          ))}
        </div>
        <div className="flex align-center justify-center gap-4 mt-6">
          <Pagination page={page} pageCount={pageCount} onChange={setPage} />
          <PerPageSelect value={perPage} onChange={setPerPage} />
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Header
        onSessionCreated={refreshSoon}
        onSessionsChanged={refreshSoon}
        onSessionImported={(id) => {
          refresh();
          handleJumpToSession(id);
        }}
      />
      <main className="px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-col gap-3 sm:sticky sm:top-2 sm:z-10 sm:flex-row sm:flex-wrap sm:items-center max-w-375 mx-auto">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
          <ProjectFilter
            projects={projects}
            projectLabels={projectLabels}
            value={projectFilter}
            onChange={setProjectFilter}
          />
          <WorkStatusFilter value={statusFilter} onChange={setStatusFilter} />

          <Button
            variant="outline"
            onClick={refresh}
            disabled={loading}
            className="shadow-sm"
            icon={<RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />}
          >
            {t("sessionsPage.refresh")}
          </Button>
        </div>
        {renderContent()}
      </main>

      <ConfirmDialog
        open={sessionPendingDeletion !== null}
        title={t("sessionsPage.deleteConfirm.title")}
        message={t("sessionsPage.deleteConfirm.message")}
        confirmLabel={t("sessionsPage.delete")}
        cancelLabel={t("sessionsPage.cancel")}
        onConfirm={handleConfirmDelete}
        onCancel={() => setSessionPendingDeletion(null)}
      >
        {sessionPendingDeletion?.isWorktree && (
          <label className="mt-3 flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={cleanupWorktreeOnDelete}
              onChange={(event) => setCleanupWorktreeOnDelete(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-gray-900 dark:accent-gray-100"
            />
            {t("sessionsPage.deleteConfirm.cleanupWorktree")}
          </label>
        )}
        {!sessionPendingDeletion?.isWorktree &&
          sessionPendingDeletion?.gitBranch &&
          !DEFAULT_BRANCHES.has(sessionPendingDeletion.gitBranch) && (
            <label className="mt-3 flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={cleanupBranchOnDelete}
                onChange={(event) => setCleanupBranchOnDelete(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-gray-900 dark:accent-gray-100"
              />
              {t("sessionsPage.deleteConfirm.cleanupBranch", {
                branch: sessionPendingDeletion.gitBranch,
              })}
            </label>
          )}
      </ConfirmDialog>

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
        onConfirm={handleConfirmBulkDelete}
        onCancel={() => setShowBulkDeleteConfirm(false)}
      />

      {resumeConflict && (
        <ResumeConflictModal
          target={resumeConflict.target}
          sibling={resumeConflict.sibling}
          isCreatingWorktree={pendingActions[resumeConflict.target.id] === "worktree-create"}
          isSwitching={pendingActions[resumeConflict.target.id] === "continue"}
          onCreateWorktree={(name) => {
            void createWorktree(resumeConflict.target.id, name);
            clearResumeConflict();
          }}
          onStopAndCheckout={(branch) =>
            stopAndCheckoutResume(resumeConflict.target.id, resumeConflict.sibling.id, branch)
          }
          onCancel={clearResumeConflict}
        />
      )}
    </div>
  );
}
