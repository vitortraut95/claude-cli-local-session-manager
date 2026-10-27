import { Scale } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useSkillsHubStatus } from "../hooks/useSkillsHubStatus";
import { useToast } from "../hooks/useToast";
import * as preferencesApi from "../services/preferencesApi";
import type { TerminalLayout } from "../services/preferencesApi";
import * as tasksApi from "../services/tasksApi";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { Modal } from "./Modal";
import { SkillPreferenceSelect } from "./SkillPreferenceSelect";

type RefinementModalProps = {
  open: boolean;
  onClose: () => void;
  /** Fired right after a successful launch so the page's session list picks up the new session. */
  onSessionCreated?: () => void;
};

const TEXTAREA_CLASSNAME =
  "w-full rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900 placeholder:text-gray-400 " +
  "focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:cursor-not-allowed " +
  "disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 " +
  "dark:placeholder:text-gray-500 dark:focus:border-gray-600 dark:focus:ring-gray-100/10";

const KEY_PATTERN = /\b[A-Za-z][A-Za-z0-9]+-\d+\b/g;

/** Same keys the server reads out of the pasted text. */
function ticketKeys(text: string): string[] {
  return [...new Set((text.match(KEY_PATTERN) ?? []).map((key) => key.toUpperCase()))];
}

/**
 * "Refine tasks": pasted tickets + additional notes, opened as a new session running
 * `taskRefinementSkill`. The tasks field stays locked until that skill is chosen (here, in the
 * Skills modal or in Settings) and installed.
 *
 * Always mounted so an accidental close doesn't lose what was pasted — only a successful launch
 * resets the form.
 */
export function RefinementModal({ open, onClose, onSessionCreated }: RefinementModalProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { status: skillsHub } = useSkillsHubStatus(open);
  const [skill, setSkill] = useState<string | null>(null);
  const [tasks, setTasks] = useState("");
  const [notes, setNotes] = useState("");
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      preferencesApi
        .fetchPreferences()
        .then((prefs) => {
          if (!cancelled) setSkill(prefs.taskRefinementSkill ?? "");
        })
        .catch(() => undefined);
    };
    load();
    window.addEventListener(preferencesApi.PREFERENCES_CHANGED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(preferencesApi.PREFERENCES_CHANGED_EVENT, load);
    };
  }, []);

  const installedSkills = skillsHub?.installedSkills ?? [];
  const skillReady = Boolean(skill) && installedSkills.some((s) => s.name === skill);
  const keys = ticketKeys(tasks);
  const canSubmit = skillReady && keys.length > 0 && !launching;

  const launch = async (layout?: TerminalLayout) => {
    if (!canSubmit) return;
    setLaunching(true);
    try {
      await tasksApi.launchRefinement({ tasks, notes }, layout);
      showToast(t("refinementModal.launched"), "success");
      setTasks("");
      setNotes("");
      onSessionCreated?.();
      onClose();
    } catch (err) {
      const message = resolveApiErrorMessage(err, t, "refinementModal.launchFailed");
      showToast(t("refinementModal.launchFailed", { message }), "error");
    } finally {
      setLaunching(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t("refinementModal.title")}
      icon={<Scale className="h-5 w-5" />}
      onClose={onClose}
      onCancel={onClose}
      onConfirmLaunch={(layout) => void launch(layout)}
      confirmLabel={t("refinementModal.confirm")}
      cancelLabel={t("newTaskModal.cancel")}
      isConfirmLoading={launching}
      isConfirmDisabled={!canSubmit}
      size="lg"
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">{t("refinementModal.intro")}</p>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            {t("refinementModal.skillLabel")}
          </label>
          {skillsHub?.installedSkills && (
            <SkillPreferenceSelect
              preference="taskRefinementSkill"
              icon={<Scale className="h-3.5 w-3.5" />}
              label={t("taskRefinementSkill.title")}
              skillsHub={skillsHub}
            />
          )}
          {skill !== null && !skillReady && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
              {t("refinementModal.skillRequired")}
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            {t("refinementModal.tasksLabel")}
          </label>
          <textarea
            value={tasks}
            onChange={(event) => setTasks(event.target.value)}
            disabled={!skillReady}
            placeholder={t("refinementModal.tasksPlaceholder")}
            rows={6}
            className={TEXTAREA_CLASSNAME}
          />
          {keys.length > 0 && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t("refinementModal.detected", { count: keys.length, keys: keys.join(", ") })}
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            {t("refinementModal.notesLabel")}
          </label>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            disabled={!skillReady}
            placeholder={t("refinementModal.notesPlaceholder")}
            rows={4}
            className={TEXTAREA_CLASSNAME}
          />
        </div>
      </div>
    </Modal>
  );
}
