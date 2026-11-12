import { Loader2, Save } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { QueuePromptPanel } from "../components/QueuePromptPanel";
import { SchedulerPanel } from "../components/SchedulerPanel";
import { TaskQueueForm } from "../components/TaskQueueForm";
import { TaskQueueList } from "../components/TaskQueueList";
import { useLanguage } from "../hooks/useLanguage";
import { useProjectFolders } from "../hooks/useProjectFolders";
import { useToast } from "../hooks/useToast";
import * as preferencesApi from "../services/preferencesApi";
import * as tasksApi from "../services/tasksApi";
import type { QueueEntry, QueueKind, SchedulerStatus } from "../services/tasksApi";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { type DraftEntry, entryKeys, previewDevPrompt, toDraft } from "../utils/taskQueue";

/** While shown, the scheduler's progress (launches, errors, room left) is re-read this often. */
const POLL_MS = 10_000;

type TaskQueuePageProps = {
  /** The page is the one on screen; while hidden it keeps its draft but stops polling. */
  active: boolean;
  /** The saved queue or a launch changed: the list and the navigation's count should reload. */
  onChanged: () => void;
  /** Goes up on each "New task": the add form is brought into view and focused. */
  newTaskRequest: number;
};

/** What "Save queue" sends for each entry. */
function toStored(entries: DraftEntry[]) {
  return entries.map(
    ({
      key,
      link,
      groupedTasks,
      kind,
      repos,
      noRepo,
      multiRepo,
      branchPrefix,
      branch,
      baseBranch,
      useLocalBaseBranch,
      notes,
      error,
    }) => ({
      key,
      link,
      groupedTasks,
      kind,
      repos,
      noRepo,
      multiRepo,
      branchPrefix,
      branch,
      baseBranch,
      useLocalBaseBranch,
      notes,
      error,
    }),
  );
}

/** The user's edits only (not the scheduler's fields), to tell whether there's something to save. */
function editSnapshot(entries: DraftEntry[]): string {
  return JSON.stringify(
    toStored(entries.filter((entry) => !entry.launchedAt)).map((entry) => ({
      ...entry,
      error: null,
    })),
  );
}

/**
 * The task queue as a page: paste the tasks ready to be worked on, tie each one to its repo(s),
 * and the scheduler launches them one by one (own worktree each) while there's room. Edits stay
 * local until "Save queue" (a bar says so); the scheduler's progress is merged in as it happens.
 */
