import { useLanguage } from "../hooks/useLanguage";
import type { NewTaskForm } from "../hooks/useNewTaskForm";
import { Button } from "./Button";

const TEXTAREA_CLASSNAME =
  "w-full rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900 placeholder:text-gray-400 " +
  "focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/25 dark:border-gray-700 " +
  "dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-violet-400 " +
  "dark:focus:ring-violet-400/30";

/** The "New task" prompt, with a link to store it as the default prompt. */
export function NewTaskPromptField({ form }: { form: NewTaskForm }) {
  const { t } = useLanguage();
  const {
    promptText,
    setPromptText,
    promptDirty,
    loadingPrompt,
    savingDefaultPrompt,
    handleSaveDefaultPrompt,
  } = form;

  return (
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
  );
}
