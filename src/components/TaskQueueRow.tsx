import {
  ExternalLink,
  FolderPlus,
  GripVertical,
  Loader2,
  Rocket,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import type { ProjectFolderOption } from "../services/tasksApi";
import { branchNameFor, type DraftEntry, isMissingSetup, NO_REPO_VALUE } from "../utils/taskQueue";
import { Button } from "./Button";
import { Input } from "./Input";
import { Select } from "./Select";
import { TaskQueueKindBadge, TaskQueueKindPicker } from "./TaskQueueKind";
import { TaskQueuePrefixSelect } from "./TaskQueuePrefixSelect";
import { TaskQueueNoRepoChip, TaskQueueRepoChips } from "./TaskQueueRepoChips";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

type TaskQueueRowProps = {
  entry: DraftEntry;
  /** Being launched right now (by "Start now" or the scheduler). */
  launching: boolean;
  projects: ProjectFolderOption[];
  branchTypes: string[];
  saving: boolean;
  onUpdate: (patch: Partial<DraftEntry>) => void;
  onRemove: () => void;
  onStartNow: () => void;
  onRetry: () => void;
  /** Pointer down / up on the drag handle. */
  onArmDrag: () => void;
  onDisarmDrag: () => void;
};

/** One queue entry's contents: editable until it's launched (or launching), a summary after. */
export function TaskQueueRow({
  entry,
  launching,
  projects,
  branchTypes,
  saving,
  onUpdate,
  onRemove,
  onStartNow,
  onRetry,
  onArmDrag,
  onDisarmDrag,
}: TaskQueueRowProps) {
  const { t } = useLanguage();
  const locked = Boolean(entry.launchedAt) || launching;
  const available = projects.filter((p) => !entry.repos.includes(p.path));
  const removeRepo = (repo: string) => onUpdate({ repos: entry.repos.filter((r) => r !== repo) });

  const renderState = () => {
    if (entry.launchedAt) {
      return (
        <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950/50 dark:text-green-300">
          {t("taskQueueModal.state.launched", { time: formatTime(entry.launchedAt) })}
        </span>
      );
    }
    if (launching) {
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

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {!locked && (
            <span
              onPointerDown={onArmDrag}
              onPointerUp={onDisarmDrag}
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
          {renderState()}
          {locked && <TaskQueueKindBadge kind={entry.kind} />}
          {locked && entry.noRepo && <TaskQueueNoRepoChip />}
          {locked && <TaskQueueRepoChips repos={entry.repos} projects={projects} />}
        </div>
        <div className="flex shrink-0 items-center">
          {!locked && (
            <Button
              variant="outline"
              size="sm"
              onClick={onStartNow}
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
            onClick={onRemove}
            disabled={launching}
            aria-label={t("taskQueueModal.removeTask")}
            title={t("taskQueueModal.removeTask")}
            icon={<Trash2 className="h-4 w-4" />}
          />
        </div>
      </div>

      {locked ? (
        !entry.noRepo && (
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
        )
      ) : (
        <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 text-xs text-gray-500 dark:text-gray-400">
          <span>{t("taskQueueModal.kindLabel")}</span>
          <TaskQueueKindPicker
            value={entry.kind}
            onChange={(kind) => onUpdate({ kind })}
            large={false}
          />

          <span>{t("taskQueueModal.reposLabel")}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {entry.noRepo && <TaskQueueNoRepoChip onRemove={() => onUpdate({ noRepo: false })} />}
            <TaskQueueRepoChips repos={entry.repos} projects={projects} onRemove={removeRepo} />
            {!entry.noRepo && (available.length > 0 || entry.repos.length === 0) && (
              <div className="w-48">
                <Select
                  icon={<FolderPlus className="h-4 w-4" />}
                  value=""
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === NO_REPO_VALUE) {
                      onUpdate({ noRepo: true, repos: [] });
                    } else if (value) {
                      onUpdate({ repos: [...entry.repos, value] });
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
                  {entry.repos.length === 0 && (
                    <option value={NO_REPO_VALUE}>{t("taskQueueModal.noRepoOption")}</option>
                  )}
                  {available.map((project) => (
                    <option key={project.path} value={project.path}>
                      {project.label}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            {entry.repos.length === 0 && !entry.noRepo && (
              <span className="text-amber-600 dark:text-amber-400">
                {t("taskQueueModal.missingRepo")}
              </span>
            )}
          </div>

          {entry.noRepo ? null : entry.kind === "test" ? (
            <>
              <span>{t("taskQueueModal.testBranchLabel")}</span>
              <div className="w-72">
                <Input
                  type="text"
                  value={entry.branch ?? ""}
                  onChange={(event) => onUpdate({ branch: event.target.value.trim() || null })}
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
                  <TaskQueuePrefixSelect
                    value={entry.branchPrefix}
                    onChange={(branchPrefix) => onUpdate({ branchPrefix })}
                    branchTypes={branchTypes}
                    className="py-1"
                  />
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
                      onUpdate({ baseBranch: event.target.value.trim() || null })
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
                      onChange={(event) => onUpdate({ useLocalBaseBranch: event.target.checked })}
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
              onClick={onRetry}
              icon={<RotateCcw className="h-3 w-3" />}
            >
              {t("taskQueueModal.retry")}
            </Button>
          )}
        </div>
      )}
    </>
  );
}
