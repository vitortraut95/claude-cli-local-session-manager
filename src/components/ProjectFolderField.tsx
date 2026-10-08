import { Folder, Loader2 } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import { OTHER_FOLDER_VALUE, type ProjectFolders } from "../hooks/useProjectFolders";
import { Input } from "./Input";
import { Select } from "./Select";

type ProjectFolderFieldProps = {
  folders: ProjectFolders;
  /** The typed-path input's `name` — keys the browser's own autocomplete history. */
  inputName: string;
  loadingRepoInfo?: boolean;
  repoError?: string | null;
};

/** The "Project (folder)" field shared by the "New task" and "New session" modals — see
 *  `useProjectFolders` for the state behind it. */
export function ProjectFolderField({
  folders,
  inputName,
  loadingRepoInfo = false,
  repoError = null,
}: ProjectFolderFieldProps) {
  const { t } = useLanguage();
  const {
    projects,
    recentProjects,
    otherProjects,
    loadingProjects,
    folderChoice,
    setFolderChoice,
    customFolderPath,
    setCustomFolderPath,
    isOtherFolder,
  } = folders;

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
        {t("newTaskModal.projectLabel")}
      </label>
      {projects.length > 0 && (
        <Select
          icon={<Folder className="h-4 w-4" />}
          value={folderChoice}
          onChange={(event) => setFolderChoice(event.target.value)}
          disabled={loadingProjects}
        >
          <option value="" disabled>
            {loadingProjects ? t("newTaskModal.loadingProjects") : t("newTaskModal.selectProject")}
          </option>
          {otherProjects.length === 0 ? (
            recentProjects.map((project) => (
              <option key={project.path} value={project.path}>
                {project.label}
              </option>
            ))
          ) : (
            <>
              {recentProjects.length > 0 && (
                <optgroup label={t("newTaskModal.recentProjectsGroup")}>
                  {recentProjects.map((project) => (
                    <option key={project.path} value={project.path}>
                      {project.label}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label={t("newTaskModal.workspaceProjectsGroup")}>
                {otherProjects.map((project) => (
                  <option key={project.path} value={project.path}>
                    {project.label}
                  </option>
                ))}
              </optgroup>
            </>
          )}
          <option value={OTHER_FOLDER_VALUE}>{t("newTaskModal.otherFolder")}</option>
        </Select>
      )}
      {isOtherFolder && (
        <Input
          type="text"
          icon={<Folder className="h-4 w-4" />}
          value={customFolderPath}
          onChange={(event) => setCustomFolderPath(event.target.value)}
          placeholder="/absolute/path/to/the/project"
          name={inputName}
          className={projects.length > 0 ? "mt-2" : ""}
        />
      )}
      {loadingRepoInfo && (
        <p className="mt-1 flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
          <Loader2 className="h-3 w-3 animate-spin" /> {t("newTaskModal.readingRepoInfo")}
        </p>
      )}
      {repoError && <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{repoError}</p>}
    </div>
  );
}
