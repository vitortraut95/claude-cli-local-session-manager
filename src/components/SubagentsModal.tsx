import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { useLanguage } from "../hooks/useLanguage";
import * as sessionsApi from "../services/sessionsApi";
import type { Session, SubagentDetail } from "../types/session";
import { formatUsd } from "../utils/formatUsage";

type SubagentsModalProps = {
  session: Session;
  open: boolean;
  onClose: () => void;
};

function formatDuration(startedAt: string | null, endedAt: string | null): string | null {
  if (!startedAt || !endedAt) return null;
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;

  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

/** Result texts commonly run into the tens of KB — collapsed by default so one long-winded
 *  subagent doesn't push every other one off screen. */
const RESULT_PREVIEW_LENGTH = 400;

function SubagentResult({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useLanguage();
  const isLong = text.length > RESULT_PREVIEW_LENGTH;
  const shown = expanded || !isLong ? text : `${text.slice(0, RESULT_PREVIEW_LENGTH)}…`;

  return (
    <div>
      <p className="whitespace-pre-wrap text-xs text-gray-600 dark:text-gray-400">{shown}</p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-1 text-xs font-medium text-gray-500 hover:underline dark:text-gray-400"
        >
          {expanded ? t("subagentsModal.showLess") : t("subagentsModal.showMore")}
        </button>
      )}
    </div>
  );
}

function SubagentCard({ agent }: { agent: SubagentDetail }) {
  const duration = formatDuration(agent.startedAt, agent.endedAt);
  const { t } = useLanguage();

  return (
    <li className="rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/50">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-[10px] font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
          {agent.agentType ?? t("subagentsModal.unknownType")}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {duration && `${duration} · `}
          {agent.usage.totalCostUsd === null
            ? t("subagentsModal.unknownPricing")
            : formatUsd(agent.usage.totalCostUsd)}
        </span>
      </div>
      <p className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-100">
        {agent.description ?? t("subagentsModal.noDescription")}
      </p>
      {agent.resultText && <SubagentResult text={agent.resultText} />}
    </li>
  );
}

export function SubagentsModal({ session, open, onClose }: SubagentsModalProps) {
  const [subagents, setSubagents] = useState<SubagentDetail[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const { t } = useLanguage();

  // Guarded on `subagents !== null || loadError` so reopening an already-loaded (or
  // already-failed) session doesn't refetch every time — same pattern as PromptPreviewModal.
  useEffect(() => {
    if (!open || subagents !== null || loadError) return;
    let cancelled = false;
    sessionsApi
      .fetchSessionSubagents(session.id)
      .then((data) => {
        if (!cancelled) setSubagents(data);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, subagents, loadError, session.id]);

  return (
    <Modal
      open={open}
      title={t("subagentsModal.title", { title: session.title })}
      onClose={onClose}
      size="lg"
    >
      {loadError ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("subagentsModal.loadError")}
          </p>
          <Button variant="outline" size="sm" onClick={() => setLoadError(false)}>
            {t("subagentsModal.retry")}
          </Button>
        </div>
      ) : subagents === null ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("subagentsModal.loading")}</p>
      ) : subagents.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("subagentsModal.empty")}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {subagents.map((agent) => (
            <SubagentCard key={agent.agentId} agent={agent} />
          ))}
        </ol>
      )}
    </Modal>
  );
}
