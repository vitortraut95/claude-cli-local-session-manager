import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  GitBranch,
  Info,
  Link as LinkIcon,
  Loader2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useProjectFolders } from "../hooks/useProjectFolders";
import { useSkillsHubStatus } from "../hooks/useSkillsHubStatus";
import { useToast } from "../hooks/useToast";
import type { TranslationKey } from "../i18n/translations";
import * as tasksApi from "../services/tasksApi";
import { Button } from "./Button";
import { Input } from "./Input";
import { Modal } from "./Modal";
import { ProjectFolderField } from "./ProjectFolderField";
import { type ExtraRepo, ExtraReposField } from "./ExtraReposField";
import { Select } from "./Select";
import { SkillsHubModal } from "./SkillsHubModal";
import { SkillsHubPanel } from "./SkillsHubPanel";
import { resolveApiErrorMessage } from "../utils/apiClient";

type NewTaskModalProps = {
  open: boolean;
  onClose: () => void;
  /** Fired after a successful launch so the session list picks up the new session. */
  onTaskCreated?: () => void;
};

const OTHER_PREFIX_VALUE = "__other__";
// Fallback until userPreferences.json's `branchTypes` loads.
const FALLBACK_BRANCH_TYPES = ["feature", "fix"];

/** Matches a Jira-style ticket key both in a bare form ("PROJ-123") and inside a full browse URL
 *  ("https://company.atlassian.net/browse/PROJ-123?foo=bar"). */
const JIRA_ID_PATTERN = /([A-Za-z][A-Za-z0-9]+-\d+)/;

function extractJiraId(link: string): string | null {
  const match = JIRA_ID_PATTERN.exec(link.trim());
  return match?.[1] ? match[1].toUpperCase() : null;
}

const TEXTAREA_CLASSNAME =
  "w-full rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900 placeholder:text-gray-400 " +
  "focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 " +
  "dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-gray-600 " +
  "dark:focus:ring-gray-100/10";

type StepStatus = "pending" | "doing" | "done" | "error";
type StepKey = "repo" | "base" | "worktree" | "launch";
/** `key` is a StepKey, or `extra:<path>` for one of the task's extra repos. */
type Step = { key: string; label: string; status: StepStatus; error?: string };

const STEP_LABEL_KEYS: Record<StepKey, TranslationKey> = {
  repo: "newTaskModal.step.repo",
  base: "newTaskModal.step.base",
  worktree: "newTaskModal.step.worktree",
  launch: "newTaskModal.step.launch",
};
const STEP_ORDER: StepKey[] = ["repo", "base", "worktree", "launch"];

/** The "worktree" step's label changes when the "no worktree" checkbox is on. */
function getStepLabelKey(key: StepKey, useWorktree: boolean): TranslationKey {
  if (key === "worktree" && !useWorktree) {
    return "newTaskModal.step.worktreeNoWorktree";
  }
  return STEP_LABEL_KEYS[key];
}

/**
 * Always mounted (toggled via `open`) so an accidental close doesn't lose what the user typed;
 * only `resetForm` (Clear button, successful create) wipes it.
 */
