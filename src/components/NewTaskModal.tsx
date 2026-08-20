import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Folder,
  GitBranch,
  Link as LinkIcon,
  Loader2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useToast } from "../hooks/useToast";
import type { TranslationKey } from "../i18n/translations";
import * as tasksApi from "../services/tasksApi";
import type { ProjectFolderOption } from "../services/tasksApi";
import { Button } from "./Button";
import { Input } from "./Input";
import { Modal } from "./Modal";
import { Select } from "./Select";
import { resolveApiErrorMessage } from "../utils/apiClient";

type NewTaskModalProps = {
  open: boolean;
  onClose: () => void;
  /** Fired right after a successful launch so the page's session list picks up the new
   *  worktree/session as soon as it exists — not called on a failed/aborted create. */
  onTaskCreated?: () => void;
};

const OTHER_FOLDER_VALUE = "__other__";
const OTHER_PREFIX_VALUE = "__other__";
// Just the pre-load fallback shown before userPreferences.json's own `branchTypes` arrives (see
// the preferences-fetch effect below) — the real, user-editable list lives in that file.
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
type Step = { key: StepKey; label: string; status: StepStatus; error?: string };

const STEP_LABEL_KEYS: Record<StepKey, TranslationKey> = {
  repo: "newTaskModal.step.repo",
  base: "newTaskModal.step.base",
  worktree: "newTaskModal.step.worktree",
  launch: "newTaskModal.step.launch",
};
const STEP_ORDER: StepKey[] = ["repo", "base", "worktree", "launch"];

/** The "worktree" step's label changes when the "no worktree" checkbox is on — the other three
 *  steps read the same regardless. */
function getStepLabelKey(key: StepKey, useWorktree: boolean): TranslationKey {
  if (key === "worktree" && !useWorktree) {
    return "newTaskModal.step.worktreeNoWorktree";
  }
  return STEP_LABEL_KEYS[key];
}

/**
 * Always mounted (Header renders it unconditionally, toggling `open`) rather than the
 * mount-on-open convention other modals use — an accidental close (Escape, backdrop click, the
 * X button) must not lose whatever the user already typed, so state has to survive across
 * `open` going false and true again. `resetForm` (used by the Clear button and after a
 * successful create) is the only thing that intentionally wipes it.
 */
