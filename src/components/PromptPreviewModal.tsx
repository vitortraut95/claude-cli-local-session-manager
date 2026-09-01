import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { useLanguage } from "../hooks/useLanguage";
import * as sessionsApi from "../services/sessionsApi";
import type { Session } from "../types/session";

type PromptPreviewModalProps = {
  session: Session;
  open: boolean;
  onClose: () => void;
};

export function PromptPreviewModal({ session, open, onClose }: PromptPreviewModalProps) {
  const [fullPrompts, setFullPrompts] = useState<string[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const { t } = useLanguage();

  // `session.prompts` (from the /sessions list payload) is capped per-prompt at 300 chars to
  // keep that payload light — fetched here in full, on demand, only while this modal is open.
  // Guarded on `fullPrompts !== null || loadError` so reopening the same already-loaded (or
  // already-failed) session doesn't refetch every time.
  useEffect(() => {
    if (!open || fullPrompts !== null || loadError) return;
    let cancelled = false;
    sessionsApi
      .fetchSessionPrompts(session.id)
      .then((prompts) => {
        if (!cancelled) setFullPrompts(prompts);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, fullPrompts, loadError, session.id]);

  // Falls back to the truncated list-payload copy if the full fetch fails — still useful, just
  // possibly cut off, rather than showing nothing.
  const displayPrompts = fullPrompts ?? (loadError ? session.prompts : null);

  return (
    <Modal open={open} title={session.title} onClose={onClose} size="lg">
      {displayPrompts === null ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t("promptPreviewModal.loading")}
        </p>
      ) : displayPrompts.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("promptPreviewModal.empty")}</p>
      ) : (
        <>
          {loadError && (
            <p className="mb-3 text-xs text-amber-600 dark:text-amber-400">
              {t("promptPreviewModal.loadError")}
            </p>
          )}
          <ol className="flex flex-col gap-3">
            {displayPrompts.map((prompt, index) => (
              <li
                key={index}
                className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-300"
              >
                <span className="mb-1 block text-xs font-medium text-gray-400 dark:text-gray-500">
                  #{index + 1}
                </span>
                <p className="whitespace-pre-wrap">{prompt}</p>
              </li>
            ))}
          </ol>
        </>
      )}
    </Modal>
  );
}
