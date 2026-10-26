import { Loader2 } from "lucide-react";
import { type Dispatch, type SetStateAction, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import type { ProjectFolderOption } from "../services/tasksApi";
import { type DraftEntry, isMissingSetup } from "../utils/taskQueue";
import { Button } from "./Button";
import { TaskQueueRow } from "./TaskQueueRow";

type TaskQueueListProps = {
  entries: DraftEntry[];
  setEntries: Dispatch<SetStateAction<DraftEntry[]>>;
  loading: boolean;
  loadFailed: boolean;
  /** No test skill configured: test entries would fail to launch. */
  testSkillMissing: boolean;
  isLaunching: (key: string) => boolean;
  projects: ProjectFolderOption[];
  branchTypes: string[];
  saving: boolean;
  onStartNow: (key: string) => void;
  onRetry: (key: string) => void;
};

/** The queue in launch order, with the counts of what still needs setup or already launched. */
export function TaskQueueList({
  entries,
  setEntries,
  loading,
  loadFailed,
  testSkillMissing,
  isLaunching,
  projects,
  branchTypes,
  saving,
  onStartNow,
  onRetry,
}: TaskQueueListProps) {
  const { t } = useLanguage();

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

  const pending = entries.filter((e) => !e.launchedAt);
  const missingSetupCount = pending.filter(isMissingSetup).length;
  const launchedCount = entries.length - pending.length;

  return (
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
        <p className="text-sm text-red-600 dark:text-red-400">{t("taskQueueModal.loadError")}</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("taskQueueModal.empty")}</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          {entries.map((entry) => {
            const launching = isLaunching(entry.key);
            const locked = Boolean(entry.launchedAt) || launching;
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
                <TaskQueueRow
                  entry={entry}
                  launching={launching}
                  projects={projects}
                  branchTypes={branchTypes}
                  saving={saving}
                  onUpdate={(patch) => updateEntry(entry.key, patch)}
                  onRemove={() =>
                    setEntries((current) => current.filter((e) => e.key !== entry.key))
                  }
                  onStartNow={() => onStartNow(entry.key)}
                  onRetry={() => {
                    onRetry(entry.key);
                    updateEntry(entry.key, { error: null });
                  }}
                  onArmDrag={() => setArmedKey(entry.key)}
                  onDisarmDrag={() => {
                    if (!dragKey) setArmedKey(null);
                  }}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
