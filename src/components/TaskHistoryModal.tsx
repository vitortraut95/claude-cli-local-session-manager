import { History, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import type { TranslationKey } from "../i18n/translations";
import * as sessionsApi from "../services/sessionsApi";
import type { HistoryEvent, HistorySummary } from "../services/sessionsApi";
import type { Session, WorkStatus } from "../types/session";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { formatActiveTime } from "../utils/formatDate";
import { WORK_STATUS_LABEL_KEYS } from "../utils/workStatus";
import { Modal } from "./Modal";

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** Seconds under a minute, else the card's compact "1h 12m". */
function formatDuration(ms: number): string {
  return ms < 60_000 ? `${Math.max(0, Math.round(ms / 1000))}s` : formatActiveTime(ms);
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString([], {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const BLOCK_REASON_KEYS: Record<string, TranslationKey> = {
  paused: "history.reason.paused",
  max_sessions: "history.reason.maxSessions",
  recent_launch: "history.reason.recentLaunch",
  low_memory: "history.reason.lowMemory",
  memory_pressure: "history.reason.memoryPressure",
  usage_limit: "history.reason.usageLimit",
};

function statusLabel(value: unknown, t: T): string {
  return typeof value === "string" && value in WORK_STATUS_LABEL_KEYS
    ? t(WORK_STATUS_LABEL_KEYS[value as WorkStatus])
    : t("workStatus.none");
}

const str = (value: unknown) => (typeof value === "string" ? value : "");
const ms = (value: unknown) => (typeof value === "number" ? formatDuration(value) : "?");
const secs = (value: unknown) => (typeof value === "number" ? formatDuration(value * 1000) : "?");

/** One timeline line, in words. Unknown types show as-is, so a newer event never breaks it. */
function describe(event: HistoryEvent, t: T): string {
  switch (event.type) {
    case "queue.added":
      return t("history.event.queueAdded", {
        prefix:
          event.branchPrefix === ""
            ? t("taskQueueModal.prefixNone")
            : str(event.branchPrefix) || "?",
      });
    case "queue.updated":
      return t("history.event.queueUpdated");
    case "queue.retry":
      return t("history.event.queueRetry", { error: str(event.previousError) });
    case "queue.removed":
      return t("history.event.queueRemoved");
    case "queue.launch.started":
      return t("history.event.launchStarted");
    case "queue.launched":
      return t("history.event.launched", {
        duration: ms(event.durationMs),
        queued: ms(event.queuedMs),
        branch: str(event.branch),
      });
    case "queue.launch.failed":
      return t("history.event.launchFailed", { error: str(event.error) });
    case "status.changed":
      return t(
        event.source === "scheduler" ? "history.event.statusByScheduler" : "history.event.status",
        { from: statusLabel(event.from, t), to: statusLabel(event.to, t) },
      );
    case "cleanup.executed":
      return t("history.event.cleanupExecuted");
    case "cleanup.failed":
      return t("history.event.cleanupFailed", { error: str(event.error) });
    case "session.started":
      return t("history.event.sessionStarted");
    case "session.resumed":
      return t("history.event.sessionResumed");
    case "sessions.resumeOpen":
      return t("history.event.resumeOpen");
    case "heavy.run":
      return t("history.event.heavyRun", {
        command: str(event.command),
        wait: secs((Number(event.slotWaitS) || 0) + (Number(event.memoryWaitS) || 0)),
        duration: secs(event.durationS),
        status: String(event.status),
      });
    case "heavy.blocked":
      return t("history.event.heavyBlocked", { command: str(event.command) });
    case "heavy.waiting":
      return t("history.event.heavyWaiting", { command: str(event.command) });
    case "heavy.timeout":
      return t("history.event.heavyTimeout", {
        command: str(event.command),
        wait: secs(event.waitedS),
      });
    case "heavy.preview":
      return t("history.event.heavyPreview", {
        command: str(event.command),
        wait: secs((Number(event.slotWaitS) || 0) + (Number(event.memoryWaitS) || 0)),
        status: String(event.status),
      });
    default:
      return event.type;
  }
}

/** Failures stand out in the timeline. */
function isProblem(event: HistoryEvent): boolean {
  return (
    event.type.endsWith(".failed") ||
    event.type === "heavy.timeout" ||
    (event.type === "heavy.run" && event.status !== 0)
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-800">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}

function SummaryStats({ summary, t }: { summary: HistorySummary; t: T }) {
  const stats: { label: string; value: string }[] = [];
  if (summary.totalMs !== null) {
    stats.push({ label: t("history.stat.total"), value: formatDuration(summary.totalMs) });
  }
  if (summary.queuedMs !== null) {
    stats.push({ label: t("history.stat.queued"), value: formatDuration(summary.queuedMs) });
  }
  for (const [status, value] of Object.entries(summary.statusMs)) {
    stats.push({
      label: t("history.stat.inStatus", { status: statusLabel(status, t) }),
      value: formatDuration(value),
    });
  }
  if (summary.heavyRuns > 0) {
    stats.push({
      label: t("history.stat.tests"),
      value: t("history.stat.testsValue", {
        runs: summary.heavyRuns,
        failed: summary.heavyFailed,
        duration: formatDuration(summary.heavyDurationS * 1000),
      }),
    });
    stats.push({
      label: t("history.stat.testWait"),
      value: formatDuration((summary.heavySlotWaitS + summary.heavyMemoryWaitS) * 1000),
    });
  }
  if (summary.heavyOverCap > 0) {
    stats.push({ label: t("history.stat.overCap"), value: String(summary.heavyOverCap) });
  }
  if (summary.heavyBlocked > 0) {
    stats.push({ label: t("history.stat.hookBlocks"), value: String(summary.heavyBlocked) });
  }

  return (
    <div className="flex flex-col gap-3">
      {stats.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {stats.map((stat) => (
            <Stat key={stat.label} {...stat} />
          ))}
        </div>
      )}
      {summary.queueBlocks.length > 0 && (
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {t("history.queueBlocks", {
            blocks: summary.queueBlocks
              .map(
                (b) =>
                  `${BLOCK_REASON_KEYS[b.reason] ? t(BLOCK_REASON_KEYS[b.reason]!) : b.reason} (${formatDuration(b.durationMs)})`,
              )
              .join(", "),
          })}
        </p>
      )}
    </div>
  );
}

type TaskHistoryModalProps = {
  session: Session;
  onClose: () => void;
};

/** The card's "info": where this task's time went, from `history.jsonl`. */
export function TaskHistoryModal({ session, onClose }: TaskHistoryModalProps) {
  const { t } = useLanguage();
  const [data, setData] = useState<{ events: HistoryEvent[]; summary: HistorySummary } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    sessionsApi
      .fetchSessionHistory(session.id)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(resolveApiErrorMessage(err, t, "history.loadError"));
      });
    return () => {
      cancelled = true;
    };
  }, [session.id, t]);

  return (
    <Modal
      open
      title={t("history.title", { name: session.taskKey ?? session.title })}
      icon={<History className="h-5 w-5" />}
      onClose={onClose}
      onCancel={onClose}
      cancelLabel={t("history.close")}
      size="lg"
    >
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : !data ? (
        <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("history.loading")}
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          <SummaryStats summary={data.summary} t={t} />

          {data.summary.errors.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-red-700 dark:text-red-400">
                {t("history.errors", { count: data.summary.errors.length })}
              </h3>
              <ul className="space-y-1 text-xs text-red-700 dark:text-red-300">
                {data.summary.errors.map((e) => (
                  <li key={`${e.ts}-${e.type}`} className="break-words">
                    <span className="font-mono">{formatTime(e.ts)}</span> {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              {t("history.timeline", { count: data.events.length })}
            </h3>
            <ol className="space-y-1.5 border-l border-gray-200 pl-3 dark:border-gray-800">
              {data.events.map((event, index) => (
                <li
                  key={`${event.ts}-${index}`}
                  className={`text-xs ${
                    isProblem(event)
                      ? "text-red-700 dark:text-red-300"
                      : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  <span className="mr-2 font-mono text-gray-400 dark:text-gray-500">
                    {formatTime(event.ts)}
                  </span>
                  <span className="break-words">{describe(event, t)}</span>
                </li>
              ))}
            </ol>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t("history.footnote")}</p>
        </div>
      )}
    </Modal>
  );
}
