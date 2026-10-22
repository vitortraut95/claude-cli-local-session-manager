import {
  ExternalLink,
  FolderPlus,
  GripVertical,
  ListTodo,
  Loader2,
  Rocket,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useProjectFolders } from "../hooks/useProjectFolders";
import { useToast } from "../hooks/useToast";
import * as preferencesApi from "../services/preferencesApi";
import * as tasksApi from "../services/tasksApi";
import type { QueueEntry, QueueKind, SchedulerStatus } from "../services/tasksApi";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { parsePastedTasks } from "../utils/taskQueue";
import { Button } from "./Button";
import { Input } from "./Input";
import { Modal } from "./Modal";
import { SchedulerPanel } from "./SchedulerPanel";
import { SettingRow } from "./SettingRow";
import { Select } from "./Select";

const TEXTAREA_CLASSNAME =
  "w-full rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900 placeholder:text-gray-400 " +
  "focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 " +
  "dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-gray-600 " +
  "dark:focus:ring-gray-100/10";

/** While open, the scheduler's progress (launches, errors, room left) is re-read this often. */
const POLL_MS = 10_000;

/** The optional (older-backend) fields resolved, so the rows never deal with `undefined`. */
type DraftEntry = Pick<QueueEntry, "key" | "link" | "repos"> & {
  kind: QueueKind;
  branchPrefix: string | null;
  branch: string | null;
  baseBranch: string | null;
  useLocalBaseBranch: boolean;
  launchedAt: string | null;
  sessionId: string | null;
  error: string | null;
};

/** Select values for a prefix: null = not chosen yet, "" = no prefix. */
const PREFIX_UNSET = "__unset__";
const PREFIX_NONE = "__none__";

function prefixToValue(prefix: string | null): string {
  return prefix === null ? PREFIX_UNSET : prefix === "" ? PREFIX_NONE : prefix;
}

function valueToPrefix(value: string): string | null {
  return value === PREFIX_UNSET ? null : value === PREFIX_NONE ? "" : value;
}

function branchNameFor(entry: { key: string; branchPrefix?: string | null }): string {
  return entry.branchPrefix ? `${entry.branchPrefix}/${entry.key}` : entry.key;
}

/** A test needs no branch prefix: it tests the branch the task already has. */
function isMissingSetup(entry: DraftEntry): boolean {
  return entry.repos.length === 0 || (entry.kind === "dev" && entry.branchPrefix === null);
}

