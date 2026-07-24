import { X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { Session } from "../types/session";

type UsageDetailsModalProps = {
  session: Session;
  open: boolean;
  onClose: () => void;
};

function formatTokens(value: number): string {
  return value.toLocaleString("en-US");
}

function formatUsd(value: number): string {
  if (value === 0) return "$0.00";
  return value < 0.01 ? `$${value.toFixed(4)}` : `$${value.toFixed(2)}`;
}

export function UsageDetailsModal({ session, open, onClose }: UsageDetailsModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const { models, totalCostUsd } = session.usage;

  // Portalled to document.body for the same reason as PromptPreviewModal — SessionCard's
  // `hover:-translate-y-0.5` makes it a containing block for `position: fixed` descendants
  // while hovered, which is exactly the state the card is in when this modal's trigger is
  // clicked. See PromptPreviewModal.tsx / CLAUDE.md for the full explanation.
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
          {models.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No token usage found for this session.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {models.map((model) => (
                <div
                  key={model.model}
                  className="rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/50"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-xs font-medium text-gray-700 dark:text-gray-300">
                      {model.model}
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {model.costUsd === null ? "Unknown pricing" : formatUsd(model.costUsd)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400 sm:grid-cols-4">
                    <span>Input: {formatTokens(model.inputTokens)}</span>
                    <span>Output: {formatTokens(model.outputTokens)}</span>
                    <span>Cache write: {formatTokens(model.cacheCreationInputTokens)}</span>
                    <span>Cache read: {formatTokens(model.cacheReadInputTokens)}</span>
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-800">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Estimated total
                </span>
                <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  {totalCostUsd === null ? "Unavailable" : formatUsd(totalCostUsd)}
                </span>
              </div>

              <p className="text-xs text-gray-400 dark:text-gray-500">
                Estimated from token counts using Anthropic's public API pricing, assuming the
                default 5-minute cache TTL. This is not your actual bill — it doesn't account for
                a Pro/Max subscription, promotional pricing changes, or other plan specifics.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
