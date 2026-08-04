import { useCallback, useEffect, useMemo, useState } from "react";
import * as sessionsApi from "../services/sessionsApi";
import type { Session } from "../types/session";
import { useLanguage } from "./useLanguage";
import { useUrlParam } from "./useUrlState";
import { useToast } from "./useToast";

export type PendingAction =
  | "delete"
  | "continue"
  | "nickname"
  | "vscode"
  | "worktree-create"
  | "worktree-delete"
  | "missing-root-resume";

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
  const [worktreeOnlyRaw, setWorktreeOnlyRaw] = useUrlParam("worktree_only", "");
  const [pageRaw, setPageRaw] = useUrlParam("page", "1");
  const [perPageRaw, setPerPageRaw] = useUrlParam("per_page", String(DEFAULT_PER_PAGE));
  const [pendingActions, setPendingActions] = useState<Record<string, PendingAction>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { showToast } = useToast();
  const { t } = useLanguage();

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

  const worktreeOnly = worktreeOnlyRaw === "1";

  const setWorktreeOnly = useCallback(
    (value: boolean) => {
      setWorktreeOnlyRaw(value ? "1" : "");
      setPageRaw("1");
    },
    [setWorktreeOnlyRaw, setPageRaw],
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
      setError(err instanceof Error ? err.message : t("useSessions.loadError"));
    } finally {
      setLoading(false);
    }
    // `t` is intentionally omitted: useLanguage() returns a new `t` function identity on every
    // render, and this callback feeds the mount-only useEffect below — depending on `t` here
    // would re-fire that effect (and refetch sessions) on every render instead of just once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        [
          session.title,
          session.nickname ?? "",
          session.project,
          session.id,
          session.gitBranch ?? "",
          ...session.prompts,
        ].some((field) => field.toLowerCase().includes(query));
      const matchesProject = !projectFilter || session.project === projectFilter;
      const matchesWorktreeOnly = !worktreeOnly || session.isWorktree;
      const updatedAtTime = new Date(session.updatedAt).getTime();
      const matchesUpdatedAt =
        (fromTime === null || updatedAtTime >= fromTime) &&
        (toTime === null || updatedAtTime <= toTime);
      return matchesQuery && matchesProject && matchesWorktreeOnly && matchesUpdatedAt;
    });

    return [...filtered].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [sessions, searchQuery, projectFilter, worktreeOnly, updatedFrom, updatedTo]);

  const pageCount = Math.max(1, Math.ceil(filteredSessions.length / perPage));
  // Clamp for display without writing back to the URL — a stale `page` param
  // (filters changed, sessions got deleted) just renders the nearest valid page.
  const currentPage = Math.min(page, pageCount);

  const paginatedSessions = useMemo(
    () => filteredSessions.slice((currentPage - 1) * perPage, currentPage * perPage),
    [filteredSessions, currentPage, perPage],
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // Selection isn't cleared on page/filter changes — a session selected on page 1 stays
  // selected after navigating to page 2, so a bulk delete can span pages.
  const selectAllOnPage = useCallback(() => {
    setSelectedIds((current) => {
      const next = new Set(current);
      // Active sessions' checkboxes are disabled (can't bulk-delete/continue a session that's
      // open in a terminal), so skip them here too rather than selecting something the UI
      // won't let the user act on.
      for (const session of paginatedSessions) {
        if (!session.isActive) next.add(session.id);
      }
      return next;
    });
  }, [paginatedSessions]);

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

  /**
   * `cleanupWorktree`/`cleanupBranch` run before deleting the session, each with its own
   * independent success/error toast — a failure there (e.g. uncommitted changes blocking a
   * worktree removal, or the branch being checked out elsewhere) doesn't stop the session
   * deletion that follows, since none of these are actually coupled server-side. The caller
   * (SessionsPage's delete-confirm checkboxes) offers worktree cleanup for worktree-backed
   * sessions and branch cleanup for everything else — a worktree's own cleanup already deletes
   * its branch, so the two are mutually exclusive, never both true at once.
   */
  const removeSession = useCallback(
    async (id: string, cleanupWorktree = false, cleanupBranch = false, branchName?: string) => {
      setPending(id, "delete");
      try {
        if (cleanupWorktree) {
          try {
            await sessionsApi.deleteWorktree(id);
            showToast(t("useSessions.worktreeDeleted"), "success");
          } catch (err) {
            showToast(
              err instanceof Error ? err.message : t("useSessions.cleanupWorktreeError"),
              "error",
            );
          }
        } else if (cleanupBranch && branchName) {
          try {
            await sessionsApi.deleteBranch(id, branchName);
            showToast(t("useSessions.branchDeleted", { branch: branchName }), "success");
          } catch (err) {
            showToast(
              err instanceof Error ? err.message : t("useSessions.deleteBranchError"),
              "error",
            );
          }
        }
        await sessionsApi.deleteSession(id);
        setSessions((current) => current.filter((session) => session.id !== id));
        showToast(t("useSessions.sessionDeleted"), "success");
      } catch (err) {
        showToast(err instanceof Error ? err.message : t("useSessions.deleteSessionError"), "error");
      } finally {
        setPending(id, null);
      }
    },
    [showToast, setPending, t],
  );

  const removeSessions = useCallback(
    async (ids: string[]) => {
      ids.forEach((id) => setPending(id, "delete"));

      const results = await Promise.allSettled(ids.map((id) => sessionsApi.deleteSession(id)));
      const succeededIds = new Set(
        ids.filter((_, index) => results[index]?.status === "fulfilled"),
      );
      const failedCount = ids.length - succeededIds.size;

      setSessions((current) => current.filter((session) => !succeededIds.has(session.id)));
      setSelectedIds((current) => {
        const next = new Set(current);
        succeededIds.forEach((id) => next.delete(id));
        return next;
      });
      ids.forEach((id) => setPending(id, null));

      if (failedCount === 0) {
        showToast(
          succeededIds.size === 1
            ? t("useSessions.deleted.one")
            : t("useSessions.deleted.many", { count: succeededIds.size }),
          "success",
        );
      } else if (succeededIds.size === 0) {
        showToast(
          failedCount === 1
            ? t("useSessions.deleteFailed.one")
            : t("useSessions.deleteFailed.many", { count: failedCount }),
          "error",
        );
      } else {
        showToast(
          succeededIds.size === 1
            ? t("useSessions.deletedPartial.one", { failedCount })
            : t("useSessions.deletedPartial.many", { count: succeededIds.size, failedCount }),
          "error",
        );
      }
    },
    [showToast, setPending, t],
  );

  const setNickname = useCallback(
    async (id: string, nickname: string) => {
      setPending(id, "nickname");
      try {
        await sessionsApi.setNickname(id, nickname);
        // Reload from the server rather than optimistically patching locally — a blank nickname
        // clears the override server-side, and this keeps that resolution in one place.
        await loadSessions();
        showToast(
          nickname.trim() ? t("useSessions.nicknameSaved") : t("useSessions.nicknameRemoved"),
          "success",
        );
      } catch (err) {
        showToast(err instanceof Error ? err.message : t("useSessions.saveNicknameError"), "error");
      } finally {
        setPending(id, null);
      }
    },
    [showToast, setPending, loadSessions, t],
  );

  const [resumeConflict, setResumeConflict] = useState<{
    target: Session;
    sibling: Session;
  } | null>(null);

  const clearResumeConflict = useCallback(() => setResumeConflict(null), []);

  /**
   * Refetches the session list right before resuming rather than trusting whatever's already
   * in `sessions` state — that list only reloads on mount or an explicit refresh (see
   * useSessions' module doc / CLAUDE.md), so another terminal could have opened a session in the
   * same directory since the last load without this page knowing. If a fresh check finds a
   * conflict — either a different session active in the same directory, or this exact session
   * already open in another terminal — resuming is deferred to `resumeConflict` (rendered by the
   * caller as a modal) instead of either silently double-opening it or refusing outright. The
   * Resume button itself is never disabled for this (see SessionCard's continueDisabledReason) —
   * this check is what makes that safe.
   */
  const resumeSession = useCallback(
    async (id: string) => {
      setPending(id, "continue");
      try {
        const fresh = await sessionsApi.fetchSessions();
        const target = fresh.find((s) => s.id === id);
        const sibling = target?.isActive
          ? target
          : target?.workingDirectory
            ? fresh.find(
                (s) => s.id !== id && s.workingDirectory === target.workingDirectory && s.isActive,
              )
            : undefined;

        if (target && sibling) {
          setResumeConflict({ target, sibling });
          return;
        }

        await sessionsApi.continueSession(id);
        // Linux window managers won't let a background process steal focus, so the new
        // terminal window may open behind this one — this toast is the only reliable signal
        // that it actually opened.
        showToast(t("useSessions.terminalOpened"), "success");
      } catch (err) {
        showToast(err instanceof Error ? err.message : t("useSessions.resumeError"), "error");
      } finally {
        setPending(id, null);
      }
    },
    [showToast, setPending, t],
  );

  const stopAndCheckoutResume = useCallback(
    async (targetId: string, siblingId: string, branch: string) => {
      setPending(targetId, "continue");
      try {
        await sessionsApi.stopAndCheckoutResume(targetId, siblingId, branch);
        showToast(t("useSessions.stoppedAndResumed"), "success");
        setResumeConflict(null);
      } catch (err) {
        showToast(err instanceof Error ? err.message : t("useSessions.switchSessionsError"), "error");
      } finally {
        setPending(targetId, null);
      }
    },
    [showToast, setPending, t],
  );

  const openInVSCode = useCallback(
    async (id: string) => {
      setPending(id, "vscode");
      try {
        await sessionsApi.openInVSCode(id);
        showToast(t("useSessions.openingVSCode"), "success");
      } catch (err) {
        showToast(err instanceof Error ? err.message : t("useSessions.openVSCodeError"), "error");
      } finally {
        setPending(id, null);
      }
    },
    [showToast, setPending, t],
  );

  const openMissingWorktreeRootInVSCode = useCallback(
    async (id: string) => {
      setPending(id, "vscode");
      try {
        await sessionsApi.openMissingWorktreeRootInVSCode(id);
        showToast(t("useSessions.openingRootVSCode"), "success");
      } catch (err) {
        showToast(err instanceof Error ? err.message : t("useSessions.openVSCodeError"), "error");
      } finally {
        setPending(id, null);
      }
    },
    [showToast, setPending, t],
  );

  /**
   * Backs the "Resume at root"/"Start fresh at root" action on an orphaned worktree session's
   * card (see `Session.missingWorktreeRepoRoot`). If another session is already recorded at that
   * root directory (`rootSessionId`), this is a real `claude --resume` of that other session —
   * just defers to the existing `resumeSession` flow (conflict-check and all). Otherwise there's
   * nothing to resume (the CLI ties a transcript to its exact original directory, which is gone),
   * so it starts a brand-new conversation there instead, seeded with the old session's recap.
   */
  const resumeAtMissingWorktreeRoot = useCallback(
    async (session: Session) => {
      if (session.rootSessionId) {
        await resumeSession(session.rootSessionId);
        return;
      }
      setPending(session.id, "missing-root-resume");
      try {
        await sessionsApi.startFreshSessionAtMissingWorktreeRoot(session.id);
        showToast(t("useSessions.newTerminalAtRoot"), "success");
      } catch (err) {
        showToast(err instanceof Error ? err.message : t("useSessions.startSessionError"), "error");
      } finally {
        setPending(session.id, null);
      }
    },
    [resumeSession, showToast, setPending, t],
  );

  // Only remaining caller is ResumeConflictModal's "create a worktree instead" option
  // (SessionsPage.tsx) — SessionCard itself doesn't offer worktree creation directly.
  const createWorktree = useCallback(
    async (id: string, name: string) => {
      setPending(id, "worktree-create");
      try {
        await sessionsApi.createWorktree(id, name);
        showToast(t("useSessions.worktreeCreated"), "success");
      } catch (err) {
        showToast(err instanceof Error ? err.message : t("useSessions.createWorktreeError"), "error");
      } finally {
        setPending(id, null);
      }
    },
    [showToast, setPending, t],
  );

  const deleteWorktree = useCallback(
    async (id: string) => {
      setPending(id, "worktree-delete");
      try {
        await sessionsApi.deleteWorktree(id);
        showToast(t("useSessions.worktreeDeleted"), "success");
      } catch (err) {
        showToast(err instanceof Error ? err.message : t("useSessions.deleteWorktreeError"), "error");
      } finally {
        setPending(id, null);
      }
    },
    [showToast, setPending, t],
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
    worktreeOnly,
    setWorktreeOnly,
    updatedFrom,
    updatedTo,
    setUpdatedRange,
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
    openMissingWorktreeRootInVSCode,
    resumeAtMissingWorktreeRoot,
    createWorktree,
    deleteWorktree,
    resumeConflict,
    clearResumeConflict,
    stopAndCheckoutResume,
  };
}
