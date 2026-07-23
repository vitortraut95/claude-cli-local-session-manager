import { useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { Header } from "../components/Header";
import { LoadingState } from "../components/LoadingState";
import { ProjectFilter } from "../components/ProjectFilter";
import { SearchBar } from "../components/SearchBar";
import { SessionCard } from "../components/SessionCard";
import { useSessions } from "../hooks/useSessions";
import type { Session } from "../types/session";

export function SessionsPage() {
  const {
    sessions,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    projects,
    projectFilter,
    setProjectFilter,
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
    if (sessions.length === 0) return <EmptyState hasSearchQuery={hasActiveFilter} />;

    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              onRefresh={refresh}
              isRefreshing={loading}
            />
          </div>
          <ProjectFilter projects={projects} value={projectFilter} onChange={setProjectFilter} />
        </div>
        {renderContent()}
      </main>

      <ConfirmDialog
        open={sessionPendingDeletion !== null}
        title="Excluir sessão"
        message="Deseja realmente excluir esta sessão?"
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        onConfirm={handleConfirmDelete}
        onCancel={() => setSessionPendingDeletion(null)}
      />
    </div>
  );
}
