import { useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { Header } from "../components/Header";
import { LoadingState } from "../components/LoadingState";
import { Pagination } from "../components/Pagination";
import { PerPageSelect } from "../components/PerPageSelect";
import { ProjectFilter } from "../components/ProjectFilter";
import { SearchBar } from "../components/SearchBar";
import { SessionCard } from "../components/SessionCard";
import { useSessions } from "../hooks/useSessions";
import type { Session } from "../types/session";
import { RefreshCw } from "lucide-react";

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
    page,
    pageCount,
    perPage,
    setPage,
    setPerPage,
    pendingActions,
    refresh,
    removeSession,
    resumeSession,
  } = useSessions();
  const [sessionPendingDeletion, setSessionPendingDeletion] = useState<Session | null>(null);

  const handleConfirmDelete = async () => {
    if (!sessionPendingDeletion) return;
    const id = sessionPendingDeletion.id;
    setSessionPendingDeletion(null);
    await removeSession(id);
  };

  const hasActiveFilter = searchQuery.trim().length > 0 || projectFilter.length > 0;

  const renderContent = () => {
    if (loading) return <LoadingState />;
    if (error) return <ErrorState message={error} onRetry={refresh} />;
    if (filteredCount === 0) return <EmptyState hasSearchQuery={hasActiveFilter} />;

    const rangeStart = (page - 1) * perPage + 1;
    const rangeEnd = Math.min(page * perPage);

    return (
      <>
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
          Showing {rangeStart}–{rangeEnd} of {filteredCount}
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              pendingAction={pendingActions[session.id]}
              onContinue={(s) => resumeSession(s.id)}
              onDeleteRequest={setSessionPendingDeletion}
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
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
          </div>
          <ProjectFilter projects={projects} value={projectFilter} onChange={setProjectFilter} />

          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh sessions
          </button>
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
      />
    </div>
  );
}
