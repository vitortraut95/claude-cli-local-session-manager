import { FileText, Loader2, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import * as tasksApi from "../services/tasksApi";
import type { SkillDetails } from "../services/tasksApi";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { MarkdownView } from "./MarkdownView";
import { Modal } from "./Modal";

type SkillPreviewModalProps = {
  catalog: string;
  name: string;
  onClose: () => void;
};

/** Read-only view of one hub skill's SKILL.md (description, dependencies, full instructions and the
 *  files that come with it), opened from the skills selection modal's info icon. */
export function SkillPreviewModal({ catalog, name, onClose }: SkillPreviewModalProps) {
  const { t } = useLanguage();
  const [details, setDetails] = useState<SkillDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    tasksApi
      .fetchSkillDetails(catalog, name)
      .then((result) => {
        if (!cancelled) setDetails(result);
      })
      .catch((err) => {
        if (!cancelled) setError(resolveApiErrorMessage(err, t, "skillsHub.preview.loadError"));
      });
    return () => {
      cancelled = true;
    };
  }, [catalog, name, t]);

  return (
    <Modal
      open
      title={`${catalog} / ${name}`}
      onClose={onClose}
      size="lg"
      icon={<Wand2 className="h-5 w-5 text-violet-500" />}
    >
      {!details && !error && (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("skillsHub.loading")}
        </p>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {details && (
        <div className="flex flex-col gap-4">
          {details.description && (
            <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-200">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-violet-600 dark:text-violet-400">
                {t("skillsHub.preview.whenUsed")}
              </p>
              <p className="whitespace-pre-line">{details.description}</p>
            </div>
          )}
          {details.requiresSkills.length > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("skillsHub.preview.requires")}{" "}
              <span className="font-mono text-gray-800 dark:text-gray-200">
                {details.requiresSkills.join(", ")}
              </span>
            </p>
          )}
          <MarkdownView source={details.body} />
          {details.files.length > 0 && (
            <div className="border-t border-gray-100 pt-3 dark:border-gray-800">
              <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("skillsHub.preview.files")}
              </p>
              <ul className="flex flex-col gap-0.5">
                {details.files.map((file) => (
                  <li
                    key={file}
                    className="flex items-center gap-1.5 font-mono text-xs text-gray-700 dark:text-gray-300"
                  >
                    <FileText className="h-3 w-3 shrink-0 text-gray-400" />
                    {file}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="break-all font-mono text-[11px] text-gray-400 dark:text-gray-500">
            {details.dir}
          </p>
        </div>
      )}
    </Modal>
  );
}
