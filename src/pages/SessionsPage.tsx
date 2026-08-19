import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { CompactContinueModal } from "../components/CompactContinueModal";
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
import { SessionSizeGateModal } from "../components/SessionSizeGateModal";
import { useLanguage } from "../hooks/useLanguage";
import { useSessions } from "../hooks/useSessions";
import type { Session } from "../types/session";
import { RefreshCw, Trash2, X } from "lucide-react";

export function SessionsPage() {
  const {
    sessions,
    allSessions,
    filteredCount,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    projects,
    projectFilter,
    setProjectFilter,
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
    refreshSoon,
    removeSession,
    removeSessions,
    resumeSession,
    setNickname,
    openInVSCode,
    openMissingWorktreeRootInVSCode,
    startNewSessionAtMissingWorktreeRoot,
    createWorktree,
    deleteWorktree,
    resumeConflict,
    clearResumeConflict,
    stopAndCheckoutResume,
    sizeGateSession,
    clearSizeGate,
  } = useSessions();
  const { t } = useLanguage();
  const [sessionPendingDeletion, setSessionPendingDeletion] = useState<Session | null>(null);
  // Set from the size-gate modal's "compact instead" option — a separate instance from the one
  // SessionCard opens for its own always-visible button, since this one needs to target whichever
  // session just triggered the gate rather than "whichever card's button was clicked".
  const [compactGateSession, setCompactGateSession] = useState<Session | null>(null);
  // Only meaningful while sessionPendingDeletion.isWorktree is true — reset to the recommended
  // default each time a new deletion is requested (handleDeleteRequest), same as NicknameModal
  // re-initializing on open, so a previous session's unchecked choice can't leak into the next one.
  const [cleanupWorktreeOnDelete, setCleanupWorktreeOnDelete] = useState(true);
  // Only meaningful for non-worktree sessions with a known gitBranch — unlike the worktree
  // checkbox above, this defaults to *off*: deleting a branch is more surprising/harder to notice
  // than deleting a worktree folder, so it should be an explicit opt-in each time.
  const [cleanupBranchOnDelete, setCleanupBranchOnDelete] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Resolves a "Compact & continue" link's *other* side (see Session.continuesFromSessionId/
  // continuedBySessionId) regardless of the current page/filter/search — the linked session might
  // not be in `sessions` (the current page) at all.
  const sessionsById = useMemo(
    () => new Map(allSessions.map((session) => [session.id, session])),
    [allSessions],
  );

  // Set while hovering a card's "continues from"/"continued by" badge — the *other* card (if
  // visible on the current page) renders a highlight ring, see SessionCard's `isHighlighted`.
  const [highlightedSessionId, setHighlightedSessionId] = useState<string | null>(null);

  // Backs a continuation badge's click: jumps straight to the other session by searching for its
  // id (unique, so this always isolates exactly one card) and clearing whatever project/date
  // filters might otherwise be hiding it — the two sessions aren't guaranteed to share a project
  // filter value if one was moved/renamed, though in practice they almost always do.
  const handleJumpToSession = (id: string) => {
    setSearchQuery(id);
    setProjectFilter("");
    setUpdatedRange("", "");
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
          <p className="text-sm text-stone-600 dark:text-stone-400">
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
          <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-stone-300 bg-white px-4 py-2 shadow-sm dark:border-stone-700 dark:bg-stone-900">
            <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
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
                variant="danger"
                size="sm"
                onClick={() => setShowBulkDeleteConfirm(true)}
                icon={<Trash2 className="h-3.5 w-3.5" />}
              >
                {t("sessionsPage.deleteSelected")}
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
              onToggleSelect={toggleSelect}
              onContinue={(s) => resumeSession(s.id)}
              onDeleteRequest={handleDeleteRequest}
              onSetNickname={(s, nickname) => setNickname(s.id, nickname)}
              onOpenInVSCode={(s) => openInVSCode(s.id)}
              onOpenMissingWorktreeRootInVSCode={(s) => openMissingWorktreeRootInVSCode(s.id)}
              onStartNewSessionAtMissingWorktreeRoot={(s) =>
                startNewSessionAtMissingWorktreeRoot(s)
              }
              onDeleteWorktree={(s) => deleteWorktree(s.id)}
              onWorktreeSyncComplete={() => refresh()}
              onCompactContinueLaunched={() => refreshSoon()}
              linkedFromSession={
                session.continuesFromSessionId
                  ? (sessionsById.get(session.continuesFromSessionId) ?? null)
                  : null
              }
              linkedBySession={
                session.continuedBySessionId
                  ? (sessionsById.get(session.continuedBySessionId) ?? null)
                  : null
              }
              onJumpToSession={handleJumpToSession}
              isHighlighted={highlightedSessionId === session.id}
              onHoverLinkedSession={setHighlightedSessionId}
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
    <div className="min-h-screen bg-marrom-50 dark:bg-stone-950">
      <Header onSessionCreated={refreshSoon} />
      <main className="px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-col gap-3 sm:sticky sm:top-2 sm:z-10 sm:flex-row sm:flex-wrap sm:items-center max-w-375 mx-auto">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
          <ProjectFilter projects={projects} value={projectFilter} onChange={setProjectFilter} />
          <DateRangeFilter from={updatedFrom} to={updatedTo} onChange={setUpdatedRange} />

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
          <label className="mt-3 flex items-start gap-2 text-sm text-stone-600 dark:text-stone-400">
            <input
              type="checkbox"
              checked={cleanupWorktreeOnDelete}
              onChange={(event) => setCleanupWorktreeOnDelete(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-oliva-600 dark:accent-oliva-300"
            />
            {t("sessionsPage.deleteConfirm.cleanupWorktree")}
          </label>
        )}
        {!sessionPendingDeletion?.isWorktree && sessionPendingDeletion?.gitBranch && (
          <label className="mt-3 flex items-start gap-2 text-sm text-stone-600 dark:text-stone-400">
            <input
              type="checkbox"
              checked={cleanupBranchOnDelete}
              onChange={(event) => setCleanupBranchOnDelete(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-oliva-600 dark:accent-oliva-300"
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

      {sizeGateSession && (
        <SessionSizeGateModal
          session={sizeGateSession}
          isContinuing={pendingActions[sizeGateSession.id] === "continue"}
          onContinueAnyway={() => {
            void resumeSession(sizeGateSession.id, { skipSizeGate: true });
            clearSizeGate();
          }}
          onCompactInstead={() => {
            setCompactGateSession(sizeGateSession);
            clearSizeGate();
          }}
          onCancel={clearSizeGate}
        />
      )}

      {compactGateSession && (
        <CompactContinueModal
          session={compactGateSession}
          onClose={() => setCompactGateSession(null)}
          onLaunched={() => refreshSoon()}
        />
      )}
    </div>
  );
}
