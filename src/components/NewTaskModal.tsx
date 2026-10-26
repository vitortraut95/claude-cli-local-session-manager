import { Link as LinkIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useNewTaskForm } from "../hooks/useNewTaskForm";
import { useSkillsHubStatus } from "../hooks/useSkillsHubStatus";
import { useToast } from "../hooks/useToast";
import * as preferencesApi from "../services/preferencesApi";
import type { TerminalLayout } from "../services/preferencesApi";
import * as tasksApi from "../services/tasksApi";
import { Input } from "./Input";
import { Modal } from "./Modal";
import { ProjectFolderField } from "./ProjectFolderField";
import { ExtraReposField } from "./ExtraReposField";
import { NewTaskBranchFields } from "./NewTaskBranchFields";
import { NewTaskProgress } from "./NewTaskProgress";
import { NewTaskPromptField } from "./NewTaskPromptField";
import { NewTaskWorktreeField } from "./NewTaskWorktreeField";
import { SkillsHubModal } from "./SkillsHubModal";
import { SkillsHubPanel } from "./SkillsHubPanel";
import { resolveApiErrorMessage } from "../utils/apiClient";
import {
  buildNewTaskSteps,
  extraRepoStepKey,
  joinPromptParts,
  OTHER_PREFIX_VALUE,
} from "../utils/newTask";
import { withDoingStepFailed, withStepStatus, type StepStatus } from "../utils/steps";

type NewTaskModalProps = {
  open: boolean;
  onClose: () => void;
  /** Fired after a successful launch so the session list picks up the new session. */
  onTaskCreated?: () => void;
};

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

  const form = useNewTaskForm(open);
  const {
    jiraLink,
    setJiraLink,
    jiraId,
    folders,
    trimmedFolder,
    trimmedBranch,
    trimmedBase,
    trimmedPrompt,
    useLocalBaseBranch,
    useWorktree,
    permissionModeAuto,
    setPermissionModeAuto,
    prefixChoice,
    effectivePrefix,
    branchTypes,
    setBranchTypes,
    extraRepos,
    setExtraRepos,
    useExtraRepos,
    setUseExtraRepos,
    creating,
    setCreating,
    setSteps,
    canSubmit,
    resetForm,
  } = form;

  // Team skills hub status, reloaded on every open — display only, never updated while creating a
  // task.
  const { status: skillsHub, failed: skillsHubFailed } = useSkillsHubStatus(open);
  const [skillsHubModalOpen, setSkillsHubModalOpen] = useState(false);

  // Auto nickname: the full pasted Jira link, so it stays clickable/copyable.
  const autoNickname = jiraLink.trim();

  const updateStep = (key: string, status: StepStatus, error?: string) => {
    setSteps((current) => withStepStatus(current, key, status, error));
  };

  /**
   * Runs the steps in sequence, updating `steps` for the live checklist. A failure stops there,
   * marks that step "error" and leaves the modal open with the checklist visible.
   */
  const handleCreate = async (layout?: TerminalLayout) => {
    if (!canSubmit) return;
    setCreating(true);
    const extras = extraRepos;
    setSteps(buildNewTaskSteps(t, useWorktree, extras));

    const composedPrompt = joinPromptParts([
      jiraLink.trim() ? `${t("newTaskModal.taskPrefix")}: ${jiraLink.trim()}` : null,
      trimmedPrompt,
    ]);

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
      const { worktreePath, setup } = await tasksApi.createTaskWorktree(
        trimmedFolder,
        trimmedBranch,
        baseBranchRef,
        trimmedBase,
        useWorktree,
        jiraId ?? "",
        jiraLink.trim(),
      );
      updateStep("worktree", "done");

      // Absolute paths of node_modules symlinked from the main checkouts — the session is warned.
      const linkedNodeModules = (setup?.linked ?? []).map((rel) => `${worktreePath}/${rel}`);

      // Extra repos: a failure in one doesn't stop the others or the main launch.
      const addDirs: string[] = [];
      let extraFailed = false;
      for (const repo of extras) {
        const key = extraRepoStepKey(repo.path);
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
          linkedNodeModules.push(
            ...(result.setup?.linked ?? []).map((rel) => `${result.workingDirectory}/${rel}`),
          );
          updateStep(key, "done");
        } catch (err) {
          extraFailed = true;
          updateStep(key, "error", resolveApiErrorMessage(err, t, "taskModal.addRepo.error"));
        }
      }
      const mainPrompt = joinPromptParts([
        composedPrompt,
        addDirs.length > 0
          ? t("newTaskModal.extraRepos.promptNote", { dirs: addDirs.join(", ") })
          : null,
        linkedNodeModules.length > 0
          ? t("newTaskModal.sharedNodeModulesNote", { dirs: linkedNodeModules.join(", ") })
          : null,
      ]);

      updateStep("launch", "doing");
      await tasksApi.launchTaskTerminal(
        worktreePath,
        mainPrompt,
        permissionModeAuto,
        repoInfo.repoRoot,
        autoNickname,
        trimmedBase,
        trimmedBranch,
        addDirs,
        layout,
      );
      updateStep("launch", "done");

      // Both auto-remembered fields go in one `updatePreferences` call — each call does its own
      // fetch-merge-PUT, so two concurrent calls would race and one would overwrite the other.
      const preferencesUpdate: Partial<preferencesApi.UserPreferences> = {
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
      preferencesApi.updatePreferences(preferencesUpdate).catch(() => {
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
      setSteps((current) => withDoingStepFailed(current, message));
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
      onConfirmLaunch={(layout) => void handleCreate(layout)}
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
          loadingRepoInfo={form.loadingRepoInfo}
          repoError={form.repoError}
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

        <NewTaskPromptField form={form} />
        <NewTaskBranchFields form={form} />
        <NewTaskWorktreeField form={form} />

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

        <NewTaskProgress form={form} />
      </form>
      {skillsHubModalOpen && <SkillsHubModal onClose={() => setSkillsHubModalOpen(false)} />}
    </Modal>
  );
}
