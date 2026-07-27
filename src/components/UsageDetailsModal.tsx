import { Modal } from "./Modal";
import type { Session } from "../types/session";
import { formatTokens, formatUsd } from "../utils/formatUsage";

type UsageDetailsModalProps = {
  session: Session;
  open: boolean;
  onClose: () => void;
};

export function UsageDetailsModal({ session, open, onClose }: UsageDetailsModalProps) {
  const { models, totalCostUsd, subagentCostUsd } = session.usage;

  return (
    <Modal open={open} title={session.title} onClose={onClose} size="lg">
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

          {session.subagentCount > 0 && (
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>
                Of which {session.subagentCount} subagent{session.subagentCount === 1 ? "" : "s"}
              </span>
              <span>{subagentCostUsd === null ? "Unknown pricing" : formatUsd(subagentCostUsd)}</span>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-800">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Estimated total
            </span>
            <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {totalCostUsd === null ? "Unavailable" : formatUsd(totalCostUsd)}
            </span>
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500">
            Estimated from token counts using Anthropic's public API pricing, assuming the default
            5-minute cache TTL. This is not your actual bill — it doesn't account for a Pro/Max
            subscription, promotional pricing changes, or other plan specifics.
          </p>
        </div>
      )}
    </Modal>
  );
}
