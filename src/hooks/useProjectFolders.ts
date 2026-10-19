import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProjectFolderOption } from "../services/tasksApi";
import * as tasksApi from "../services/tasksApi";

/** The project select's "type a path by hand" option. */
export const OTHER_FOLDER_VALUE = "__other__";

/**
 * Project-folder picker state for the "New task" and "New session" modals: known folders plus
 * the user's choice (a listed folder, or "Other" + a typed path). Re-fetched each time `open`
 * turns true, so a folder used since the last open shows up.
 */
export function useProjectFolders(open: boolean) {
  const [projects, setProjects] = useState<ProjectFolderOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [folderChoice, setFolderChoice] = useState("");
  const [customFolderPath, setCustomFolderPath] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoadingProjects(true);
      tasksApi
        .fetchProjectFolders()
        .then((list) => {
          if (cancelled) return;
          setProjects(list);
          if (list.length === 0) setFolderChoice(OTHER_FOLDER_VALUE);
        })
        .catch(() => {
          if (!cancelled) setFolderChoice(OTHER_FOLDER_VALUE);
        })
        .finally(() => {
          if (!cancelled) setLoadingProjects(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open]);

  // Grouped only when the workspace dirs contributed anything beyond the recent list.
  const { recentProjects, otherProjects } = useMemo(
    () => ({
      recentProjects: projects.filter((p) => p.recent !== false),
      otherProjects: projects.filter((p) => p.recent === false),
    }),
    [projects],
  );

  const isOtherFolder = folderChoice === OTHER_FOLDER_VALUE || projects.length === 0;
  const effectiveFolderPath = isOtherFolder ? customFolderPath : folderChoice;

  const resetFolder = useCallback(() => {
    setFolderChoice(projects.length === 0 ? OTHER_FOLDER_VALUE : "");
    setCustomFolderPath("");
  }, [projects]);

  return {
    projects,
    recentProjects,
    otherProjects,
    loadingProjects,
    folderChoice,
    setFolderChoice,
    customFolderPath,
    setCustomFolderPath,
    isOtherFolder,
    effectiveFolderPath,
    resetFolder,
  };
}

export type ProjectFolders = ReturnType<typeof useProjectFolders>;
