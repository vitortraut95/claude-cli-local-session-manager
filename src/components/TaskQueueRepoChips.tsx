import { FolderOpen, X } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import type { ProjectFolderOption } from "../services/tasksApi";

const CHIP_CLASSNAME =
  "flex items-center gap-1 rounded-md bg-gray-100 py-0.5 pl-2 pr-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300";

type RemoveButtonProps = { onClick: () => void };

function RemoveButton({ onClick }: RemoveButtonProps) {
  const { t } = useLanguage();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("taskQueueModal.removeRepo")}
      className="rounded p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700"
    >
      <X className="h-3 w-3" />
    </button>
  );
}

type TaskQueueRepoChipsProps = {
  repos: string[];
  projects: ProjectFolderOption[];
  /** Absent = the chips are read-only. */
  onRemove?: (repo: string) => void;
};

export function TaskQueueRepoChips({ repos, projects, onRemove }: TaskQueueRepoChipsProps) {
  const { t } = useLanguage();
  // Stored repos are repo roots, which a recent folder may not be — fall back to the folder name.
  const repoLabel = (repo: string) =>
    projects.find((p) => p.path === repo)?.label ?? repo.split("/").filter(Boolean).pop() ?? repo;

  return repos.map((repo, index) => (
    <span key={repo} title={repo} className={CHIP_CLASSNAME}>
      {repoLabel(repo)}
      {index === 0 && repos.length > 1 && (
        <span className="text-gray-400 dark:text-gray-500">({t("taskQueueModal.mainRepo")})</span>
      )}
      {onRemove && <RemoveButton onClick={() => onRemove(repo)} />}
    </span>
  ));
}

export function TaskQueueNoRepoChip({ onRemove }: { onRemove?: () => void }) {
  const { t } = useLanguage();
  return (
    <span className={CHIP_CLASSNAME}>
      <FolderOpen className="h-3 w-3" />
      {t("taskQueueModal.noRepo")}
      {onRemove && <RemoveButton onClick={onRemove} />}
    </span>
  );
}
