import type { ProjectFolderOption } from "../services/tasksApi";

/** How many recently used projects lead the project selects. */
const RECENT_LIMIT = 5;

/** The project selects' groups: the last used projects (most recent first), then every other
 *  one alphabetically. */
export function groupProjects(projects: ProjectFolderOption[]): {
  recent: ProjectFolderOption[];
  others: ProjectFolderOption[];
} {
  const recent = projects.filter((p) => p.recent === true).slice(0, RECENT_LIMIT);
  const shown = new Set(recent.map((p) => p.path));
  const others = projects
    .filter((p) => !shown.has(p.path))
    .sort((a, b) => a.label.localeCompare(b.label));
  return { recent, others };
}
