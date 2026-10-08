import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useProjectFolders } from "../hooks/useProjectFolders";
import { useSkillsHubStatus } from "../hooks/useSkillsHubStatus";
import { useToast } from "../hooks/useToast";
import * as tasksApi from "../services/tasksApi";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { Button } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";
import { Modal } from "./Modal";
import { ProjectFolderField } from "./ProjectFolderField";
import { SkillsHubModal } from "./SkillsHubModal";
import { SkillsHubPanel } from "./SkillsHubPanel";

type NewSessionModalProps = {
  open: boolean;
  onClose: () => void;
  /** Fired right after a successful launch so the page's session list picks up the new session. */
  onSessionCreated?: () => void;
};

const TEXTAREA_CLASSNAME =
  "w-full rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900 placeholder:text-gray-400 " +
  "focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 " +
  "dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-gray-600 " +
  "dark:focus:ring-gray-100/10";

/**
 * The lightweight sibling of NewTaskModal: no Jira link, branch, base branch or worktree — just a
 * project, the team skills and a prompt (`defaultSessionPrompt`, separate from the task one), then
 * `claude "<prompt>"` in the project's root as-is. The only check is whether a session is already
 * active in that root, which asks for a confirmation instead of blocking.
 *
 * Always mounted for the same reason as NewTaskModal: an accidental close must not lose what the
 * user already typed — only "Clear" or a successful launch resets the form.
 */
export function NewSessionModal({ open, onClose, onSessionCreated }: NewSessionModalProps) {
  const { showToast } = useToast();
  const { t } = useLanguage();

  const folders = useProjectFolders(open);
  const { effectiveFolderPath, resetFolder } = folders;

  const [defaultPromptLoaded, setDefaultPromptLoaded] = useState<string | null>(null);
  const [loadingPrompt, setLoadingPrompt] = useState(true);
  const [promptText, setPromptText] = useState("");
  const [savingDefaultPrompt, setSavingDefaultPrompt] = useState(false);

  const [launching, setLaunching] = useState(false);
  // Set when the chosen project's root already has an active session — holds the resolved repo
  // root so the confirmation's "start anyway" launches exactly what was checked.
  const [pendingRepoRoot, setPendingRepoRoot] = useState<string | null>(null);

  const { status: skillsHub, failed: skillsHubFailed } = useSkillsHubStatus(open);
  const [skillsHubModalOpen, setSkillsHubModalOpen] = useState(false);

  // Fetched once on mount, not on every open — re-seeding on open would clobber an in-progress
  // edit across an accidental close.
  useEffect(() => {
    let cancelled = false;
    tasksApi
      .fetchPreferences()
      .then((prefs) => {
        if (cancelled) return;
        const loaded = prefs.defaultSessionPrompt ?? "";
        setDefaultPromptLoaded(loaded);
        setPromptText(loaded);
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

  // The settings modal can change the stored default while this modal keeps its own copy — the
  // draft follows along only when it still equals the old stored value (never edited).
  const defaultPromptRef = useRef(defaultPromptLoaded);
  useEffect(() => {
    defaultPromptRef.current = defaultPromptLoaded;
  }, [defaultPromptLoaded]);
  useEffect(() => {
    const onChanged = () => {
      tasksApi
        .fetchPreferences()
        .then((prefs) => {
          const previous = defaultPromptRef.current ?? "";
          const loaded = prefs.defaultSessionPrompt ?? "";
          setDefaultPromptLoaded(loaded);
          setPromptText((current) => (current === previous ? loaded : current));
        })
        .catch(() => undefined);
    };
    window.addEventListener(tasksApi.PREFERENCES_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(tasksApi.PREFERENCES_CHANGED_EVENT, onChanged);
  }, []);

  const resetForm = useCallback(() => {
    resetFolder();
    setPromptText(defaultPromptLoaded ?? "");
  }, [resetFolder, defaultPromptLoaded]);

  const promptDirty = defaultPromptLoaded !== null && promptText !== defaultPromptLoaded;

  const handleSaveDefaultPrompt = async () => {
    setSavingDefaultPrompt(true);
    try {
      await tasksApi.updatePreferences({ defaultSessionPrompt: promptText });
      setDefaultPromptLoaded(promptText);
      showToast(t("newTaskModal.promptSaved"), "success");
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "newTaskModal.promptSaveError"), "error");
    } finally {
      setSavingDefaultPrompt(false);
    }
  };

  const trimmedFolder = effectiveFolderPath.trim();
  const canSubmit = trimmedFolder.length > 0 && !launching;

  const launch = async (repoRoot: string) => {
    setLaunching(true);
    try {
      await tasksApi.launchTaskTerminal(repoRoot, promptText.trim(), false, repoRoot);
      showToast(t("newTaskModal.terminalOpened"), "success");
      setPendingRepoRoot(null);
      resetForm();
      onClose();
      onSessionCreated?.();
    } catch (err) {
      const message = resolveApiErrorMessage(err, t, "newTaskModal.unexpectedFailure");
      showToast(t("newSessionModal.launchFailed", { message }), "error");
      setPendingRepoRoot(null);
    } finally {
      setLaunching(false);
    }
  };

  const handleStart = async () => {
    if (!canSubmit) return;
    setLaunching(true);
    let repoInfo: tasksApi.RepoInfo;
    try {
      repoInfo = await tasksApi.fetchRepoInfo(trimmedFolder);
    } catch (err) {
      const message = resolveApiErrorMessage(err, t, "newTaskModal.repoInfoError");
      showToast(t("newSessionModal.launchFailed", { message }), "error");
      setLaunching(false);
      return;
    }
    if (repoInfo.hasActiveSessionInRoot) {
      setLaunching(false);
      setPendingRepoRoot(repoInfo.repoRoot);
      return;
    }
    await launch(repoInfo.repoRoot);
  };

  return (
    <Modal
      open={open}
      title={t("newSessionModal.title")}
      // Escape would otherwise close this modal too while a modal on top of it is open.
      onClose={() => {
        if (!skillsHubModalOpen && pendingRepoRoot === null) onClose();
      }}
      onCancel={onClose}
      onConfirm={() => void handleStart()}
      confirmLabel={t("newSessionModal.confirm")}
      cancelLabel={t("newTaskModal.cancel")}
      isConfirmLoading={launching}
      isConfirmDisabled={!canSubmit}
      onSecondary={resetForm}
      secondaryLabel={t("newTaskModal.clear")}
      size="xxxl"
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">{t("newSessionModal.intro")}</p>

        <ProjectFolderField folders={folders} inputName="newSessionFolderPath" />

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
                : t("newSessionModal.promptPlaceholder")
            }
            rows={8}
            className={TEXTAREA_CLASSNAME}
          />
        </div>
      </div>
      {skillsHubModalOpen && <SkillsHubModal onClose={() => setSkillsHubModalOpen(false)} />}
      <ConfirmDialog
        open={pendingRepoRoot !== null}
        title={t("newSessionModal.activeSessionTitle")}
        message={t("newSessionModal.activeSessionMessage", { folder: pendingRepoRoot ?? "" })}
        confirmLabel={t("newSessionModal.activeSessionConfirm")}
        isLoading={launching}
        onConfirm={() => {
          if (pendingRepoRoot) void launch(pendingRepoRoot);
        }}
        onCancel={() => setPendingRepoRoot(null)}
      />
    </Modal>
  );
}