export function TaskQueuePage({ active, onChanged, newTaskRequest }: TaskQueuePageProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { projects } = useProjectFolders(true);
  const [entries, setEntries] = useState<DraftEntry[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState(() => editSnapshot([]));
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [branchTypes, setBranchTypes] = useState<string[]>([]);
  const [prefs, setPrefs] = useState<preferencesApi.UserPreferences | null>(null);
  const [previewEntry, setPreviewEntry] = useState<DraftEntry | null>(null);
  // The prompt panel is about development sessions: shown only while adding those.
  const [formKind, setFormKind] = useState<QueueKind | null>(null);
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [runningNow, setRunningNow] = useState(false);
  // Keys whose error the user cleared to retry: a poll mustn't bring the old error back.
  const retriedRef = useRef(new Set<string>());

  /** "Discard": back to the saved queue. */
  const loadQueue = useCallback(() => {
    setLoading(true);
    setLoadFailed(false);
    tasksApi
      .fetchTaskQueue()
      .then((list) => {
        const drafts = list.map(toDraft);
        setEntries(drafts);
        setSavedSnapshot(editSnapshot(drafts));
      })
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }, []);

  // Re-read when saved anywhere (the default prompt is edited here and in Settings).
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      preferencesApi
        .fetchPreferences()
        .then((next) => {
          if (cancelled) return;
          setPrefs(next);
          setBranchTypes(next.branchTypes);
        })
        .catch(() => undefined);
    };
    load();
    window.addEventListener(preferencesApi.PREFERENCES_CHANGED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(preferencesApi.PREFERENCES_CHANGED_EVENT, load);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    tasksApi
      .fetchTaskQueue()
      .then((list) => {
        if (cancelled) return;
        const drafts = list.map(toDraft);
        setEntries(drafts);
        setSavedSnapshot(editSnapshot(drafts));
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
            groupedTasks: server.launchedAt ? (server.groupedTasks ?? []) : entry.groupedTasks,
            noRepo: server.launchedAt ? (server.noRepo ?? false) : entry.noRepo,
            multiRepo: server.launchedAt ? (server.multiRepo ?? false) : entry.multiRepo,
            kind: server.launchedAt ? (server.kind ?? "dev") : entry.kind,
            branchPrefix: server.launchedAt ? (server.branchPrefix ?? null) : entry.branchPrefix,
            branch: server.launchedAt ? (server.branch ?? null) : entry.branch,
            baseBranch: server.launchedAt ? (server.baseBranch ?? null) : entry.baseBranch,
            useLocalBaseBranch: server.launchedAt
              ? (server.useLocalBaseBranch ?? false)
              : entry.useLocalBaseBranch,
            notes: server.launchedAt ? (server.notes ?? "") : entry.notes,
            launchedAt: server.launchedAt ?? null,
            sessionId: server.sessionId ?? null,
            error: keepLocalError ? entry.error : (server.error ?? null),
          };
        }),
      );
      if (launched) onChanged();
    },
    [onChanged],
  );

  useEffect(() => {
    if (!active) return;
    refreshStatus();
    const timer = window.setInterval(() => {
      refreshStatus();
      tasksApi
        .fetchTaskQueue()
        .then(mergeProgress)
        .catch(() => undefined);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [active, refreshStatus, mergeProgress]);

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

  const persist = async (list: DraftEntry[] = entries) => {
    const stored = await tasksApi.saveTaskQueue(toStored(list));
    retriedRef.current.clear();
    const drafts = stored.map(toDraft);
    setEntries(drafts);
    setSavedSnapshot(editSnapshot(drafts));
    onChanged();
  };

  /** `saved` = the queue was just saved with this entry in it. */
  const handleStartNow = async (key: string, saved = false) => {
    setStartingNow((current) => new Set(current).add(key));
    try {
      if (!saved) await persist();
      tasksApi.notifyQueueLaunchStarted();
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

  // "Add and start now": saved with the new entries, then each one is started right away.
  const handleAddAndStart = async (fresh: DraftEntry[]) => {
    const next = [...entries, ...fresh];
    setEntries(next);
    try {
      await persist(next);
    } catch (err) {
      const message = resolveApiErrorMessage(err, t, "newTaskModal.unexpectedFailure");
      showToast(t("taskQueueModal.saveError", { message }), "error");
      return;
    }
    for (const entry of fresh) void handleStartNow(entry.key, true);
  };

  const handleRemoveLaunched = async () => {
    setEntries((current) => current.filter((entry) => !entry.launchedAt));
    try {
      const saved = (await tasksApi.fetchTaskQueue()).map(toDraft);
      const stored = await tasksApi.saveTaskQueue(
        toStored(saved.filter((entry) => !entry.launchedAt)),
      );
      setSavedSnapshot(editSnapshot(stored.map(toDraft)));
      onChanged();
    } catch (err) {
      const message = resolveApiErrorMessage(err, t, "newTaskModal.unexpectedFailure");
      showToast(t("taskQueueModal.saveError", { message }), "error");
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
        .then((next) => {
          setStatus(next);
          onChanged();
        })
        .catch(() => undefined);
    } catch (err) {
      const message = resolveApiErrorMessage(err, t, "newTaskModal.unexpectedFailure");
      showToast(t("taskQueueModal.saveError", { message }), "error");
    } finally {
      setSaving(false);
    }
  };

  const dirty = !loading && !loadFailed && editSnapshot(entries) !== savedSnapshot;

  // Leaving the app with unsaved edits asks first (the scheduler only sees the saved queue).
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  return (
    <div className="flex min-h-dvh flex-col">
      <PageHeader
        title={t("taskQueueModal.title")}
        subtitle={t("taskQueueModal.intro")}
        actions={
          <>
            {entries.length > 0 && (
              <Button variant="ghost" onClick={() => setEntries([])} disabled={saving}>
                {t("taskQueueModal.clear")}
              </Button>
            )}
            <Button
              onClick={() => void handleSave()}
              disabled={saving || loading || loadFailed || !dirty}
              icon={
                saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />
              }
            >
              {t("taskQueueModal.save")}
            </Button>
          </>
        }
      />

      {/* Ultrawide: the scheduler and its settings in a column on the left, the queue beside it. */}
      <div
        className={`mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-7 ${dirty ? "pb-28" : ""} 3xl:grid 3xl:max-w-none 3xl:grid-cols-[30rem_minmax(0,1fr)] 3xl:items-start`}
      >
        <aside className="3xl:sticky 3xl:top-6 3xl:max-h-[calc(100dvh-3rem)] 3xl:overflow-y-auto">
          <SchedulerPanel
            status={status}
            onRefresh={refreshStatus}
            onRunNow={() => void handleRunNow()}
            running={runningNow}
          />
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
          <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <TaskQueueForm
              focusRequest={newTaskRequest}
              projects={projects}
              branchTypes={branchTypes}
              listedKeys={new Set(entries.flatMap(entryKeys))}
              onAdd={(fresh) => setEntries((current) => [...current, ...fresh])}
              onAddAndStart={(fresh) => void handleAddAndStart(fresh)}
              onKindChange={setFormKind}
              skills={prefs && { test: prefs.taskTestSkill, review: prefs.taskReviewSkill }}
            />
          </section>

          {formKind === "dev" && <QueuePromptPanel defaultPrompt={prefs?.defaultPrompt ?? null} />}

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
            onRemoveLaunched={() => void handleRemoveLaunched()}
            onRetry={(key) => {
              retriedRef.current.add(key);
            }}
            onPreviewPrompt={setPreviewEntry}
          />
        </div>
      </div>

      {previewEntry && (
        <Modal
          open
          title={t("taskQueueModal.previewTitle", { key: entryKeys(previewEntry).join(" + ") })}
          onClose={() => setPreviewEntry(null)}
          size="xl"
        >
          <pre className="max-h-[60vh] overflow-y-auto rounded-lg bg-gray-50 p-3 font-mono text-xs whitespace-pre-wrap text-gray-800 dark:bg-gray-800/60 dark:text-gray-200">
            {previewDevPrompt(previewEntry, prefs?.defaultPrompt ?? "", prefs?.language ?? "en")}
          </pre>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            {t("taskQueueModal.previewAuto")}
          </p>
        </Modal>
      )}

      {/* Floats over the bottom of the page (above the phone's bottom bar), centered on the content. */}
      {dirty && (
        <div
          role="status"
          className="fixed bottom-20 left-1/2 z-30 flex w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 items-center gap-3 rounded-xl border border-gray-200 bg-white py-2.5 pr-2.5 pl-4 text-sm text-gray-700 shadow-lg lg:bottom-6 lg:left-[calc(50%+7.5rem)] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
        >
          <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
          <span className="min-w-0 flex-1">{t("queuePage.unsaved")}</span>
          <Button variant="ghost" size="sm" onClick={loadQueue} disabled={saving}>
            {t("queuePage.discard")}
          </Button>
          <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
            {t("taskQueueModal.save")}
          </Button>
        </div>
      )}
    </div>
  );
}
