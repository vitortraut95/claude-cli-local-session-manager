import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ExtraRepo } from "../components/ExtraReposField";
import * as preferencesApi from "../services/preferencesApi";
import * as tasksApi from "../services/tasksApi";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { extractJiraId, FALLBACK_BRANCH_TYPES, OTHER_PREFIX_VALUE } from "../utils/newTask";
import type { Step } from "../utils/steps";
import { useLanguage } from "./useLanguage";
import { useProjectFolders } from "./useProjectFolders";
import { useToast } from "./useToast";

/**
 * Form state of the "New task" modal. Lives as long as the (always mounted) modal, so an
 * accidental close doesn't lose what the user typed; only `resetForm` wipes it.
 */
export function useNewTaskForm(open: boolean) {
  const { showToast } = useToast();
  const { t } = useLanguage();

  const [jiraLink, setJiraLink] = useState("");
  const jiraId = useMemo(() => extractJiraId(jiraLink), [jiraLink]);

  const folders = useProjectFolders(open);
  const { effectiveFolderPath, resetFolder } = folders;

  const [defaultPromptLoaded, setDefaultPromptLoaded] = useState<string | null>(null);
  const [loadingPrompt, setLoadingPrompt] = useState(true);
  const [promptText, setPromptText] = useState("");
  const [savingDefaultPrompt, setSavingDefaultPrompt] = useState(false);

  // Options of the "Branch type" select, from userPreferences.json; a custom ("Other") type used
  // to create a task is prepended (see NewTaskModal's handleCreate).
  const [branchTypes, setBranchTypes] = useState<string[]>(FALLBACK_BRANCH_TYPES);
  const [prefixChoice, setPrefixChoice] = useState<string>(FALLBACK_BRANCH_TYPES[0] ?? "feature");
  const [customPrefix, setCustomPrefix] = useState("");
  // null = not edited by hand, so the branch suffix tracks the Jira id. The prefix is kept
  // separate; the full branch name is computed for display/submission.
  const [branchSuffixManual, setBranchSuffixManual] = useState<string | null>(null);

  const [baseBranch, setBaseBranch] = useState("master");
  const [baseBranchTouched, setBaseBranchTouched] = useState(false);
  // Unchecked = fetch the latest version from origin; checked = use the local branch as-is,
  // skipping the fetch (which would discard unpushed local commits).
  const [useLocalBaseBranch, setUseLocalBaseBranch] = useState(false);
  const [loadingRepoInfo, setLoadingRepoInfo] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);

  // Smart default: suggest a worktree only when the chosen project's root already has an active
  // session. `useWorktreeDefault` is the stored fallback (used before that check resolves or if it
  // fails); `useWorktree` is the live value. `useWorktreeTouched` = manually overridden for the
  // current folder, so the auto-suggestion stops overwriting it until a different folder is chosen.
  const [useWorktree, setUseWorktree] = useState(false);
  const [useWorktreeTouched, setUseWorktreeTouched] = useState(false);

  const [useWorktreeDefault, setUseWorktreeDefault] = useState(false);
  const [savingWorktreeDefault, setSavingWorktreeDefault] = useState(false);
  // null = not yet known for the current folder (none chosen, loading, or the check failed).
  const [activeSessionInRoot, setActiveSessionInRoot] = useState<boolean | null>(null);

  // Remembered as whatever it was last left at (see NewTaskModal's handleCreate); no separate
  // draft value.
  const [permissionModeAuto, setPermissionModeAuto] = useState(false);

  const [creating, setCreating] = useState(false);
  // Empty while idle; filled with every step ("pending") when a create attempt starts, so the
  // modal shows which step is running, finished, or failed.
  const [steps, setSteps] = useState<Step[]>([]);
  const [extraRepos, setExtraRepos] = useState<ExtraRepo[]>([]);
  const [useExtraRepos, setUseExtraRepos] = useState(false);

  // Fetched once on mount, not on every open — re-seeding on open would clobber in-progress input
  // across an accidental close.
  useEffect(() => {
    let cancelled = false;
    preferencesApi
      .fetchPreferences()
      .then((prefs) => {
        if (cancelled) return;
        setDefaultPromptLoaded(prefs.defaultPrompt);
        setPromptText(prefs.defaultPrompt);
        const loadedBranchTypes =
          prefs.branchTypes.length > 0 ? prefs.branchTypes : FALLBACK_BRANCH_TYPES;
        setBranchTypes(loadedBranchTypes);
        setPrefixChoice(loadedBranchTypes[0] ?? "feature");
        setUseWorktreeDefault(prefs.useWorktreeByDefault);
        setUseWorktree(prefs.useWorktreeByDefault);
        setPermissionModeAuto(prefs.useAutoPermissionModeByDefault);
      })
      .catch(() => {
        if (!cancelled) setDefaultPromptLoaded("");
      })
      .finally(() => {
        if (!cancelled) setLoadingPrompt(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The settings modal can change these stored defaults — reload them when it says so. Drafts
  // follow along only when they still equal the old stored value, so in-progress edits survive.
  const latestRef = useRef({ defaultPrompt: defaultPromptLoaded, useWorktreeTouched });
  useEffect(() => {
    latestRef.current = { defaultPrompt: defaultPromptLoaded, useWorktreeTouched };
  }, [defaultPromptLoaded, useWorktreeTouched]);
  useEffect(() => {
    const onChanged = () => {
      preferencesApi
        .fetchPreferences()
        .then((prefs) => {
          const previous = latestRef.current;
          setDefaultPromptLoaded(prefs.defaultPrompt);
          setPromptText((current) =>
            current === (previous.defaultPrompt ?? "") ? prefs.defaultPrompt : current,
          );
          const loadedBranchTypes =
            prefs.branchTypes.length > 0 ? prefs.branchTypes : FALLBACK_BRANCH_TYPES;
          setBranchTypes(loadedBranchTypes);
          setPrefixChoice((current) =>
            current === OTHER_PREFIX_VALUE || loadedBranchTypes.includes(current)
              ? current
              : (loadedBranchTypes[0] ?? "feature"),
          );
          setUseWorktreeDefault(prefs.useWorktreeByDefault);
          if (!previous.useWorktreeTouched) setUseWorktree(prefs.useWorktreeByDefault);
          setPermissionModeAuto(prefs.useAutoPermissionModeByDefault);
        })
        .catch(() => undefined);
    };
    window.addEventListener(preferencesApi.PREFERENCES_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(preferencesApi.PREFERENCES_CHANGED_EVENT, onChanged);
  }, []);

  const effectivePrefix = prefixChoice === OTHER_PREFIX_VALUE ? customPrefix.trim() : prefixChoice;

  // Derived, so it tracks the Jira id live until the user types their own text.
  const branchSuffix = branchSuffixManual ?? jiraId ?? "";
  const branchName = effectivePrefix ? `${effectivePrefix}/${branchSuffix}` : branchSuffix;

  // A newly chosen folder forgets any manual override of the worktree checkbox. Adjusted during
  // render (not in an effect) so it applies on the same render the folder changes.
  const [lastFolderForWorktreeTouch, setLastFolderForWorktreeTouch] = useState(effectiveFolderPath);
  if (effectiveFolderPath !== lastFolderForWorktreeTouch) {
    setLastFolderForWorktreeTouch(effectiveFolderPath);
    setUseWorktreeTouched(false);
  }

  // Prefills the source branch from the folder's default branch and checks whether its root
  // already has an active session — debounced since typing a path fires this per keystroke.
  useEffect(() => {
    const folder = effectiveFolderPath.trim();
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!folder) {
        setRepoError(null);
        setActiveSessionInRoot(null);
        return;
      }
      setLoadingRepoInfo(true);
      tasksApi
        .fetchRepoInfo(folder)
        .then((info) => {
          if (cancelled) return;
          setRepoError(null);
          if (!baseBranchTouched) setBaseBranch(info.defaultBaseBranch);
          setActiveSessionInRoot(info.hasActiveSessionInRoot);
          // `useWorktreeTouched` is read fresh (not from the closure) since this callback can
          // resolve after a later render set it.
          setUseWorktreeTouched((touched) => {
            if (!touched) setUseWorktree(info.hasActiveSessionInRoot);
            return touched;
          });
        })
        .catch((err) => {
          if (cancelled) return;
          setRepoError(resolveApiErrorMessage(err, t, "newTaskModal.repoInfoError"));
          setActiveSessionInRoot(null);
        })
        .finally(() => {
          if (!cancelled) setLoadingRepoInfo(false);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [effectiveFolderPath, baseBranchTouched, t]);

  // Wipes only what the user filled in; keeps the loaded projects list and preferences.
  const resetForm = useCallback(() => {
    setJiraLink("");
    resetFolder();
    setPromptText(defaultPromptLoaded ?? "");
    setPrefixChoice(branchTypes[0] ?? FALLBACK_BRANCH_TYPES[0] ?? "feature");
    setCustomPrefix("");
    setBranchSuffixManual(null);
    setBaseBranch("master");
    setBaseBranchTouched(false);
    setUseLocalBaseBranch(false);
    setRepoError(null);
    setUseWorktree(useWorktreeDefault);
    setUseWorktreeTouched(false);
    setActiveSessionInRoot(null);
    setSteps([]);
    setExtraRepos([]);
    setUseExtraRepos(false);
  }, [resetFolder, defaultPromptLoaded, branchTypes, useWorktreeDefault]);

  const promptDirty =
    (defaultPromptLoaded !== null && promptText !== defaultPromptLoaded) || !defaultPromptLoaded;

  const handleSaveDefaultPrompt = async () => {
    setSavingDefaultPrompt(true);
    try {
      await preferencesApi.updatePreferences({ defaultPrompt: promptText });
      setDefaultPromptLoaded(promptText);
      showToast(t("newTaskModal.promptSaved"), "success");
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "newTaskModal.promptSaveError"), "error");
    } finally {
      setSavingDefaultPrompt(false);
    }
  };

  // Whether the checkbox differs from the stored default — gates the "Use as default" link.
  const worktreeDefaultDirty = useWorktree !== useWorktreeDefault;

  const handleSaveWorktreeDefault = async () => {
    setSavingWorktreeDefault(true);
    try {
      const nextUseWorktreeDefault = useWorktree;
      await preferencesApi.updatePreferences({ useWorktreeByDefault: nextUseWorktreeDefault });
      setUseWorktreeDefault(nextUseWorktreeDefault);
      showToast(t("newTaskModal.worktreePrefSaved"), "success");
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "newTaskModal.worktreePrefSaveError"), "error");
    } finally {
      setSavingWorktreeDefault(false);
    }
  };

  const trimmedFolder = effectiveFolderPath.trim();
  const trimmedBranch = branchName.trim();
  const trimmedBase = baseBranch.trim();
  const trimmedPrompt = promptText.trim();
  // The Jira link is the only required field.
  const canSubmit =
    jiraLink.trim().length > 0 && !creating && (extraRepos.length === 0 || jiraId !== null);

  return {
    jiraLink,
    setJiraLink,
    jiraId,
    folders,
    loadingPrompt,
    promptText,
    setPromptText,
    promptDirty,
    savingDefaultPrompt,
    handleSaveDefaultPrompt,
    branchTypes,
    setBranchTypes,
    prefixChoice,
    setPrefixChoice,
    customPrefix,
    setCustomPrefix,
    effectivePrefix,
    branchSuffix,
    setBranchSuffixManual,
    branchName,
    baseBranch,
    setBaseBranch,
    setBaseBranchTouched,
    useLocalBaseBranch,
    setUseLocalBaseBranch,
    loadingRepoInfo,
    repoError,
    useWorktree,
    setUseWorktree,
    useWorktreeTouched,
    setUseWorktreeTouched,
    worktreeDefaultDirty,
    savingWorktreeDefault,
    handleSaveWorktreeDefault,
    activeSessionInRoot,
    permissionModeAuto,
    setPermissionModeAuto,
    creating,
    setCreating,
    steps,
    setSteps,
    extraRepos,
    setExtraRepos,
    useExtraRepos,
    setUseExtraRepos,
    trimmedFolder,
    trimmedBranch,
    trimmedBase,
    trimmedPrompt,
    canSubmit,
    resetForm,
  };
}

export type NewTaskForm = ReturnType<typeof useNewTaskForm>;
