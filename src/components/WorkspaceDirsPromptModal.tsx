import { FolderGit2 } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useToast } from "../hooks/useToast";
import * as tasksApi from "../services/tasksApi";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { Modal } from "./Modal";
import { WorkspaceDirsEditor } from "./WorkspaceDirsEditor";

type WorkspaceDirsPromptModalProps = {
  onSaved: () => void;
  /** "Not now" — only for this page load; the prompt comes back on the next start until saved. */
  onSkip: () => void;
};

/**
 * Asked on every app start while `workspaceDirs` was never saved (null) — see Header. Mounted only
 * while shown (same convention as NicknameModal), so it always starts from a fresh, preselected
 * list.
 */
export function WorkspaceDirsPromptModal({ onSaved, onSkip }: WorkspaceDirsPromptModalProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [dirs, setDirs] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await tasksApi.updatePreferences({ workspaceDirs: dirs });
      tasksApi.notifyPreferencesChanged();
      showToast(t("workspaceDirsPrompt.saved"), "success");
      onSaved();
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "settings.saveError"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={t("workspaceDirsPrompt.title")}
      onClose={onSkip}
      onCancel={onSkip}
      onConfirm={() => void handleSave()}
      cancelLabel={t("workspaceDirsPrompt.skip")}
      confirmLabel={t("workspaceDirsPrompt.save")}
      isConfirmLoading={saving}
      isConfirmDisabled={dirs.length === 0}
      size="lg"
      icon={<FolderGit2 className="h-5 w-5 text-gray-500 dark:text-gray-400" />}
    >
      <p className="text-sm text-gray-600 dark:text-gray-400">{t("workspaceDirsPrompt.intro")}</p>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {t("workspaceDirsPrompt.laterHint")}
      </p>
      <div className="mt-4">
        <WorkspaceDirsEditor value={dirs} onChange={setDirs} preselectRecommended />
      </div>
    </Modal>
  );
}
