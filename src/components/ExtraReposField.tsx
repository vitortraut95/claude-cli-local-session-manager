import { FolderPlus, GitBranch, X } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import type { ProjectFolderOption } from "../services/tasksApi";
import { Input } from "./Input";
import { Select } from "./Select";

export type ExtraRepo = { path: string; label: string; baseBranch: string };

type ExtraReposFieldProps = {
  projects: ProjectFolderOption[];
  /** The task's main folder — not offered again as an extra. */
  mainFolder: string;
  branchName: string;
  value: ExtraRepo[];
  onChange: (value: ExtraRepo[]) => void;
  /** No ticket key in the link — extras need one to be grouped into the task. */
  disabled: boolean;
  /** Trying to add a repo while `disabled` (the select isn't natively disabled, so the caller can
   *  explain why). */
  onBlockedAdd: () => void;
  /** The "Yes / No" toggle — "No" hides everything below it. */
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
};

/**
 * "New task"'s optional other repos: each gets the same branch name off its own base (blank = the
 * repo's default) and joins the main folder's session via `--add-dir`.
 */
export function ExtraReposField({
  projects,
  mainFolder,
  branchName,
  value,
  onChange,
  disabled,
  onBlockedAdd,
  enabled,
  onEnabledChange,
}: ExtraReposFieldProps) {
  const { t } = useLanguage();
  const chosen = new Set(value.map((repo) => repo.path));
  const available = projects.filter((p) => p.path !== mainFolder && !chosen.has(p.path));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {t("newTaskModal.extraRepos.label")}
        </span>
        {([false, true] as const).map((option) => (
          <label
            key={String(option)}
            className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400"
          >
            <input
              type="radio"
              name="newTaskExtraReposEnabled"
              checked={enabled === option}
              onChange={() => onEnabledChange(option)}
              className="accent-gray-900 dark:accent-gray-100"
            />
            {t(option ? "newTaskModal.extraRepos.yes" : "newTaskModal.extraRepos.no")}
          </label>
        ))}
      </div>
      {enabled && (
        <div className="mt-1">
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
            {disabled
              ? t("newTaskModal.extraRepos.needsKey")
              : t("newTaskModal.extraRepos.hint", { branch: branchName || "…" })}
          </p>
          {value.length > 0 && (
            <ul className="mb-2 space-y-1.5">
              {value.map((repo) => (
                <li key={repo.path} className="flex items-center gap-2">
                  <span
                    className="w-40 shrink-0 truncate text-sm text-gray-800 dark:text-gray-200"
                    title={repo.path}
                  >
                    {repo.label}
                  </span>
                  <Input
                    type="text"
                    icon={<GitBranch className="h-4 w-4" />}
                    value={repo.baseBranch}
                    onChange={(event) =>
                      onChange(
                        value.map((r) =>
                          r.path === repo.path ? { ...r, baseBranch: event.target.value } : r,
                        ),
                      )
                    }
                    placeholder={t("taskModal.addRepo.basePlaceholder")}
                  />
                  <button
                    type="button"
                    onClick={() => onChange(value.filter((r) => r.path !== repo.path))}
                    aria-label={t("newTaskModal.extraRepos.remove")}
                    className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {available.length > 0 && (
            <Select
              icon={<FolderPlus className="h-4 w-4" />}
              value=""
              aria-disabled={disabled}
              className={disabled ? "cursor-not-allowed opacity-60" : ""}
              onMouseDown={(event) => {
                if (!disabled) return;
                event.preventDefault();
                onBlockedAdd();
              }}
              onFocus={() => {
                if (disabled) onBlockedAdd();
              }}
              onChange={(event) => {
                const project = available.find((p) => p.path === event.target.value);
                if (project) {
                  onChange([
                    ...value,
                    { path: project.path, label: project.label, baseBranch: "" },
                  ]);
                }
              }}
            >
              <option value="">{t("newTaskModal.extraRepos.add")}</option>
              {available.map((project) => (
                <option key={project.path} value={project.path}>
                  {project.label}
                </option>
              ))}
            </Select>
          )}
        </div>
      )}
    </div>
  );
}
