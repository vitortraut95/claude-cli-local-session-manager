import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DateRangeFilter } from "../components/DateRangeFilter";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { Header } from "../components/Header";
import { LoadingState } from "../components/LoadingState";
import { Pagination } from "../components/Pagination";
import { PerPageSelect } from "../components/PerPageSelect";
import { ProjectFilter } from "../components/ProjectFilter";
import { ResumeConflictModal } from "../components/ResumeConflictModal";
import { SearchBar } from "../components/SearchBar";
import { SessionCard } from "../components/SessionCard";
import { WorktreeFilter } from "../components/WorktreeFilter";
import { useSessions } from "../hooks/useSessions";
import type { Session } from "../types/session";
import { RefreshCw, Trash2, X } from "lucide-react";

export function SessionsPage() {
  const {
    sessions,
    filteredCount,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    projects,
    projectFilter,
    setProjectFilter,
    worktreeOnly,
    setWorktreeOnly,
    updatedFrom,
    updatedTo,
    setUpdatedRange,
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
    removeSession,
    removeSessions,
    resumeSession,
    setNickname,
    openInVSCode,
    hasSiblingActiveSession,
    createWorktree,
    deleteWorktree,
    resumeConflict,
    clearResumeConflict,
    stopAndCheckoutResume,
  } = useSessions();
  const [sessionPendingDeletion, setSessionPendingDeletion] = useState<Session | null>(null);
  // Only meaningful while sessionPendingDeletion.isWorktree is true — reset to the recommended
  // default each time a new deletion is requested (handleDeleteRequest), same as CreateWorktreeModal
  // re-initializing on open, so a previous session's unchecked choice can't leak into the next one.
  const [cleanupWorktreeOnDelete, setCleanupWorktreeOnDelete] = useState(true);
  // Only meaningful for non-worktree sessions with a known gitBranch — unlike the worktree
  // checkbox above, this defaults to *off*: deleting a branch is more surprising/harder to notice
  // than deleting a worktree folder, so it should be an explicit opt-in each time.
  const [cleanupBranchOnDelete, setCleanupBranchOnDelete] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const handleDeleteRequest = (session: Session) => {
    setSessionPendingDeletion(session);
    setCleanupWorktreeOnDelete(true);
    setCleanupBranchOnDelete(false);
  };

  const handleConfirmDelete = async () => {
    if (!sessionPendingDeletion) return;
    const id = sessionPendingDeletion.id;
    const cleanupWorktree = sessionPendingDeletion.isWorktree && cleanupWorktreeOnDelete;
    const cleanupBranch = !sessionPendingDeletion.isWorktree && cleanupBranchOnDelete;
    const branchName = sessionPendingDeletion.gitBranch ?? undefined;
    setSessionPendingDeletion(null);
    await removeSession(id, cleanupWorktree, cleanupBranch, branchName);
  };

  const handleConfirmBulkDelete = async () => {
    setShowBulkDeleteConfirm(false);
    await removeSessions([...selectedIds]);
  };

  // Scrolling here (rather than in the pagination click handler) waits for the new
  // page's shorter/taller content to actually render — otherwise the smooth scroll
  // animates against the old document height and gets clamped mid-flight.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  const hasActiveFilter =
    searchQuery.trim().length > 0 ||
    projectFilter.length > 0 ||
    worktreeOnly ||
    updatedFrom.length > 0 ||
    updatedTo.length > 0;

  const renderContent = () => {
    if (loading) return <LoadingState />;
    if (error) return <ErrorState message={error} onRetry={refresh} />;
    if (filteredCount === 0) return <EmptyState hasSearchQuery={hasActiveFilter} />;

    const rangeStart = (page - 1) * perPage + 1;
    const rangeEnd = Math.min(page * perPage, filteredCount);

    return (
      <>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {rangeStart}–{rangeEnd} of {filteredCount}
          </p>
          <Button variant="link" size="none" onClick={selectAllOnPage}>
            Select all on this page
          </Button>
        </div>

        {selectedIds.size > 0 && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {selectedIds.size} selected
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                icon={<X className="h-3.5 w-3.5" />}
              >
                Clear
              </Button>
              <Button
                variant="outline-danger"
                size="sm"
                onClick={() => setShowBulkDeleteConfirm(true)}
                icon={<Trash2 className="h-3.5 w-3.5" />}
              >
                Delete selected
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              pendingAction={pendingActions[session.id]}
              selected={selectedIds.has(session.id)}
              hasSiblingActiveSession={hasSiblingActiveSession(session)}
              onToggleSelect={toggleSelect}
              onContinue={(s) => resumeSession(s.id)}
              onDeleteRequest={handleDeleteRequest}
              onSetNickname={(s, nickname) => setNickname(s.id, nickname)}
              onOpenInVSCode={(s) => openInVSCode(s.id)}
              onCreateWorktree={(s, name) => createWorktree(s.id, name)}
              onDeleteWorktree={(s) => deleteWorktree(s.id)}
              onWorktreeSyncComplete={() => refresh()}
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
      <Header />
      <main className="px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-col gap-3 sm:sticky sm:top-2 sm:z-10 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
          <WorktreeFilter value={worktreeOnly} onChange={setWorktreeOnly} />
          <ProjectFilter projects={projects} value={projectFilter} onChange={setProjectFilter} />
          <DateRangeFilter from={updatedFrom} to={updatedTo} onChange={setUpdatedRange} />

          <Button
            variant="outline"
            onClick={refresh}
            disabled={loading}
            className="shadow-sm"
            icon={<RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />}
          >
            Refresh sessions
          </Button>
        </div>
        {renderContent()}
      </main>

      <ConfirmDialog
        open={sessionPendingDeletion !== null}
        title="Delete session"
        message="Are you sure you want to delete this session?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
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
            Also clean up the worktree — removes its folder and the branch git created for it.
          </label>
        )}
        {!sessionPendingDeletion?.isWorktree && sessionPendingDeletion?.gitBranch && (
          <label className="mt-3 flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={cleanupBranchOnDelete}
              onChange={(event) => setCleanupBranchOnDelete(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-gray-900 dark:accent-gray-100"
            />
            Also delete the local branch "{sessionPendingDeletion.gitBranch}".
          </label>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={showBulkDeleteConfirm}
        title="Delete selected sessions"
        message={`Are you sure you want to delete ${selectedIds.size} session${
          selectedIds.size === 1 ? "" : "s"
        }? This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
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