export function NewTaskModal({ open, onClose, onTaskCreated }: NewTaskModalProps) {
  const { showToast } = useToast();
  const { t } = useLanguage();

  const jiraLinkInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) jiraLinkInputRef.current?.focus();
  }, [open]);

  const [jiraLink, setJiraLink] = useState("");
  const jiraId = useMemo(() => extractJiraId(jiraLink), [jiraLink]);

  const [projects, setProjects] = useState<ProjectFolderOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [folderChoice, setFolderChoice] = useState("");
  const [customFolderPath, setCustomFolderPath] = useState("");

  const [defaultPromptLoaded, setDefaultPromptLoaded] = useState<string | null>(null);
  const [loadingPrompt, setLoadingPrompt] = useState(true);
  const [promptText, setPromptText] = useState("");
  const [savingDefaultPrompt, setSavingDefaultPrompt] = useState(false);

  // The user-editable list backing the "Branch type" select — loaded from userPreferences.json
  // and grown automatically (see handleCreate) whenever a task is created with a custom ("Other")
  // type, so it shows up as a normal option next time without any separate management step.
  const [branchTypes, setBranchTypes] = useState<string[]>(FALLBACK_BRANCH_TYPES);
  const [prefixChoice, setPrefixChoice] = useState<string>(FALLBACK_BRANCH_TYPES[0] ?? "feature");
  const [customPrefix, setCustomPrefix] = useState("");
  // null means "not yet edited by hand" — the branch suffix field then tracks the Jira id
  // automatically. Once the user types into it, it holds their exact text from then on. The
  // prefix is kept separate so switching it never has to touch this field at all — the full
  // branch name (prefix + suffix) is only ever computed for display/submission, below.
  const [branchSuffixManual, setBranchSuffixManual] = useState<string | null>(null);

  const [baseBranch, setBaseBranch] = useState("master");
  const [baseBranchTouched, setBaseBranchTouched] = useState(false);
  const [loadingRepoInfo, setLoadingRepoInfo] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);

  // Default false — the collision-free worktree path stays the default; checking this opts into
  // checking the new branch out directly in the project folder instead. `useWorktreeDefault`
  // mirrors userPreferences.json's stored default (see the preferences-fetch effect and
  // `handleSaveWorktreeDefault` below); `skipWorktree` is this form's own live, possibly-unsaved
  // draft of it — kept separate the same way `promptText`/`defaultPromptLoaded` are for the prompt.
  const [skipWorktree, setSkipWorktree] = useState(false);
  const [useWorktreeDefault, setUseWorktreeDefault] = useState(true);
  const [savingWorktreeDefault, setSavingWorktreeDefault] = useState(false);

  // No separate "draft vs. saved default" split like skipWorktree/promptText above — this is
  // just remembered as whatever it was last left at (see handleCreate), so there's nothing to
  // preserve across an accidental close that the loaded preference itself doesn't already cover.
  const [permissionModeAuto, setPermissionModeAuto] = useState(false);

  const [creating, setCreating] = useState(false);
  // Empty while idle — the static "what will happen" explanation renders instead. Populated with
  // all four steps (each "pending") right when a create attempt starts, so the modal always shows
  // exactly which step is running, finished, or failed rather than one opaque success/failure.
  const [steps, setSteps] = useState<Step[]>([]);

  // Re-fetched every time the modal opens (not just once on mount) — a project folder typed by
  // hand into "Outro" during task creation only becomes a known option once its new session's
  // `.jsonl` exists, so re-running this on open is the only way a just-used repo shows up in the
  // dropdown next time without a full page reload. Deferred via a 0ms timer so its setState calls
  // happen in a callback, not synchronously in the effect body itself.
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

  // Fetched once on mount (not on every open, unlike the project-folder list above) — the loaded
  // values only ever seed the form's initial state, and re-running this on every open would
  // clobber whatever the user already typed/picked across an accidental close, exactly what the
  // "always mounted" doc comment above is there to prevent.
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
        setSkipWorktree(!prefs.useWorktreeByDefault);
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

  const effectivePrefix = prefixChoice === OTHER_PREFIX_VALUE ? customPrefix.trim() : prefixChoice;
  const effectiveFolderPath =
    folderChoice === OTHER_FOLDER_VALUE || projects.length === 0 ? customFolderPath : folderChoice;

  // Derived (not effect-driven) so it's always reflected live, right up until the user types
  // their own text into the field.
  const branchSuffix = branchSuffixManual ?? jiraId ?? "";
  const branchName = effectivePrefix ? `${effectivePrefix}/${branchSuffix}` : branchSuffix;

  // Prefills the source branch from the selected folder's actual default (main/master/whatever
  // origin/HEAD points at) — debounced since typing a custom path fires this on every keystroke.
  // The state updates all happen inside the timeout callback (not synchronously in the effect
  // body) since they're a response to the async fetch settling, not a direct render-time sync.
  useEffect(() => {
    const folder = effectiveFolderPath.trim();
    const timer = setTimeout(() => {
      if (!folder) {
        setRepoError(null);
        return;
      }
      setLoadingRepoInfo(true);
      tasksApi
        .fetchRepoInfo(folder)
        .then((info) => {
          setRepoError(null);
          if (!baseBranchTouched) setBaseBranch(info.defaultBaseBranch);
        })
        .catch((err) => {
          setRepoError(resolveApiErrorMessage(err, t, "newTaskModal.repoInfoError"));
        })
        .finally(() => setLoadingRepoInfo(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [effectiveFolderPath, baseBranchTouched, t]);

  // Used both by the Clear button and after a successful create — keeps the loaded projects list
  // and preferences (no need to refetch either), only wipes what the user filled in.
  const resetForm = useCallback(() => {
    setJiraLink("");
    setFolderChoice(projects.length === 0 ? OTHER_FOLDER_VALUE : "");
    setCustomFolderPath("");
    setPromptText(defaultPromptLoaded ?? "");
    setPrefixChoice(branchTypes[0] ?? FALLBACK_BRANCH_TYPES[0] ?? "feature");
    setCustomPrefix("");
    setBranchSuffixManual(null);
    setBaseBranch("main");
    setBaseBranchTouched(false);
    setRepoError(null);
    setSkipWorktree(!useWorktreeDefault);
    setSteps([]);
  }, [projects, defaultPromptLoaded, branchTypes, useWorktreeDefault]);

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

  // Whether the "don't use worktree" checkbox's current value differs from the stored default —
  // mirrors `promptDirty`'s role for the prompt, gating the "Use as default" link below.
  const worktreeDefaultDirty = !skipWorktree !== useWorktreeDefault;

  const handleSaveWorktreeDefault = async () => {
    setSavingWorktreeDefault(true);
    try {
      const nextUseWorktreeDefault = !skipWorktree;
      await tasksApi.updatePreferences({ useWorktreeByDefault: nextUseWorktreeDefault });
      setUseWorktreeDefault(nextUseWorktreeDefault);
      showToast(t("newTaskModal.worktreePrefSaved"), "success");
    } catch (err) {
      showToast(
        resolveApiErrorMessage(err, t, "newTaskModal.worktreePrefSaveError"),
        "error",
      );
    } finally {
      setSavingWorktreeDefault(false);
    }
  };

  const trimmedFolder = effectiveFolderPath.trim();
  const trimmedBranch = branchName.trim();
  const trimmedBase = baseBranch.trim();
  const trimmedPrompt = promptText.trim();
  const finalPromptPreview = [jiraLink.trim() ? `${t("newTaskModal.taskPrefix")}: ${jiraLink.trim()}` : null, trimmedPrompt]
    .filter((part): part is string => Boolean(part))
    .join("\n\n");
  // Every other field is always visible now (no more link-gated reveal — see the render below),
  // but the Jira link is the only one still required to submit: it's the one piece of information
  // the rest of the form can't reasonably default/infer on its own.
  const canSubmit = jiraLink.trim().length > 0 && !creating;

  const updateStep = (key: StepKey, status: StepStatus, error?: string) => {
    setSteps((current) =>
      current.map((step) => (step.key === key ? { ...step, status, error } : step)),
    );
  };

  /**
   * Runs the four steps in sequence, each awaited before the next starts, updating `steps` as it
   * goes — this is what powers the live checklist below (see STEP_ORDER/STEP_LABELS). A failure at
   * any step stops the sequence right there (steps after it stay "pending", never attempted), marks
   * that one step "error" with the server's message, and leaves the modal open with the checklist
   * visible so it's obvious exactly where things stopped — no resetForm()/onClose() on failure,
   * unlike a clean run.
   */
  const handleCreate = async () => {
    if (!canSubmit) return;
    setCreating(true);
    setSteps(
      STEP_ORDER.map((key) => ({
        key,
        label: t(getStepLabelKey(key, !skipWorktree)),
        status: "pending",
      })),
    );

    const composedPrompt = [jiraLink.trim() ? `${t("newTaskModal.taskPrefix")}: ${jiraLink.trim()}` : null, trimmedPrompt]
      .filter((part): part is string => Boolean(part))
      .join("\n\n");

    try {
      updateStep("repo", "doing");
      const repoInfo = await tasksApi.fetchRepoInfo(trimmedFolder);
      updateStep("repo", "done");

      updateStep("base", "doing");
      const { baseBranchRef } = await tasksApi.resolveBaseBranch(trimmedFolder, trimmedBase);
      updateStep("base", "done");

      updateStep("worktree", "doing");
      const { worktreePath } = await tasksApi.createTaskWorktree(
        trimmedFolder,
        trimmedBranch,
        baseBranchRef,
        trimmedBase,
        !skipWorktree,
      );
      updateStep("worktree", "done");

      updateStep("launch", "doing");
      await tasksApi.launchTaskTerminal(
        worktreePath,
        composedPrompt,
        permissionModeAuto,
        repoInfo.repoRoot,
      );
      updateStep("launch", "done");

      // Both auto-remembered fields below are folded into one `updatePreferences` call — each
      // call does its own fetch-current-then-merge-then-PUT round trip (see tasksApi.ts), so two
      // separate fire-and-forget calls here would race: whichever's PUT lands second would
      // overwrite the other's change with the branchTypes/permissionModeAuto value from *its*
      // own (now-stale) fetch. Reproduced directly: a custom branch type used to silently vanish
      // on the very next task-creation because of exactly this race.
      const preferencesUpdate: Partial<tasksApi.UserPreferences> = {
        useAutoPermissionModeByDefault: permissionModeAuto,
      };

      // A custom ("Outro") branch type that was actually used becomes a normal option from now on
      // — no separate "manage branch types" step, it just remembers itself. Prepended, not
      // appended: the most recently added type is the one most likely wanted again next time, so
      // it becomes the new default selection (branchTypes[0]) instead of landing at the end of
      // the list.
      if (
        prefixChoice === OTHER_PREFIX_VALUE &&
        effectivePrefix &&
        !branchTypes.includes(effectivePrefix)
      ) {
        const updatedBranchTypes = [effectivePrefix, ...branchTypes];
        setBranchTypes(updatedBranchTypes);
        preferencesUpdate.branchTypes = updatedBranchTypes;
      }

      // Best-effort/non-blocking — a failure here doesn't undo the task that was just
      // successfully created.
      tasksApi.updatePreferences(preferencesUpdate).catch(() => {
        // Still usable for the rest of this session even if persisting it failed.
      });

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
      onClose={onClose}
      onCancel={onClose}
      onConfirm={handleCreate}
      confirmLabel={t("newTaskModal.confirm")}
      cancelLabel={t("newTaskModal.cancel")}
      isConfirmLoading={creating}
      isConfirmDisabled={!canSubmit}
      onSecondary={resetForm}
      secondaryLabel={t("newTaskModal.clear")}
      size="xl"
    >
      <div className="flex flex-col gap-4">
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
          />
        </div>

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
                {loadingProjects
                  ? t("newTaskModal.loadingProjects")
                  : t("newTaskModal.selectProject")}
              </option>
              {projects.map((project) => (
                <option key={project.path} value={project.path}>
                  {project.label}
                </option>
              ))}
              <option value={OTHER_FOLDER_VALUE}>{t("newTaskModal.otherFolder")}</option>
            </Select>
          )}
          {(folderChoice === OTHER_FOLDER_VALUE || projects.length === 0) && (
            <Input
              type="text"
              icon={<Folder className="h-4 w-4" />}
              value={customFolderPath}
              onChange={(event) => setCustomFolderPath(event.target.value)}
              placeholder="/absolute/path/to/the/project"
              className={projects.length > 0 ? "mt-2" : ""}
            />
          )}
          {loadingRepoInfo && (
            <p className="mt-1 flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
              <Loader2 className="h-3 w-3 animate-spin" /> {t("newTaskModal.readingRepoInfo")}
            </p>
          )}
          {repoError && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{repoError}</p>
          )}
        </div>

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
          <span className="block whitespace-pre-wrap text-xs">
            {t("newTaskModal.finalPromptLabel")}{" "}
            <span className="font-mono text-gray-500 dark:text-gray-400">
              "{finalPromptPreview.slice(0, 160)}
              {finalPromptPreview.length > 160 ? "…" : ""}"
            </span>
          </span>
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
            />
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
                checked={skipWorktree}
                onChange={(event) => setSkipWorktree(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-gray-900 dark:accent-gray-100"
              />
              {t("newTaskModal.skipWorktreeLabel")}
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
          {skipWorktree && (
            <p className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t("newTaskModal.skipWorktreeWarning")}
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
                {t("newTaskModal.explain.base.pre")}{" "}
                <span className="font-mono text-gray-800 dark:text-gray-200">
                  {trimmedBase || t("newTaskModal.explain.basePlaceholder")}
                </span>{" "}
                {t("newTaskModal.explain.base.post")}
              </li>
              <li>
                {t("newTaskModal.explain.branch.pre")}{" "}
                <span className="font-mono text-gray-800 dark:text-gray-200">
                  {trimmedBranch || t("newTaskModal.explain.branchPlaceholder")}
                </span>{" "}
                {t("newTaskModal.explain.branch.post")}
              </li>
              <li>
                {skipWorktree
                  ? t("newTaskModal.explain.worktree.skip")
                  : t("newTaskModal.explain.worktree.create")}
              </li>
              <li>
                {t("newTaskModal.explain.launch.pre")}{" "}
                {skipWorktree
                  ? t("newTaskModal.explain.launch.inProjectFolder")
                  : t("newTaskModal.explain.launch.insideWorktree")}{" "}
                {t("newTaskModal.explain.launch.and")} <code>claude</code>{" "}
                {t("newTaskModal.explain.launch.post")}
              </li>
            </ol>
          </div>
        )}
      </div>
    </Modal>
  );
}
