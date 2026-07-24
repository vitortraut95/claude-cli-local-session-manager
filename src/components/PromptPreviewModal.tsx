import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  // Falls back to the truncated list-payload copy if the full fetch fails — still useful, just
  // possibly cut off, rather than showing nothing.
  const displayPrompts = fullPrompts ?? (loadError ? session.prompts : null);

  // Portalled to document.body: this is triggered from a button inside SessionCard, which has
  // a `hover:-translate-y-0.5` class — a transform active on an ancestor (even just during the
  // hover that triggered the click) makes it the containing block for this `fixed` modal instead
  // of the viewport, clipping it to the card's bounds. Rendering outside the card's DOM subtree
  // sidesteps that entirely, regardless of any ancestor's hover/transform state.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl dark:bg-gray-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 p-4 dark:border-gray-800">
          <h2
            className="line-clamp-1 text-base font-semibold text-gray-900 dark:text-gray-100"
            title={session.title}
          >
            {session.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-4">
          {displayPrompts === null ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading prompts…</p>
          ) : displayPrompts.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No prompts found for this session.
            </p>
          ) : (
            <>
              {loadError && (
                <p className="mb-3 text-xs text-amber-600 dark:text-amber-400">
                  Couldn't load the full prompt text — showing a possibly truncated version.
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
        </div>
      </div>
    </div>,
    document.body,
  );
}
