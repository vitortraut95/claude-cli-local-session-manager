import { useCallback, useEffect, useMemo, useState } from "react";
import * as tasksApi from "../services/tasksApi";
import type { ProjectFolderOption } from "../services/tasksApi";

/** The project select's "type a path by hand" option. */
export const OTHER_FOLDER_VALUE = "__other__";

/**
 * The project-folder picker state shared by the "New task" and "New session" modals: the list of
 * known folders plus the user's choice (a listed folder, or "Other" + a typed path).
 *
 * The list is re-fetched every time `open` turns true (not just once on mount) — a project folder
 * typed by hand into "Other" only becomes a known option once it's been used, so re-running this
 * on open is the only way a just-used repo shows up in the dropdown next time without a full page
 * reload. Deferred via a 0ms timer so its setState calls happen in a callback, not synchronously
 * in the effect body itself.
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

  // Grouped only when the workspace dirs contributed anything beyond the recent list — otherwise
  // the select looks exactly like it did before workspace dirs existed.
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
