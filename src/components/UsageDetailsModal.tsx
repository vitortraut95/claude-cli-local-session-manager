import { Modal } from "./Modal";
import { useLanguage } from "../hooks/useLanguage";
import type { Session } from "../types/session";
import { formatTokens, formatUsd } from "../utils/formatUsage";

type UsageDetailsModalProps = {
  session: Session;
  open: boolean;
  onClose: () => void;
};

export function UsageDetailsModal({ session, open, onClose }: UsageDetailsModalProps) {
  const { models, totalCostUsd, subagentCostUsd } = session.usage;
  const { t } = useLanguage();

  return (
    <Modal open={open} title={session.title} onClose={onClose} size="lg">
      {models.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("usageDetailsModal.empty")}</p>
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
                  {model.costUsd === null
                    ? t("usageDetailsModal.unknownPricing")
                    : formatUsd(model.costUsd)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400 sm:grid-cols-4">
                <span>
                  {t("usageDetailsModal.input")} {formatTokens(model.inputTokens)}
                </span>
                <span>
                  {t("usageDetailsModal.output")} {formatTokens(model.outputTokens)}
                </span>
                <span>
                  {t("usageDetailsModal.cacheWrite")} {formatTokens(model.cacheCreationInputTokens)}
                </span>
                <span>
                  {t("usageDetailsModal.cacheRead")} {formatTokens(model.cacheReadInputTokens)}
                </span>
              </div>
            </div>
          ))}

          {session.subagentCount > 0 && (
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>
                {session.subagentCount === 1
                  ? t("usageDetailsModal.subagentCount.one")
                  : t("usageDetailsModal.subagentCount.many", { count: session.subagentCount })}
              </span>
              <span>
                {subagentCostUsd === null
                  ? t("usageDetailsModal.unknownPricing")
                  : formatUsd(subagentCostUsd)}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-800">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("usageDetailsModal.estimatedTotal")}
            </span>
            <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {totalCostUsd === null ? t("usageDetailsModal.unavailable") : formatUsd(totalCostUsd)}
            </span>
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500">
            {t("usageDetailsModal.disclaimer")}
          </p>
        </div>
      )}
    </Modal>
  );
}
