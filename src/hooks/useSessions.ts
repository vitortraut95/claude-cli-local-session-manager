import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TerminalLayout } from "../services/preferencesApi";
import * as sessionsApi from "../services/sessionsApi";
import * as tasksApi from "../services/tasksApi";
import type { Session, WorkStatus } from "../types/session";
import { resolveProjectParentSegment } from "../utils/formatPath";
import { useLanguage } from "./useLanguage";
import { useUrlParam } from "./useUrlState";
import { useToast } from "./useToast";
import { resolveApiErrorMessage } from "../utils/apiClient";
import type { TranslationKey } from "../i18n/translations";
import {
  matchesWorkStatusFilter,
  parseWorkStatusFilter,
  type WorkStatusFilter,
} from "../utils/workStatus";

export type PendingAction =
  | "delete"
  | "continue"
  | "nickname"
  | "branches"
  | "status"
  | "vscode"
  | "cursor"
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
  const [statusFilterRaw, setStatusFilterRaw] = useUrlParam("status", "");
  const [pageRaw, setPageRaw] = useUrlParam("page", "1");
  const [perPageRaw, setPerPageRaw] = useUrlParam("per_page", String(DEFAULT_PER_PAGE));
  const [pendingActions, setPendingActions] = useState<Record<string, PendingAction>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { showToast } = useToast();
  const { t } = useLanguage();

  const statusFilter = parseWorkStatusFilter(statusFilterRaw);
  const perPage = parsePerPage(perPageRaw);
  const page = parsePage(pageRaw);

  // Any change to what's being shown resets to page 1.
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

  const setStatusFilter = useCallback(
    (value: WorkStatusFilter) => {
      setStatusFilterRaw(value);
      setPageRaw("1");
    },
    [setStatusFilterRaw, setPageRaw],
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
      setError(resolveApiErrorMessage(err, t, "useSessions.loadError"));
    } finally {
      setLoading(false);
    }
    // `t` omitted so a language switch doesn't re-run the mount-only fetch below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    void loadSessions();
  }, [loadSessions]);

  // After a fire-and-forget terminal launch, `claude` takes a few seconds to write its `.jsonl` /
  // pid file, so `refreshSoon` reloads a few times, staggered (re-calling cancels pending retries).
  // Uses `loadSessions`, not `refresh`, so the list isn't blanked by <LoadingState /> each time.
  const refreshRetryTimeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      refreshRetryTimeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  const refreshSoon = useCallback(() => {
    void loadSessions();
    refreshRetryTimeoutsRef.current.forEach(clearTimeout);
    refreshRetryTimeoutsRef.current = [5000, 12000].map((delay) =>
      window.setTimeout(() => void loadSessions(), delay),
    );
  }, [loadSessions]);

  useEffect(() => {
    // Fetch-on-mount: loadSessions only sets state after its internal `await`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSessions();
  }, [loadSessions]);

  /**
   * Scan progress for <LoadingState/>, polled only during the first (mount-time) load, which may
   * hit a cold cache. The first poll is delayed so fast loads never show progress.
   */
  const [scanProgress, setScanProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timeouts: number[] = [];

    const poll = async () => {
      if (cancelled) return;
      try {
        const progress = await sessionsApi.fetchScanProgress();
        if (cancelled) return;
        if (!progress.scanning) return;
        setScanProgress({ done: progress.done, total: progress.total });
        timeouts.push(window.setTimeout(() => void poll(), 300));
      } catch {
        // Best-effort: a failed progress check doesn't affect the real load.
      }
    };

    timeouts.push(window.setTimeout(() => void poll(), 400));

    return () => {
      cancelled = true;
      timeouts.forEach(clearTimeout);
    };
  }, []);

  const projects = useMemo(
    () =>
      [...new Set(sessions.map((session) => session.project))].sort((a, b) => a.localeCompare(b)),
    [sessions],
  );

  // Parent folder per project for the filter dropdown's label only (e.g. "git/my-app"); the
  // filter still matches on `project`.
  const projectLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const session of sessions) {
      if (labels[session.project]) continue;
      const parent = resolveProjectParentSegment(session);
      if (parent) labels[session.project] = `${parent}/${session.project}`;
    }
    return labels;
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = sessions.filter((session) => {
      const matchesQuery =
        !query ||
        [
          session.title,
          session.nickname ?? "",
          session.project,
          session.id,
          session.gitBranch ?? "",
          session.taskKey ?? "",
          ...session.prompts,
        ].some((field) => field.toLowerCase().includes(query));
      const matchesProject = !projectFilter || session.project === projectFilter;
      return (
        matchesQuery && matchesProject && matchesWorkStatusFilter(session.status, statusFilter)
      );
    });

    return [...filtered].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [sessions, searchQuery, projectFilter, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredSessions.length / perPage));
  // Clamp for display without writing back to the URL — a stale `page` param renders the
  // nearest valid page.
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

  // Selection survives page/filter changes, so a bulk delete can span pages.
  const selectAllOnPage = useCallback(() => {
    setSelectedIds((current) => {
      const next = new Set(current);
      // Active sessions can't be selected (their checkboxes are disabled).
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

  /** Marks `id` as busy with `action`, runs `run`, toasts success/failure. True on success. */
  const runAction = useCallback(
    async (
      id: string,
      action: PendingAction,
      run: () => Promise<unknown>,
      successKey: TranslationKey,
      errorKey: TranslationKey,
    ): Promise<boolean> => {
      setPending(id, action);
      try {
        await run();
        showToast(t(successKey), "success");
        return true;
      } catch (err) {
        showToast(resolveApiErrorMessage(err, t, errorKey), "error");
        return false;
      } finally {
        setPending(id, null);
      }
    },
    [setPending, showToast, t],
  );

  /**
   * `cleanupWorktree`/`cleanupBranch` run first, each with its own toast; their failure doesn't
   * stop the session deletion. Mutually exclusive (worktree cleanup already deletes the branch).
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
            showToast(resolveApiErrorMessage(err, t, "useSessions.cleanupWorktreeError"), "error");
          }
        } else if (cleanupBranch && branchName) {
          try {
            await sessionsApi.deleteBranch(id, branchName);
            showToast(t("useSessions.branchDeleted", { branch: branchName }), "success");
          } catch (err) {
            showToast(resolveApiErrorMessage(err, t, "useSessions.deleteBranchError"), "error");
          }
        }
        await sessionsApi.deleteSession(id);
        setSessions((current) => current.filter((session) => session.id !== id));
        showToast(t("useSessions.sessionDeleted"), "success");
      } catch (err) {
        showToast(resolveApiErrorMessage(err, t, "useSessions.deleteSessionError"), "error");
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
        // Reloaded, not patched locally: a blank nickname is resolved server-side.
        await loadSessions();
        showToast(
          nickname.trim() ? t("useSessions.nicknameSaved") : t("useSessions.nicknameRemoved"),
          "success",
        );
      } catch (err) {
        showToast(resolveApiErrorMessage(err, t, "useSessions.saveNicknameError"), "error");
      } finally {
        setPending(id, null);
      }
    },
    [showToast, setPending, loadSessions, t],
  );

  const setBranches = useCallback(
    async (id: string, origin: string, destination: string) => {
      await runAction(
        id,
        "branches",
        async () => {
          await sessionsApi.setBranches(id, origin, destination);
          await loadSessions();
        },
        "useSessions.branchesSaved",
        "useSessions.saveBranchesError",
      );
    },
    [runAction, loadSessions],
  );

  /** A task's status is shared, so every card of that task is patched (no full reload). True on
   *  success. */
  const setStatus = useCallback(
    async (session: Session, status: WorkStatus | null): Promise<boolean> => {
      const taskKey = session.taskKey ?? null;
      return runAction(
        session.id,
        "status",
        async () => {
          if (taskKey) await tasksApi.setTaskStatus(taskKey, status);
          else await sessionsApi.setStatus(session.id, status);
          setSessions((current) =>
            current.map((s) =>
              // The change itself is now in the history, so the card's "info" shows right away.
              (taskKey ? s.taskKey === taskKey : s.id === session.id)
                ? { ...s, status, hasHistory: true }
                : s,
            ),
          );
        },
        "workStatus.saved",
        "workStatus.saveError",
      );
    },
    [runAction],
  );

  /** `layout` = where the user picked to resume it, also used by the conflict's way out. */
  const [resumeConflict, setResumeConflict] = useState<{
    target: Session;
    sibling: Session;
    layout?: TerminalLayout;
  } | null>(null);

  const clearResumeConflict = useCallback(() => setResumeConflict(null), []);

  /**
   * Refetches the list before resuming (the loaded one may be stale). If another session is active
   * in the same directory, or this one is already open, sets `resumeConflict` instead of resuming.
   */
  const resumeSession = useCallback(
    async (id: string, layout?: TerminalLayout) => {
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

        // Already running in the Limux grid: just show its pane.
        if (
          target?.isActive &&
          layout !== "tabs" &&
          (await sessionsApi.focusSessionInGrid(id).catch(() => false))
        ) {
          showToast(t("useSessions.shownInGrid"), "success");
          return;
        }

        if (target && sibling) {
          setResumeConflict({ target, sibling, layout });
          return;
        }

        await sessionsApi.continueSession(id, layout);
        // The new terminal may open behind this window (no focus stealing on Wayland).
        showToast(t("useSessions.terminalOpened"), "success");
        // Picks up the "active" status once the resumed process writes its pid file.
        refreshSoon();
      } catch (err) {
        showToast(resolveApiErrorMessage(err, t, "useSessions.resumeError"), "error");
      } finally {
        setPending(id, null);
      }
    },
    [showToast, setPending, t, refreshSoon],
  );

  const stopAndCheckoutResume = useCallback(
    async (targetId: string, siblingId: string, branch: string, layout?: TerminalLayout) => {
      const ok = await runAction(
        targetId,
        "continue",
        () => sessionsApi.stopAndCheckoutResume(targetId, siblingId, branch, layout),
        "useSessions.stoppedAndResumed",
        "useSessions.switchSessionsError",
      );
      if (!ok) return;
      setResumeConflict(null);
      // Both the resumed and the stopped session's status are about to change.
      refreshSoon();
    },
    [runAction, refreshSoon],
  );

  const openInVSCode = useCallback(
    async (id: string) => {
      await runAction(
        id,
        "vscode",
        () => sessionsApi.openInVSCode(id),
        "useSessions.openingVSCode",
        "useSessions.openVSCodeError",
      );
    },
    [runAction],
  );

  const openInCursor = useCallback(
    async (id: string) => {
      await runAction(
        id,
        "cursor",
        () => sessionsApi.openInCursor(id),
        "useSessions.openingCursor",
        "useSessions.openCursorError",
      );
    },
    [runAction],
  );

  const openMissingWorktreeRootInVSCode = useCallback(
    async (id: string) => {
      await runAction(
        id,
        "vscode",
        () => sessionsApi.openMissingWorktreeRootInVSCode(id),
        "useSessions.openingRootVSCode",
        "useSessions.openVSCodeError",
      );
    },
    [runAction],
  );

  /**
   * "New session in this folder" for an orphaned worktree session: a new conversation (a
   * transcript can't be resumed outside its original, now missing, directory), seeded with the
   * old session's recap.
   */
  const startNewSessionAtMissingWorktreeRoot = useCallback(
    async (session: Session, layout?: TerminalLayout) => {
      await runAction(
        session.id,
        "missing-root-resume",
        () => sessionsApi.startFreshSessionAtMissingWorktreeRoot(session.id, layout),
        "useSessions.newTerminalAtRoot",
        "useSessions.startSessionError",
      );
    },
    [runAction],
  );

  const createWorktree = useCallback(
    async (id: string, name: string, layout?: TerminalLayout) => {
      await runAction(
        id,
        "worktree-create",
        () => sessionsApi.createWorktree(id, name, layout),
        "useSessions.worktreeCreated",
        "useSessions.createWorktreeError",
      );
    },
    [runAction],
  );

  const deleteWorktree = useCallback(
    async (id: string) => {
      await runAction(
        id,
        "worktree-delete",
        () => sessionsApi.deleteWorktree(id),
        "useSessions.worktreeDeleted",
        "useSessions.deleteWorktreeError",
      );
    },
    [runAction],
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
  };
}
