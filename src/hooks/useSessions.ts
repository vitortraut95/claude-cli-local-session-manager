import { useCallback, useEffect, useMemo, useState } from "react";
import * as sessionsApi from "../services/sessionsApi";
import type { Session } from "../types/session";
import { useUrlParam } from "./useUrlState";
import { useToast } from "./useToast";

export type PendingAction = "delete" | "continue";

export const PER_PAGE_OPTIONS = [24, 48, 96, 192, 999999] as const;
const DEFAULT_PER_PAGE = 24;

function parsePerPage(raw: string): number {
  const parsed = Number(raw);
  return (PER_PAGE_OPTIONS as readonly number[]).includes(parsed) ? parsed : DEFAULT_PER_PAGE;
}

function parsePage(raw: string): number {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQueryRaw] = useUrlParam("q", "");
  const [projectFilter, setProjectFilterRaw] = useUrlParam("project", "");
  const [updatedFrom, setUpdatedFromRaw] = useUrlParam("updated_from", "");
  const [updatedTo, setUpdatedToRaw] = useUrlParam("updated_to", "");
  const [pageRaw, setPageRaw] = useUrlParam("page", "1");
  const [perPageRaw, setPerPageRaw] = useUrlParam("per_page", String(DEFAULT_PER_PAGE));
  const [pendingActions, setPendingActions] = useState<Record<string, PendingAction>>({});
  const { showToast } = useToast();

  const perPage = parsePerPage(perPageRaw);
  const page = parsePage(pageRaw);

  // Any change to what's being shown resets to page 1, so the user never lands
  // on a page that no longer has anything on it.
  const setSearchQuery = useCallback(
    (value: string) => {
      setSearchQueryRaw(value);
      setPageRaw("1");
    },
    [setSearchQueryRaw, setPageRaw],
  );

  const setProjectFilter = useCallback(
    (value: string) => {
      setProjectFilterRaw(value);
      setPageRaw("1");
    },
    [setProjectFilterRaw, setPageRaw],
  );

  const setUpdatedRange = useCallback(
    (from: string, to: string) => {
      setUpdatedFromRaw(from);
      setUpdatedToRaw(to);
      setPageRaw("1");
    },
    [setUpdatedFromRaw, setUpdatedToRaw, setPageRaw],
  );

  const setPerPage = useCallback(
    (value: number) => {
      setPerPageRaw(String(value));
      setPageRaw("1");
    },
    [setPerPageRaw, setPageRaw],
  );

  const setPage = useCallback(
    (value: number) => {
      setPageRaw(String(value));
    },
    [setPageRaw],
  );

  const loadSessions = useCallback(async () => {
    try {
      const data = await sessionsApi.fetchSessions();
      setSessions(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load sessions.");
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
    () =>
      [...new Set(sessions.map((session) => session.project))].sort((a, b) => a.localeCompare(b)),
    [sessions],
  );

  const filteredSessions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    // Bounds are compared as local-midnight Date instances since `updatedFrom`/
    // `updatedTo` come from <input type="date"> (YYYY-MM-DD, no time component),
    // while `updatedAt` is a full ISO timestamp.
    const fromTime = updatedFrom ? new Date(`${updatedFrom}T00:00:00`).getTime() : null;
    const toTime = updatedTo ? new Date(`${updatedTo}T23:59:59.999`).getTime() : null;
    const filtered = sessions.filter((session) => {
      const matchesQuery =
        !query ||
        [session.title, session.project, session.id].some((field) =>
          field.toLowerCase().includes(query),
        );
      const matchesProject = !projectFilter || session.project === projectFilter;
      const updatedAtTime = new Date(session.updatedAt).getTime();
      const matchesUpdatedAt =
        (fromTime === null || updatedAtTime >= fromTime) &&
        (toTime === null || updatedAtTime <= toTime);
      return matchesQuery && matchesProject && matchesUpdatedAt;
    });

    return [...filtered].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [sessions, searchQuery, projectFilter, updatedFrom, updatedTo]);

  const pageCount = Math.max(1, Math.ceil(filteredSessions.length / perPage));
  // Clamp for display without writing back to the URL — a stale `page` param
  // (filters changed, sessions got deleted) just renders the nearest valid page.
  const currentPage = Math.min(page, pageCount);

  const paginatedSessions = useMemo(
    () => filteredSessions.slice((currentPage - 1) * perPage, currentPage * perPage),
    [filteredSessions, currentPage, perPage],
  );

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
        showToast("Session deleted successfully.", "success");
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Could not delete the session.", "error");
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
        showToast("Opening session...", "success");
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Could not resume the session.", "error");
      } finally {
        setPending(id, null);
      }
    },
    [showToast, setPending],
  );

  return {
    sessions: paginatedSessions,
    totalCount: sessions.length,
    filteredCount: filteredSessions.length,
    page: currentPage,
    pageCount,
    perPage,
    setPage,
    setPerPage,
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
    pendingActions,
    refresh,
    removeSession,
    resumeSession,
  };
}
