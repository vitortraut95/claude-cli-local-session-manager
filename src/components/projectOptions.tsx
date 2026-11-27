import type { TranslationKey } from "../i18n/translations";
import type { ProjectFolderOption } from "../services/tasksApi";
import { groupProjects } from "../utils/projectFolders";

/** A project select's `<option>`s: the recent ones first, then all the others alphabetically
 *  (grouped only when both exist). A function, not a component: `Select` reads its options from
 *  the elements it's given. */
export function projectOptions(projects: ProjectFolderOption[], t: (key: TranslationKey) => string) {
  const { recent, others } = groupProjects(projects);
  const options = (list: ProjectFolderOption[]) =>
    list.map((project) => (
      <option key={project.path} value={project.path}>
        {project.label}
      </option>
    ));
  if (recent.length === 0 || others.length === 0) return options([...recent, ...others]);
  return (
    <>
      <optgroup label={t("newTaskModal.recentProjectsGroup")}>{options(recent)}</optgroup>
      <optgroup label={t("newTaskModal.allProjectsGroup")}>{options(others)}</optgroup>
    </>
  );
}