function toDraft({
  key,
  link,
  kind,
  repos,
  branchPrefix,
  branch,
  baseBranch,
  useLocalBaseBranch,
  launchedAt,
  sessionId,
  error,
}: QueueEntry): DraftEntry {
  return {
    key,
    link,
    kind: kind ?? "dev",
    repos,
    branchPrefix: branchPrefix ?? null,
    branch: branch ?? null,
    baseBranch: baseBranch ?? null,
    useLocalBaseBranch: useLocalBaseBranch ?? false,
    launchedAt: launchedAt ?? null,
    sessionId: sessionId ?? null,
    error: error ?? null,
  };
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

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
  const [pasteText, setPasteText] = useState("");
  const [pasteRepo, setPasteRepo] = useState("");
  // No default on purpose: env/feature/fix/none changes what the pipeline does with the branch.
  const [pastePrefix, setPastePrefix] = useState<string | null>(null);
  const [pasteKind, setPasteKind] = useState<QueueKind>("dev");
  // "" = each repo's default branch.
  const [pasteBase, setPasteBase] = useState("");
  const [pasteUseLocalBase, setPasteUseLocalBase] = useState(false);
  const [branchTypes, setBranchTypes] = useState<string[]>([]);
  // "" = no test skill chosen: test entries would fail to launch.
  const [taskTestSkill, setTaskTestSkill] = useState<string | null>(null);
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
        setTaskTestSkill(prefs.taskTestSkill?.trim() ?? "");
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

  // Stored repos are repo roots, which a recent folder may not be — fall back to the folder name.
  const repoLabel = (repo: string) =>
    projects.find((p) => p.path === repo)?.label ?? repo.split("/").filter(Boolean).pop() ?? repo;

  const updateEntry = (key: string, patch: Partial<DraftEntry>) =>
    setEntries((current) => current.map((e) => (e.key === key ? { ...e, ...patch } : e)));

  // The scheduler launches the first ready entry in list order, so the order is the priority.
  // Entries not launched yet are dragged by their handle; `armedKey` makes only that row
  // draggable, so text in its inputs can still be selected.
  const [armedKey, setArmedKey] = useState<string | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const moveEntryTo = (key: string, targetKey: string) =>
    setEntries((current) => {
      const from = current.findIndex((e) => e.key === key);
      const to = current.findIndex((e) => e.key === targetKey);
      const moved = current[from];
      if (!moved || to < 0 || from === to) return current;
      const next = current.filter((e) => e.key !== key);
      next.splice(to, 0, moved);
      return next;
    });
  const endDrag = () => {
    setArmedKey(null);
    setDragKey(null);
    setOverKey(null);
  };

  // "Start now" sends the queue as it is on screen first (the server launches the saved entry).
  const [startingNow, setStartingNow] = useState<Set<string>>(new Set());
  const isLaunching = (key: string) =>
    startingNow.has(key) ||
    status?.launching === key ||
    (status?.launchingKeys?.includes(key) ?? false);

  const handleAdd = () => {
    const pasted = parsePastedTasks(pasteText);
    if (pasted.length === 0) {
      showToast(t("taskQueueModal.noneFound"), "error");
      return;
    }
    const listed = new Set(entries.map((e) => e.key));
    const fresh = pasted.filter((task) => !listed.has(task.key));
    const repeated = pasted.filter((task) => listed.has(task.key)).map((task) => task.key);
    setEntries((current) => [
      ...current,
      ...fresh.map((task) => ({
        ...task,
        kind: pasteKind,
        repos: pasteRepo ? [pasteRepo] : [],
        branchPrefix: pasteKind === "dev" ? pastePrefix : null,
        branch: null,
        baseBranch: pasteKind === "dev" ? pasteBase.trim() || null : null,
        useLocalBaseBranch: pasteKind === "dev" && pasteUseLocalBase,
        launchedAt: null,
        sessionId: null,
        error: null,
      })),
    ]);
    setPasteText("");
    if (fresh.length > 0) {
      showToast(t("taskQueueModal.added", { count: fresh.length }), "success");
    }
    if (repeated.length > 0) {
      showToast(t("taskQueueModal.alreadyListed", { keys: repeated.join(", ") }), "error");
    }
  };

  const persist = async () => {
    const stored = await tasksApi.saveTaskQueue(
      entries.map(
        ({
          key,
          link,
          kind,
          repos,
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

  const pending = entries.filter((e) => !e.launchedAt);
  const missingSetupCount = pending.filter(isMissingSetup).length;
  const testSkillMissing = taskTestSkill === "" && pending.some((e) => e.kind === "test");
  const launchedCount = entries.length - pending.length;

  const renderPrefixSelect = (
    value: string | null,
    onChange: (prefix: string | null) => void,
    className = "",
  ) => {
    // A stored prefix no longer among the configured types stays selectable.
    const options = value && !branchTypes.includes(value) ? [value, ...branchTypes] : branchTypes;
    return (
      <Select
        value={prefixToValue(value)}
        onChange={(event) => onChange(valueToPrefix(event.target.value))}
        aria-label={t("taskQueueModal.prefixAriaLabel")}
        className={`${value === null ? "border-amber-400 dark:border-amber-600" : ""} ${className}`}
      >
        <option value={PREFIX_UNSET} disabled>
          {t("taskQueueModal.prefixUnset")}
        </option>
        {options.map((prefix) => (
          <option key={prefix} value={prefix}>
            {prefix}/
          </option>
        ))}
        <option value={PREFIX_NONE}>{t("taskQueueModal.prefixNone")}</option>
      </Select>
    );
  };

  const renderRepoChips = (entry: DraftEntry, removable: boolean) =>
    entry.repos.map((repo, index) => (
      <span
        key={repo}
        title={repo}
        className="flex items-center gap-1 rounded-md bg-gray-100 py-0.5 pl-2 pr-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300"
      >
        {repoLabel(repo)}
        {index === 0 && entry.repos.length > 1 && (
          <span className="text-gray-400 dark:text-gray-500">({t("taskQueueModal.mainRepo")})</span>
        )}
        {removable && (
          <button
            type="button"
            onClick={() => updateEntry(entry.key, { repos: entry.repos.filter((r) => r !== repo) })}
            aria-label={t("taskQueueModal.removeRepo")}
            className="rounded p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </span>
    ));

  const renderState = (entry: DraftEntry) => {
    if (entry.launchedAt) {
      return (
        <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950/50 dark:text-green-300">
          {t("taskQueueModal.state.launched", { time: formatTime(entry.launchedAt) })}
        </span>
      );
    }
    if (isLaunching(entry.key)) {
      return (
        <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
          <Loader2 className="h-3 w-3 animate-spin" /> {t("taskQueueModal.state.launching")}
        </span>
      );
    }
    if (entry.error) {
      return (
        <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {t("taskQueueModal.state.failed")}
        </span>
      );
    }
    if (isMissingSetup(entry)) return null;
    return (
      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
        {t("taskQueueModal.state.waiting")}
      </span>
    );
  };

  const renderKindSelect = (
    value: QueueKind,
    onChange: (kind: QueueKind) => void,
    className = "",
  ) => (
    <Select
      value={value}
      onChange={(event) => onChange(event.target.value as QueueKind)}
      aria-label={t("taskQueueModal.kindAriaLabel")}
      className={className}
    >
      <option value="dev">{t("taskQueueModal.kind.dev")}</option>
      <option value="test">{t("taskQueueModal.kind.test")}</option>
    </Select>
  );

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

        <div className="flex flex-col gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              {t("taskQueueModal.pasteLabel")}
            </span>
            <textarea
              value={pasteText}
              onChange={(event) => setPasteText(event.target.value)}
              placeholder={t("taskQueueModal.pastePlaceholder")}
              rows={4}
              className={TEXTAREA_CLASSNAME}
              autoFocus
            />
          </label>
          <div className="flex flex-col gap-2.5">
            <SettingRow
              controlWidth="w-64"
              label={t("taskQueueModal.pasteRepo")}
              description={t("taskQueueModal.pasteRepo.hint")}
              control={
                <Select
                  value={pasteRepo}
                  onChange={(event) => setPasteRepo(event.target.value)}
                  aria-label={t("taskQueueModal.pasteRepo")}
                >
                  <option value="">{t("taskQueueModal.pasteRepoNone")}</option>
                  {projects.map((project) => (
                    <option key={project.path} value={project.path}>
                      {project.label}
                    </option>
                  ))}
                </Select>
              }
            />
            <SettingRow
              controlWidth="w-64"
              label={t("taskQueueModal.kindLabel")}
              description={t("taskQueueModal.kind.hint")}
              control={renderKindSelect(pasteKind, setPasteKind)}
            />
            {pasteKind === "dev" && (
              <>
                <SettingRow
                  controlWidth="w-64"
                  label={t("taskQueueModal.pastePrefix")}
                  description={t("taskQueueModal.pastePrefix.hint")}
                  control={renderPrefixSelect(pastePrefix, setPastePrefix)}
                />
                <SettingRow
                  controlWidth="w-64"
                  label={t("newTaskModal.baseBranchLabel")}
                  description={t("taskQueueModal.pasteBase.hint")}
                  control={
                    <Input
                      type="text"
                      value={pasteBase}
                      onChange={(event) => setPasteBase(event.target.value)}
                      placeholder={t("taskQueueModal.basePlaceholder")}
                      aria-label={t("newTaskModal.baseBranchLabel")}
                    />
                  }
                />
                {pasteBase.trim() && (
                  <label className="flex items-start gap-2 pl-[17rem] text-xs text-gray-500 dark:text-gray-400">
                    <input
                      type="checkbox"
                      checked={pasteUseLocalBase}
                      onChange={(event) => setPasteUseLocalBase(event.target.checked)}
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-gray-900 dark:accent-gray-100"
                    />
                    {t("newTaskModal.useLocalBaseBranchLabel")}
                  </label>
                )}
              </>
            )}
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={handleAdd} disabled={!pasteText.trim()}>
              {t("taskQueueModal.add")}
            </Button>
          </div>
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {t("taskQueueModal.listTitle", { count: entries.length })}
            </h3>
            <div className="flex items-center gap-3">
              {testSkillMissing && (
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  {t("taskQueueModal.testSkillMissing")}
                </span>
              )}
              {missingSetupCount > 0 && (
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  {t("taskQueueModal.missingSetupCount", { count: missingSetupCount })}
                </span>
              )}
              {launchedCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEntries((current) => current.filter((e) => !e.launchedAt))}
                >
                  {t("taskQueueModal.removeLaunched", { count: launchedCount })}
                </Button>
              )}
            </div>
          </div>

          {loading ? (
            <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("taskQueueModal.loading")}
            </p>
          ) : loadFailed ? (
            <p className="text-sm text-red-600 dark:text-red-400">
              {t("taskQueueModal.loadError")}
            </p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t("taskQueueModal.empty")}</p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
              {entries.map((entry) => {
                const locked = Boolean(entry.launchedAt) || isLaunching(entry.key);
                const available = projects.filter((p) => !entry.repos.includes(p.path));
                return (
                  <li
                    key={entry.key}
                    draggable={armedKey === entry.key}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      setDragKey(entry.key);
                    }}
                    onDragOver={(event) => {
                      if (!dragKey || locked) return;
                      event.preventDefault();
                      if (overKey !== entry.key) setOverKey(entry.key);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (dragKey && !locked) moveEntryTo(dragKey, entry.key);
                      endDrag();
                    }}
                    onDragEnd={endDrag}
                    className={`flex flex-col gap-2 px-3 py-2.5 ${
                      dragKey === entry.key ? "opacity-50" : ""
                    } ${
                      overKey === entry.key && dragKey !== entry.key
                        ? "bg-gray-50 shadow-[inset_0_2px_0_0] shadow-gray-400 dark:bg-gray-800/60"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        {!locked && (
                          <span
                            onPointerDown={() => setArmedKey(entry.key)}
                            onPointerUp={() => {
                              if (!dragKey) setArmedKey(null);
                            }}
                            title={t("taskQueueModal.dragHandle")}
                            aria-label={t("taskQueueModal.dragHandle")}
                            className="-ml-1 cursor-grab rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 active:cursor-grabbing dark:hover:bg-gray-800 dark:hover:text-gray-300"
                          >
                            <GripVertical className="h-4 w-4" />
                          </span>
                        )}
                        {entry.link ? (
                          <a
                            href={entry.link}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-sm font-medium text-gray-900 hover:underline dark:text-gray-100"
                          >
                            {entry.key}
                            <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
                          </a>
                        ) : (
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {entry.key}
                          </span>
                        )}
                        {renderState(entry)}
                        {locked && entry.kind === "test" && (
                          <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 dark:bg-teal-950/50 dark:text-teal-300">
                            {t("taskQueueModal.kind.test")}
                          </span>
                        )}
                        {locked && renderRepoChips(entry, false)}
                      </div>
                      <div className="flex shrink-0 items-center">
                        {!locked && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleStartNow(entry.key)}
                            disabled={isMissingSetup(entry) || saving}
                            title={t("taskQueueModal.startNow.tooltip")}
                            icon={<Rocket className="h-3.5 w-3.5" />}
                            className="mr-1"
                          >
                            {t("taskQueueModal.startNow")}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setEntries((current) => current.filter((e) => e.key !== entry.key))
                          }
                          disabled={isLaunching(entry.key)}
                          aria-label={t("taskQueueModal.removeTask")}
                          title={t("taskQueueModal.removeTask")}
                          icon={<Trash2 className="h-4 w-4" />}
                        />
                      </div>
                    </div>

                    {locked ? (
                      <p className="flex flex-wrap gap-x-3 text-xs text-gray-500 dark:text-gray-400">
                        {entry.kind === "test" ? (
                          <span>
                            {t("taskQueueModal.testBranchLabel")}:{" "}
                            <code className="font-mono text-gray-700 dark:text-gray-300">
                              {entry.branch ?? t("taskQueueModal.testBranchPlaceholder")}
                            </code>
                          </span>
                        ) : (
                          <>
                            <span>
                              {t("taskQueueModal.branchLabel")}:{" "}
                              <code className="font-mono text-gray-700 dark:text-gray-300">
                                {branchNameFor(entry)}
                              </code>
                            </span>
                            <span>
                              {t("taskQueueModal.baseLabel")}:{" "}
                              <code className="font-mono text-gray-700 dark:text-gray-300">
                                {entry.baseBranch ?? t("taskQueueModal.basePlaceholder")}
                                {entry.useLocalBaseBranch && ` (${t("taskQueueModal.baseLocal")})`}
                              </code>
                            </span>
                          </>
                        )}
                      </p>
                    ) : (
                      <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <span>{t("taskQueueModal.kindLabel")}</span>
                        <div className="w-48">
                          {renderKindSelect(
                            entry.kind,
                            (kind) => updateEntry(entry.key, { kind }),
                            "py-1",
                          )}
                        </div>

                        <span>{t("taskQueueModal.reposLabel")}</span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {renderRepoChips(entry, true)}
                          {available.length > 0 && (
                            <div className="w-48">
                              <Select
                                icon={<FolderPlus className="h-4 w-4" />}
                                value=""
                                onChange={(event) => {
                                  if (event.target.value) {
                                    updateEntry(entry.key, {
                                      repos: [...entry.repos, event.target.value],
                                    });
                                  }
                                }}
                                aria-label={t("taskQueueModal.addRepo")}
                                className={
                                  entry.repos.length === 0
                                    ? "border-amber-400 py-1 dark:border-amber-600"
                                    : "py-1"
                                }
                              >
                                <option value="">{t("taskQueueModal.addRepo")}</option>
                                {available.map((project) => (
                                  <option key={project.path} value={project.path}>
                                    {project.label}
                                  </option>
                                ))}
                              </Select>
                            </div>
                          )}
                          {entry.repos.length === 0 && (
                            <span className="text-amber-600 dark:text-amber-400">
                              {t("taskQueueModal.missingRepo")}
                            </span>
                          )}
                        </div>

                        {entry.kind === "test" ? (
                          <>
                            <span>{t("taskQueueModal.testBranchLabel")}</span>
                            <div className="w-72">
                              <Input
                                type="text"
                                value={entry.branch ?? ""}
                                onChange={(event) =>
                                  updateEntry(entry.key, {
                                    branch: event.target.value.trim() || null,
                                  })
                                }
                                placeholder={t("taskQueueModal.testBranchPlaceholder")}
                                aria-label={t("taskQueueModal.testBranchLabel")}
                                className="py-1 font-mono text-xs"
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            <span>{t("taskQueueModal.branchLabel")}</span>
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="w-48">
                                {renderPrefixSelect(
                                  entry.branchPrefix,
                                  (branchPrefix) => updateEntry(entry.key, { branchPrefix }),
                                  "py-1",
                                )}
                              </div>
                              {entry.branchPrefix === null ? (
                                <span className="text-amber-600 dark:text-amber-400">
                                  {t("taskQueueModal.missingPrefix")}
                                </span>
                              ) : (
                                <code className="font-mono text-gray-700 dark:text-gray-300">
                                  {branchNameFor(entry)}
                                </code>
                              )}
                            </div>

                            <span>{t("taskQueueModal.baseLabel")}</span>
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="w-48">
                                <Input
                                  type="text"
                                  value={entry.baseBranch ?? ""}
                                  onChange={(event) =>
                                    updateEntry(entry.key, {
                                      baseBranch: event.target.value.trim() || null,
                                    })
                                  }
                                  placeholder={t("taskQueueModal.basePlaceholder")}
                                  aria-label={t("newTaskModal.baseBranchLabel")}
                                  className="py-1 font-mono text-xs"
                                />
                              </div>
                              {entry.baseBranch && (
                                <label className="flex items-center gap-1.5">
                                  <input
                                    type="checkbox"
                                    checked={entry.useLocalBaseBranch}
                                    onChange={(event) =>
                                      updateEntry(entry.key, {
                                        useLocalBaseBranch: event.target.checked,
                                      })
                                    }
                                    className="h-3.5 w-3.5 accent-gray-900 dark:accent-gray-100"
                                  />
                                  {t("taskQueueModal.baseLocalLong")}
                                </label>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {entry.error && (
                      <div
                        className={`flex items-start justify-between gap-2 rounded-md px-2 py-1.5 text-xs ${
                          entry.launchedAt
                            ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                            : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                        }`}
                      >
                        <span className="whitespace-pre-wrap break-words">
                          {entry.launchedAt
                            ? t("taskQueueModal.extraRepoFailed", { message: entry.error })
                            : entry.error}
                        </span>
                        {!entry.launchedAt && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              retriedRef.current.add(entry.key);
                              updateEntry(entry.key, { error: null });
                            }}
                            icon={<RotateCcw className="h-3 w-3" />}
                          >
                            {t("taskQueueModal.retry")}
                          </Button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