export function NewTaskModal({ open, onClose, onTaskCreated }: NewTaskModalProps) {
  const { showToast } = useToast();
  const { t } = useLanguage();

  const jiraLinkInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (open) jiraLinkInputRef.current?.focus();
  }, [open]);

  const [jiraLink, setJiraLink] = useState("");
  const jiraId = useMemo(() => extractJiraId(jiraLink), [jiraLink]);

  const folders = useProjectFolders(open);
  const { effectiveFolderPath, resetFolder } = folders;

  const [defaultPromptLoaded, setDefaultPromptLoaded] = useState<string | null>(null);
  const [loadingPrompt, setLoadingPrompt] = useState(true);
  const [promptText, setPromptText] = useState("");
  const [savingDefaultPrompt, setSavingDefaultPrompt] = useState(false);

  // Options of the "Branch type" select, from userPreferences.json; a custom ("Other") type used
  // to create a task is prepended (see handleCreate).
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

  // Remembered as whatever it was last left at (see handleCreate); no separate draft value.
  const [permissionModeAuto, setPermissionModeAuto] = useState(false);

  const [creating, setCreating] = useState(false);
  // Empty while idle; filled with every step ("pending") when a create attempt starts, so the
  // modal shows which step is running, finished, or failed.
  const [steps, setSteps] = useState<Step[]>([]);
  const [extraRepos, setExtraRepos] = useState<ExtraRepo[]>([]);
  const [useExtraRepos, setUseExtraRepos] = useState(false);

  // Team skills hub status, reloaded on every open — display only, never updated while creating a
  // task.
  const { status: skillsHub, failed: skillsHubFailed } = useSkillsHubStatus(open);
  const [skillsHubModalOpen, setSkillsHubModalOpen] = useState(false);

  // Fetched once on mount, not on every open — re-seeding on open would clobber in-progress input
  // across an accidental close.
  useEffect(() => {
    let cancelled = false;
    tasksApi
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
      tasksApi
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
    window.addEventListener(tasksApi.PREFERENCES_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(tasksApi.PREFERENCES_CHANGED_EVENT, onChanged);
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
      await tasksApi.updatePreferences({ defaultPrompt: promptText });
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
      await tasksApi.updatePreferences({ useWorktreeByDefault: nextUseWorktreeDefault });
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
  // Auto nickname: the full pasted Jira link, so it stays clickable/copyable.
  const autoNickname = jiraLink.trim();
  // The Jira link is the only required field.
  const canSubmit =
    jiraLink.trim().length > 0 && !creating && (extraRepos.length === 0 || jiraId !== null);

  const updateStep = (key: string, status: StepStatus, error?: string) => {
    setSteps((current) =>
      current.map((step) => (step.key === key ? { ...step, status, error } : step)),
    );
  };

  /**
   * Runs the steps in sequence, updating `steps` for the live checklist. A failure stops there,
   * marks that step "error" and leaves the modal open with the checklist visible.
   */
  const handleCreate = async () => {
    if (!canSubmit) return;
    setCreating(true);
    const extras = extraRepos;
    const stepFor = (key: StepKey): Step => ({
      key,
      label: t(getStepLabelKey(key, useWorktree)),
      status: "pending",
    });
    setSteps([
      ...STEP_ORDER.filter((key) => key !== "launch").map(stepFor),
      ...extras.map((repo) => ({
        key: `extra:${repo.path}`,
        label: t("newTaskModal.step.extraRepo", { project: repo.label }),
        status: "pending" as const,
      })),
      stepFor("launch"),
    ]);

    const composedPrompt = [
      jiraLink.trim() ? `${t("newTaskModal.taskPrefix")}: ${jiraLink.trim()}` : null,
      trimmedPrompt,
    ]
      .filter((part): part is string => Boolean(part))
      .join("\n\n");

    try {
      updateStep("repo", "doing");
      const repoInfo = await tasksApi.fetchRepoInfo(trimmedFolder);
      updateStep("repo", "done");

      updateStep("base", "doing");
      const { baseBranchRef } = await tasksApi.resolveBaseBranch(
        trimmedFolder,
        trimmedBase,
        useLocalBaseBranch,
      );
      updateStep("base", "done");

      updateStep("worktree", "doing");
      const { worktreePath } = await tasksApi.createTaskWorktree(
        trimmedFolder,
        trimmedBranch,
        baseBranchRef,
        trimmedBase,
        useWorktree,
        jiraId ?? "",
        jiraLink.trim(),
      );
      updateStep("worktree", "done");

      // Extra repos: a failure in one doesn't stop the others or the main launch.
      const addDirs: string[] = [];
      let extraFailed = false;
      for (const repo of extras) {
        const key = `extra:${repo.path}`;
        updateStep(key, "doing");
        try {
          const result = await tasksApi.addRepoToTask(jiraId ?? "", {
            folderPath: repo.path,
            branchName: trimmedBranch,
            baseBranch: repo.baseBranch.trim(),
            useLocalBranch: false,
            taskLink: jiraLink.trim(),
          });
          addDirs.push(result.workingDirectory);
          updateStep(key, "done");
        } catch (err) {
          extraFailed = true;
          updateStep(key, "error", resolveApiErrorMessage(err, t, "taskModal.addRepo.error"));
        }
      }
      const mainPrompt =
        addDirs.length > 0
          ? `${composedPrompt}\n\n${t("newTaskModal.extraRepos.promptNote", {
              dirs: addDirs.join(", "),
            })}`
          : composedPrompt;

      updateStep("launch", "doing");
      await tasksApi.launchTaskTerminal(
        worktreePath,
        mainPrompt,
        permissionModeAuto,
        repoInfo.repoRoot,
        autoNickname,
        trimmedBase,
        trimmedBranch,
        jiraId ?? "",
        addDirs,
      );
      updateStep("launch", "done");

      // Both auto-remembered fields go in one `updatePreferences` call — each call does its own
      // fetch-merge-PUT, so two concurrent calls would race and one would overwrite the other.
      const preferencesUpdate: Partial<tasksApi.UserPreferences> = {
        useAutoPermissionModeByDefault: permissionModeAuto,
      };

      // A used custom ("Outro") branch type is prepended, becoming the default selection
      // (branchTypes[0]).
      if (
        prefixChoice === OTHER_PREFIX_VALUE &&
        effectivePrefix &&
        !branchTypes.includes(effectivePrefix)
      ) {
        const updatedBranchTypes = [effectivePrefix, ...branchTypes];
        setBranchTypes(updatedBranchTypes);
        preferencesUpdate.branchTypes = updatedBranchTypes;
      }

      // Best-effort — a failure here doesn't undo the created task.
      tasksApi.updatePreferences(preferencesUpdate).catch(() => {
        // Still usable for the rest of this session even if persisting it failed.
      });

      // A real form submission makes the browser save each input's value to its autocomplete
      // history — see the <form> below.
      formRef.current?.requestSubmit();

      if (extraFailed) {
        // Keep the checklist visible: the main session is up, but some extra repo isn't.
        showToast(t("newTaskModal.extraRepos.partialFailure"), "error");
        onTaskCreated?.();
        return;
      }
      showToast(t("newTaskModal.terminalOpened"), "success");
      resetForm();
      onClose();
      onTaskCreated?.();
    } catch (err) {
      const message = resolveApiErrorMessage(err, t, "newTaskModal.unexpectedFailure");
      setSteps((current) =>
        current.map((step) =>
          step.status === "doing" ? { ...step, status: "error", error: message } : step,
        ),
      );
      showToast(t("newTaskModal.createFailed", { message }), "error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t("newTaskModal.title")}
      // Escape would otherwise close this modal too while the skills modal is open on top of it.
      onClose={() => {
        if (!skillsHubModalOpen) onClose();
      }}
      onCancel={onClose}
      onConfirm={handleCreate}
      confirmLabel={t("newTaskModal.confirm")}
      cancelLabel={t("newTaskModal.cancel")}
      isConfirmLoading={creating}
      isConfirmDisabled={!canSubmit}
      onSecondary={resetForm}
      secondaryLabel={t("newTaskModal.clear")}
      size="xxxl"
    >
      {/* The browser only saves autocomplete values on a real form submission (not a React
          `preventDefault()` one), so after a successful create the form is submitted into a hidden
          iframe at about:blank. With no submit button, Enter doesn't submit implicitly. */}
      <iframe name="new-task-autocomplete-sink" title="" hidden />
      <form
        ref={formRef}
        action="about:blank"
        method="get"
        target="new-task-autocomplete-sink"
        className="flex flex-col gap-4"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            {t("newTaskModal.jiraLinkLabel")}
          </label>
          <Input
            ref={jiraLinkInputRef}
            type="text"
            icon={<LinkIcon className="h-4 w-4" />}
            value={jiraLink}
            onChange={(event) => setJiraLink(event.target.value)}
            placeholder="https://company.atlassian.net/browse/PROJ-123"
            name="newTaskJiraLink"
          />
        </div>

        <ProjectFolderField
          folders={folders}
          inputName="newTaskFolderPath"
          loadingRepoInfo={loadingRepoInfo}
          repoError={repoError}
        />
        <ExtraReposField
          projects={folders.projects}
          mainFolder={trimmedFolder}
          branchName={trimmedBranch}
          value={extraRepos}
          onChange={setExtraRepos}
          disabled={jiraId === null}
          onBlockedAdd={() => {
            showToast(t("newTaskModal.extraRepos.needsLinkFirst"), "error");
            jiraLinkInputRef.current?.focus();
          }}
          enabled={useExtraRepos}
          onEnabledChange={(enabled) => {
            setUseExtraRepos(enabled);
            if (!enabled) setExtraRepos([]);
          }}
        />

        <SkillsHubPanel
          status={skillsHub}
          failed={skillsHubFailed}
          onManage={() => setSkillsHubModalOpen(true)}
        />

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {t("newTaskModal.promptLabel")}
            </label>
            {promptDirty && (
              <Button
                variant="link"
                size="none"
                onClick={handleSaveDefaultPrompt}
                disabled={savingDefaultPrompt}
              >
                {savingDefaultPrompt ? t("newTaskModal.saving") : t("newTaskModal.saveAsDefault")}
              </Button>
            )}
          </div>
          <textarea
            value={promptText}
            onChange={(event) => setPromptText(event.target.value)}
            placeholder={
              loadingPrompt
                ? t("newTaskModal.loadingDefaultPrompt")
                : t("newTaskModal.promptPlaceholder")
            }
            rows={5}
            className={TEXTAREA_CLASSNAME}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              {t("newTaskModal.baseBranchLabel")}
            </label>
            <Input
              type="text"
              value={baseBranch}
              onChange={(event) => {
                setBaseBranch(event.target.value);
                setBaseBranchTouched(true);
              }}
              placeholder="master/main/other"
              name="newTaskBaseBranch"
            />
            <label className="mt-1 flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
              <input
                type="checkbox"
                checked={useLocalBaseBranch}
                onChange={(event) => setUseLocalBaseBranch(event.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-gray-900 dark:accent-gray-100"
              />
              {t("newTaskModal.useLocalBaseBranchLabel")}
            </label>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              {t("newTaskModal.branchTypeLabel")}
            </label>
            <Select value={prefixChoice} onChange={(event) => setPrefixChoice(event.target.value)}>
              {branchTypes.map((prefix) => (
                <option key={prefix} value={prefix}>
                  {prefix}
                </option>
              ))}
              <option value={OTHER_PREFIX_VALUE}>{t("newTaskModal.otherBranchType")}</option>
            </Select>
            {prefixChoice === OTHER_PREFIX_VALUE && (
              <Input
                type="text"
                value={customPrefix}
                onChange={(event) => setCustomPrefix(event.target.value)}
                placeholder={t("newTaskModal.customPrefixPlaceholder")}
                name="newTaskBranchType"
                className="mt-2"
              />
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              {t("newTaskModal.branchNameLabel")}
            </label>
            <Input
              type="text"
              icon={<GitBranch className="h-4 w-4" />}
              value={branchSuffix}
              onChange={(event) => setBranchSuffixManual(event.target.value)}
              placeholder="PROJ-123"
              name="newTaskBranchName"
            />
            {branchName && (
              <p className="mt-1 flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                {t("newTaskModal.branchPreview")}
                <span className="font-mono text-gray-600 dark:text-gray-300">{branchName}</span>
              </p>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={useWorktree}
                onChange={(event) => {
                  setUseWorktree(event.target.checked);
                  setUseWorktreeTouched(true);
                }}
                className="mt-0.5 h-4 w-4 shrink-0 accent-gray-900 dark:accent-gray-100"
              />
              {t("newTaskModal.useWorktreeLabel")}
            </label>
            {worktreeDefaultDirty && (
              <Button
                variant="link"
                size="none"
                onClick={handleSaveWorktreeDefault}
                disabled={savingWorktreeDefault}
                className="shrink-0"
              >
                {savingWorktreeDefault ? t("newTaskModal.saving") : t("newTaskModal.useAsDefault")}
              </Button>
            )}
          </div>

          <p className="mt-1 pl-6 text-xs text-gray-500 dark:text-gray-400">
            {t("newTaskModal.worktreeAutoExplanation")}
          </p>

          {loadingRepoInfo && (
            <p className="mt-1 pl-6 flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
              <Loader2 className="h-3 w-3 animate-spin" /> {t("newTaskModal.checkingActiveSession")}
            </p>
          )}

          {!loadingRepoInfo && activeSessionInRoot === true && !useWorktreeTouched && (
            <p className="mt-2 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-2 text-xs text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-400">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t("newTaskModal.activeSessionDetected")}
            </p>
          )}

          {!loadingRepoInfo && activeSessionInRoot === false && (
            <p className="mt-1 pl-6 text-xs text-gray-400 dark:text-gray-500">
              {t("newTaskModal.noActiveSessionDetected")}
            </p>
          )}

          {!useWorktree && (
            <p className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t("newTaskModal.noWorktreeWarning")}
            </p>
          )}
        </div>

        <div>
          <label className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={permissionModeAuto}
              onChange={(event) => setPermissionModeAuto(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-gray-900 dark:accent-gray-100"
            />
            {t("newTaskModal.permissionModeAutoLabel")}
          </label>
          <p className="mt-1 pl-6 text-xs text-gray-500 dark:text-gray-400">
            {t("newTaskModal.permissionModeAutoExplanation")}
          </p>
        </div>

        {steps.length > 0 ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/50">
            <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("newTaskModal.progressLabel")}
            </p>
            <ol className="space-y-2">
              {steps.map((step) => (
                <li key={step.key} className="flex items-start gap-2">
                  {step.status === "pending" && (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />
                  )}
                  {step.status === "doing" && (
                    <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-gray-500 dark:text-gray-400" />
                  )}
                  {step.status === "done" && (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-500" />
                  )}
                  {step.status === "error" && (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-500" />
                  )}
                  <div>
                    <p
                      className={`text-sm ${
                        step.status === "pending"
                          ? "text-gray-400 dark:text-gray-500"
                          : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {step.label}
                    </p>
                    {step.status === "error" && step.error && (
                      <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{step.error}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-400">
            <p className="mb-2 font-medium text-gray-700 dark:text-gray-300">
              {t("newTaskModal.whatWillHappen")}
            </p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                {t("newTaskModal.explain.repo.pre")}{" "}
                <span className="font-mono text-gray-800 dark:text-gray-200">
                  {trimmedFolder || t("newTaskModal.explain.folderPlaceholder")}
                </span>{" "}
                {t("newTaskModal.explain.repo.post")}
              </li>
              <li>
                {t(
                  useLocalBaseBranch
                    ? "newTaskModal.explain.base.pre.local"
                    : "newTaskModal.explain.base.pre.remote",
                )}{" "}
                <span className="font-mono text-gray-800 dark:text-gray-200">
                  {trimmedBase || t("newTaskModal.explain.basePlaceholder")}
                </span>{" "}
                {t(
                  useLocalBaseBranch
                    ? "newTaskModal.explain.base.post.local"
                    : "newTaskModal.explain.base.post.remote",
                )}
              </li>
              <li>
                {t("newTaskModal.explain.branch.pre")}{" "}
                <span className="font-mono text-gray-800 dark:text-gray-200">
                  {trimmedBranch || t("newTaskModal.explain.branchPlaceholder")}
                </span>{" "}
                {t("newTaskModal.explain.branch.post")}
              </li>
              <li>
                {useWorktree
                  ? t("newTaskModal.explain.worktree.create")
                  : t("newTaskModal.explain.worktree.skip")}
              </li>
              <li>
                {t("newTaskModal.explain.launch.pre")}{" "}
                {useWorktree
                  ? t("newTaskModal.explain.launch.insideWorktree")
                  : t("newTaskModal.explain.launch.inProjectFolder")}{" "}
                {t("newTaskModal.explain.launch.and")} <code>claude</code>{" "}
                {t("newTaskModal.explain.launch.post")}
              </li>
            </ol>
          </div>
        )}
      </form>
      {skillsHubModalOpen && <SkillsHubModal onClose={() => setSkillsHubModalOpen(false)} />}
    </Modal>
  );
}
