import { FlaskConical } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useToast } from "../hooks/useToast";
import * as tasksApi from "../services/tasksApi";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { Input } from "./Input";
import { Modal } from "./Modal";

type TestTaskModalProps = {
  /** `taskTestSkill` — only mounted while one is set. */
  skill: string;
  /** Where the server opens the terminal (first workspace dir, else the home dir) — display only. */
  folderHint: string;
  onClose: () => void;
  /** Fired after a successful launch so the page's session list picks up the new session. */
  onSessionCreated?: () => void;
};

/**
 * The header's "Test task": a ticket link and the permission-mode checkbox, nothing else — opens a
 * terminal running `/<skill> <link>` and leaves everything (finding the project, the test plan) to
 * the skill. Deliberately no active-session check: the skill only reads.
 */
export function TestTaskModal({
  skill,
  folderHint,
  onClose,
  onSessionCreated,
}: TestTaskModalProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [link, setLink] = useState("");
  const [permissionModeAuto, setPermissionModeAuto] = useState(true);
  const [storedPermissionModeAuto, setStoredPermissionModeAuto] = useState(true);
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    tasksApi
      .fetchPreferences()
      .then((prefs) => {
        if (cancelled) return;
        const stored = prefs.taskTestPermissionModeAuto ?? true;
        setStoredPermissionModeAuto(stored);
        setPermissionModeAuto(stored);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const trimmedLink = link.trim();
  const canSubmit = trimmedLink.length > 0 && !launching;

  const handleTest = async () => {
    if (!canSubmit) return;
    setLaunching(true);
    try {
      await tasksApi.launchTaskTest(
        trimmedLink,
        permissionModeAuto,
        t("testTaskModal.nickname", { link: trimmedLink }),
      );
      showToast(t("newTaskModal.terminalOpened"), "success");
      if (permissionModeAuto !== storedPermissionModeAuto) {
        void tasksApi
          .updatePreferences({ taskTestPermissionModeAuto: permissionModeAuto })
          .catch(() => undefined);
      }
      onClose();
      onSessionCreated?.();
    } catch (err) {
      const message = resolveApiErrorMessage(err, t, "newTaskModal.unexpectedFailure");
      showToast(t("testTaskModal.launchFailed", { message }), "error");
    } finally {
      setLaunching(false);
    }
  };

  return (
    <Modal
      open
      title={t("testTaskModal.title")}
      icon={<FlaskConical className="h-5 w-5 text-teal-600 dark:text-teal-400" />}
      onClose={onClose}
      onCancel={onClose}
      onConfirm={() => void handleTest()}
      confirmLabel={t("testTaskModal.confirm")}
      cancelLabel={t("newTaskModal.cancel")}
      isConfirmLoading={launching}
      isConfirmDisabled={!canSubmit}
      size="lg"
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t("testTaskModal.intro", { dir: folderHint, command: `/${skill} <link>` })}
        </p>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            {t("testTaskModal.linkLabel")}
          </span>
          <Input
            type="text"
            value={link}
            onChange={(event) => setLink(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleTest();
            }}
            placeholder={t("testTaskModal.linkPlaceholder")}
            autoFocus
          />
        </label>

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
            {t("testTaskModal.permissionModeAutoExplanation")}
          </p>
        </div>
      </div>
    </Modal>
  );
}
