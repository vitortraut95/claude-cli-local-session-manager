import { Info, Pencil } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useToast } from "../hooks/useToast";
import * as preferencesApi from "../services/preferencesApi";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { BigEditorModal } from "./BigEditorModal";
import { Button } from "./Button";
import { Tooltip } from "./Tooltip";

const TEXTAREA_CLASS =
  "w-full rounded-lg border border-gray-300 bg-white p-3 font-mono text-xs text-gray-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/25 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100";

type QueuePromptPanelProps = {
  /** null while the preferences load. */
  defaultPrompt: string | null;
};

/** What every session the queue opens is sent: the default prompt (editable here) and how the
 *  rest of the prompt is put together. */
export function QueuePromptPanel({ defaultPrompt }: QueuePromptPanelProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const prompt = defaultPrompt?.trim() ?? "";

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t("queuePrompt.title")}
        </h2>
        <Tooltip content={<span className="block max-w-xs">{t("queuePrompt.info")}</span>}>
          <button
            type="button"
            aria-label={t("queuePrompt.info")}
            className="rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <Info className="h-4 w-4" />
          </button>
        </Tooltip>
        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing(true)}
            disabled={defaultPrompt === null}
            icon={<Pencil className="h-3.5 w-3.5" />}
          >
            {t("queuePrompt.edit")}
          </Button>
        </div>
      </div>
      {prompt ? (
        <pre className="max-h-32 overflow-y-auto rounded-lg bg-gray-50 p-3 font-mono text-xs whitespace-pre-wrap text-gray-700 dark:bg-gray-800/60 dark:text-gray-300">
          {prompt}
        </pre>
      ) : (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {defaultPrompt === null ? t("queuePrompt.loading") : t("queuePrompt.empty")}
        </p>
      )}
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t("queuePrompt.notesHint")}</p>

      {editing && (
        <BigEditorModal
          title={t("settings.defaultPrompt.title")}
          description={t("settings.defaultPrompt.description")}
          initial={defaultPrompt ?? ""}
          onCancel={() => setEditing(false)}
          onSave={async (value) => {
            try {
              await preferencesApi.updatePreferences({ defaultPrompt: value });
              preferencesApi.notifyPreferencesChanged();
              showToast(t("settings.saved"), "success");
              setEditing(false);
            } catch (err) {
              showToast(resolveApiErrorMessage(err, t, "settings.saveError"), "error");
            }
          }}
          render={(value, setValue) => (
            <textarea
              value={value}
              onChange={(event) => setValue(event.target.value)}
              autoFocus
              rows={24}
              className={TEXTAREA_CLASS}
            />
          )}
        />
      )}
    </section>
  );
}
