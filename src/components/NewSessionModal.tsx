import { useCallback, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useProjectFolders } from "../hooks/useProjectFolders";
import { useSkillsHubStatus } from "../hooks/useSkillsHubStatus";
import { useToast } from "../hooks/useToast";
import type { TerminalLayout } from "../services/preferencesApi";
import * as tasksApi from "../services/tasksApi";
import { resolveApiErrorMessage } from "../utils/apiClient";
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
  "focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/25 dark:border-gray-700 " +
  "dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-violet-400 " +
  "dark:focus:ring-violet-400/30";

/**
 * Project + team skills + prompt, then `claude "<prompt>"` in the project's root. A session already
 * active in that root asks for confirmation instead of blocking.
 *
 * Always mounted so an accidental close doesn't lose what the user typed — only "Clear" or a
 * successful launch resets the form.
 */
export function NewSessionModal({ open, onClose, onSessionCreated }: NewSessionModalProps) {
  const { showToast } = useToast();
  const { t } = useLanguage();

  const folders = useProjectFolders(open);
  const { effectiveFolderPath, resetFolder } = folders;

  const [promptText, setPromptText] = useState("");

  const [launching, setLaunching] = useState(false);
  // Set when the chosen project's root already has an active session — holds the resolved repo
  // root so the confirmation's "start anyway" launches exactly what was checked.
  const [pendingRepoRoot, setPendingRepoRoot] = useState<string | null>(null);
  const [pendingLayout, setPendingLayout] = useState<TerminalLayout>();

  const { status: skillsHub, failed: skillsHubFailed } = useSkillsHubStatus(open);
  const [skillsHubModalOpen, setSkillsHubModalOpen] = useState(false);

  const resetForm = useCallback(() => {
    resetFolder();
    setPromptText("");
  }, [resetFolder]);

  const trimmedFolder = effectiveFolderPath.trim();
  const canSubmit = trimmedFolder.length > 0 && !launching;

  const launch = async (repoRoot: string, layout?: TerminalLayout) => {
    setLaunching(true);
    try {
      await tasksApi.launchTaskTerminal(
        repoRoot,
        promptText.trim(),
        false,
        repoRoot,
        "",
        "",
        "",
        [],
        layout,
      );
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

  const handleStart = async (layout?: TerminalLayout) => {
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
      setPendingLayout(layout);
      return;
    }
    await launch(repoInfo.repoRoot, layout);
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
      onConfirmLaunch={(layout) => void handleStart(layout)}
      confirmLabel={t("newSessionModal.confirm")}
      cancelLabel={t("newTaskModal.cancel")}
      isConfirmLoading={launching}
      isConfirmDisabled={!canSubmit}
      onSecondary={resetForm}
      secondaryLabel={t("newTaskModal.clear")}
      size="xxxl"
      placement="side"
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
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            {t("newTaskModal.promptLabel")}
          </label>
          <textarea
            value={promptText}
            onChange={(event) => setPromptText(event.target.value)}
            placeholder={t("newSessionModal.promptPlaceholder")}
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
          if (pendingRepoRoot) void launch(pendingRepoRoot, pendingLayout);
        }}
        onCancel={() => setPendingRepoRoot(null)}
      />
    </Modal>
  );
}
