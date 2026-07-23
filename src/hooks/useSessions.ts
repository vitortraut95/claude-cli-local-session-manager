import { useCallback, useEffect, useMemo, useState } from "react";
import * as sessionsApi from "../services/sessionsApi";
import type { Session } from "../types/session";
import { useToast } from "./useToast";

export type PendingAction = "delete" | "continue";

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [pendingActions, setPendingActions] = useState<Record<string, PendingAction>>({});
  const { showToast } = useToast();

  const loadSessions = useCallback(async () => {
    try {
      const data = await sessionsApi.fetchSessions();
      setSessions(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar as sessões.");
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    // loadSessions only touches state after its internal `await`, but the rule's
    // static analysis can't see that far — this is the standard fetch-on-mount pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSessions();
  }, [loadSessions]);

  const projects = useMemo(
    () => [...new Set(sessions.map((session) => session.project))].sort((a, b) => a.localeCompare(b)),
    [sessions],
  );

  const filteredSessions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = sessions.filter((session) => {
      const matchesQuery =
        !query ||
        [session.title, session.project, session.id].some((field) =>
          field.toLowerCase().includes(query),
        );
      const matchesProject = !projectFilter || session.project === projectFilter;
      return matchesQuery && matchesProject;
    });

    return [...filtered].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [sessions, searchQuery, projectFilter]);

  const setPending = useCallback((id: string, action: PendingAction | null) => {
    setPendingActions((current) => {
      if (action === null) {
        const next = { ...current };
        delete next[id];
        return next;
      }
      return { ...current, [id]: action };
    });
  }, []);

  const removeSession = useCallback(
    async (id: string) => {
      setPending(id, "delete");
      try {
        await sessionsApi.deleteSession(id);
        setSessions((current) => current.filter((session) => session.id !== id));
        showToast("Sessão excluída com sucesso.", "success");
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Não foi possível excluir a sessão.", "error");
      } finally {
        setPending(id, null);
      }
    },
    [showToast, setPending],
  );

  const resumeSession = useCallback(
    async (id: string) => {
      setPending(id, "continue");
      try {
        await sessionsApi.continueSession(id);
        showToast("Abrindo sessão...", "success");
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Não foi possível continuar a sessão.",
          "error",
        );
      } finally {
        setPending(id, null);
      }
    },
    [showToast, setPending],
  );

  return {
    sessions: filteredSessions,
    totalCount: sessions.length,
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
  };
}
