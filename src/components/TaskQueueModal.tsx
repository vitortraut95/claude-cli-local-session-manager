import { ListTodo } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useProjectFolders } from "../hooks/useProjectFolders";
import { useToast } from "../hooks/useToast";
import * as preferencesApi from "../services/preferencesApi";
import * as tasksApi from "../services/tasksApi";
import type { QueueEntry, SchedulerStatus } from "../services/tasksApi";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { type DraftEntry, toDraft } from "../utils/taskQueue";
import { Modal } from "./Modal";
import { SchedulerPanel } from "./SchedulerPanel";
import { TaskQueueForm } from "./TaskQueueForm";
import { TaskQueueList } from "./TaskQueueList";

/** While open, the scheduler's progress (launches, errors, room left) is re-read this often. */
const POLL_MS = 10_000;

type TaskQueueModalProps = {
  onClose: () => void;
  /** A queued task got its session — the page's list should pick it up. */
  onSessionCreated?: () => void;
};

/**
 * The header's "Task queue": paste the tasks ready to be worked on, tie each one to its repo(s),
 * and the scheduler launches them one by one (own worktree each) while there's room. Edits stay
 * local until "Save queue"; the scheduler's progress is merged in as it happens.
 */
export function TaskQueueModal({ onClose, onSessionCreated }: TaskQueueModalProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { projects } = useProjectFolders(true);
  const [entries, setEntries] = useState<DraftEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [branchTypes, setBranchTypes] = useState<string[]>([]);
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [runningNow, setRunningNow] = useState(false);
  // Keys whose error the user cleared to retry: a poll mustn't bring the old error back.
  const retriedRef = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    preferencesApi
      .fetchPreferences()
      .then((prefs) => {
        if (cancelled) return;
        setBranchTypes(prefs.branchTypes);
      })
      .catch(() => undefined);
    tasksApi
      .fetchTaskQueue()
      .then((list) => {
        if (!cancelled) setEntries(list.map(toDraft));
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshStatus = useCallback(() => {
    tasksApi
      .fetchSchedulerStatus()
      .then(setStatus)
      .catch(() => undefined);
  }, []);

  // Only the scheduler's fields are taken from the server, so unsaved edits survive the poll.
  const mergeProgress = useCallback(
    (stored: QueueEntry[]) => {
      const byKey = new Map(stored.map((entry) => [entry.key, entry]));
      let launched = false;
      setEntries((current) =>
        current.map((entry) => {
          const server = byKey.get(entry.key);
          if (!server) return entry;
          if (server.launchedAt && !entry.launchedAt) launched = true;
          const keepLocalError = !server.launchedAt && retriedRef.current.has(entry.key);
          return {
            ...entry,
            repos: server.launchedAt ? server.repos : entry.repos,
            noRepo: server.launchedAt ? (server.noRepo ?? false) : entry.noRepo,
            kind: server.launchedAt ? (server.kind ?? "dev") : entry.kind,
            branchPrefix: server.launchedAt ? (server.branchPrefix ?? null) : entry.branchPrefix,
            branch: server.launchedAt ? (server.branch ?? null) : entry.branch,
            baseBranch: server.launchedAt ? (server.baseBranch ?? null) : entry.baseBranch,
            useLocalBaseBranch: server.launchedAt
              ? (server.useLocalBaseBranch ?? false)
              : entry.useLocalBaseBranch,
            launchedAt: server.launchedAt ?? null,
            sessionId: server.sessionId ?? null,
            error: keepLocalError ? entry.error : (server.error ?? null),
          };
        }),
      );
      if (launched) onSessionCreated?.();
    },
    [onSessionCreated],
  );

  useEffect(() => {
    refreshStatus();
    const timer = window.setInterval(() => {
      refreshStatus();
      tasksApi
        .fetchTaskQueue()
        .then(mergeProgress)
        .catch(() => undefined);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [refreshStatus, mergeProgress]);

  const handleRunNow = async () => {
    setRunningNow(true);
    try {
      setStatus(await tasksApi.runSchedulerNow());
      mergeProgress(await tasksApi.fetchTaskQueue());
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "newTaskModal.unexpectedFailure"), "error");
    } finally {
      setRunningNow(false);
    }
  };

  // "Start now" sends the queue as it is on screen first (the server launches the saved entry).
  const [startingNow, setStartingNow] = useState<Set<string>>(new Set());
  const isLaunching = (key: string) =>
    startingNow.has(key) ||
    status?.launching === key ||
    (status?.launchingKeys?.includes(key) ?? false);

  const persist = async () => {
    const stored = await tasksApi.saveTaskQueue(
      entries.map(
        ({
          key,
          link,
          kind,
          repos,
          noRepo,
          branchPrefix,
          branch,
          baseBranch,
          useLocalBaseBranch,
          error,
        }) => ({
          key,
          link,
          kind,
          repos,
          noRepo,
          branchPrefix,
          branch,
          baseBranch,
          useLocalBaseBranch,
          error,
        }),
      ),
    );
    retriedRef.current.clear();
    setEntries(stored.map(toDraft));
  };

  const handleStartNow = async (key: string) => {
    setStartingNow((current) => new Set(current).add(key));
    try {
      await persist();
      await tasksApi.startQueueEntryNow(key);
      showToast(t("taskQueueModal.startNow.started", { key }), "success");
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "newTaskModal.unexpectedFailure"), "error");
    } finally {
      setStartingNow((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
      refreshStatus();
      tasksApi
        .fetchTaskQueue()
        .then(mergeProgress)
        .catch(() => undefined);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await persist();
      showToast(t("taskQueueModal.saved"), "success");
      // Don't wait for the next tick to start what just became ready.
      void tasksApi
        .runSchedulerNow()
        .then(() => onSessionCreated?.())
        .catch(() => undefined);
      onClose();
    } catch (err) {
      const message = resolveApiErrorMessage(err, t, "newTaskModal.unexpectedFailure");
      showToast(t("taskQueueModal.saveError", { message }), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={t("taskQueueModal.title")}
      icon={<ListTodo className="h-5 w-5" />}
      onClose={onClose}
      onCancel={onClose}
      onConfirm={() => void handleSave()}
      confirmLabel={t("taskQueueModal.save")}
      cancelLabel={t("newTaskModal.cancel")}
      isConfirmLoading={saving}
      isConfirmDisabled={loading || loadFailed}
      onSecondary={entries.length > 0 ? () => setEntries([]) : undefined}
      secondaryLabel={t("taskQueueModal.clear")}
      size="xl"
    >
      <div className="flex flex-col gap-5">
        <p className="text-sm text-gray-600 dark:text-gray-400">{t("taskQueueModal.intro")}</p>

        <SchedulerPanel
          status={status}
          onRefresh={refreshStatus}
          onRunNow={() => void handleRunNow()}
          running={runningNow}
        />

        <TaskQueueForm
          projects={projects}
          branchTypes={branchTypes}
          listedKeys={new Set(entries.map((e) => e.key))}
          onAdd={(fresh) => setEntries((current) => [...current, ...fresh])}
        />

        <TaskQueueList
          entries={entries}
          setEntries={setEntries}
          loading={loading}
          loadFailed={loadFailed}
          isLaunching={isLaunching}
          projects={projects}
          branchTypes={branchTypes}
          saving={saving}
          onStartNow={(key) => void handleStartNow(key)}
          onRetry={(key) => {
            retriedRef.current.add(key);
          }}
        />
      </div>
    </Modal>
  );
}
