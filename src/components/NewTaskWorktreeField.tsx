import { AlertTriangle, Info, Loader2 } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import type { NewTaskForm } from "../hooks/useNewTaskForm";
import { Button } from "./Button";

/** The "New task" worktree checkbox, with the active-session check and the no-worktree warning. */
export function NewTaskWorktreeField({ form }: { form: NewTaskForm }) {
  const { t } = useLanguage();
  const {
    useWorktree,
    setUseWorktree,
    useWorktreeTouched,
    setUseWorktreeTouched,
    worktreeDefaultDirty,
    savingWorktreeDefault,
    handleSaveWorktreeDefault,
    loadingRepoInfo,
    activeSessionInRoot,
  } = form;

  return (
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
  );
}
