import { Pause, Play, RefreshCw, Send, Workflow } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useToast } from "../hooks/useToast";
import type { TranslationKey } from "../i18n/translations";
import * as boardWatcherApi from "../services/boardWatcherApi";
import type {
  AutomationSettings,
  BoardWatcherStatus,
  WatcherDecision,
  WatcherFeedback,
} from "../services/boardWatcherApi";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { formatUpdatedAt } from "../utils/formatDate";
import {
  DECISION_ACTION_KEYS,
  decisionColumn,
  translateServerText,
  type DecisionColumn,
} from "../utils/boardWatcher";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { WatcherBadge } from "./WatcherBadge";
import { WatcherHistory } from "./WatcherHistory";

/** How often the status is re-read while the modal is open. */
const POLL_MS = 15_000;

const DECISION_COLUMNS: { id: DecisionColumn; label: TranslationKey }[] = [
  { id: "todo", label: "board.decisions.todo" },
  { id: "waitTest", label: "board.decisions.waitTest" },
  { id: "codeReview", label: "board.decisions.codeReview" },
];

type BoardWatcherModalProps = {
  onClose: () => void;
  /** Opens the Automation settings (in place of this modal). */
  onOpenAutomation: () => void;
};

/** "18/20 (90%)", or "—" with no verdict yet. */
function scoreText(score: { up: number; down: number }): string {
  const total = score.up + score.down;
  return total === 0 ? "—" : `${score.up}/${total} (${Math.round((score.up / total) * 100)}%)`;
}

/** The board watcher at a glance: state, what it's doing, its last decisions and its history. */
export function BoardWatcherModal({ onClose, onOpenAutomation }: BoardWatcherModalProps) {
  const { t, language } = useLanguage();
  const { showToast } = useToast();
  const [status, setStatus] = useState<BoardWatcherStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [busy, setBusy] = useState<"run" | "pause" | "digest" | null>(null);
  const [feedback, setFeedback] = useState<Record<string, WatcherFeedback>>({});

  useEffect(() => {
    let cancelled = false;
    boardWatcherApi
      .fetchWatcherFeedback()
      .then((result) => {
        if (!cancelled) setFeedback(result);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const onFeedbackSaved = (saved: WatcherFeedback) =>
    setFeedback((current) => ({ ...current, [saved.entryKey]: saved }));

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      boardWatcherApi
        .fetchBoardWatcherStatus()
        .then((result) => {
          if (cancelled) return;
          setStatus(result);
          setStatusError(null);
        })
        .catch((err: unknown) => {
          if (!cancelled) setStatusError(resolveApiErrorMessage(err, t, "board.loadError"));
        });
    };
    load();
    const timer = window.setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    boardWatcherApi
      .fetchAutomationSettings()
      .then((result) => {
        if (!cancelled) setSettings(result);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // The history changes when a look or a session finishes, so it's re-read then.
  const historyRefreshKey = `${status?.lastTickAt ?? ""}|${String(status?.reviewing ?? false)}`;

  const runCommand = async (
    kind: "run" | "pause" | "digest",
    command: () => Promise<void | BoardWatcherStatus>,
  ) => {
    setBusy(kind);
    try {
      const result = await command();
      if (result) setStatus(result);
      if (kind === "digest") showToast(t("board.digest.sent"), "success");
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "board.actionError"), "error");
    } finally {
      setBusy(null);
    }
  };

  const togglePause = () =>
    runCommand("pause", () =>
      status?.pausedReason
        ? boardWatcherApi.resumeBoardWatcher()
        : boardWatcherApi.pauseBoardWatcher(),
    );

  const decisionsByColumn = (decisions: WatcherDecision[], column: DecisionColumn) =>
    decisions.filter((decision) => decisionColumn(decision) === column);

  const lastDecisions = status?.lastDecisions ?? [];

  return (
    <Modal open title={t("board.title")} onClose={onClose} size="xxl">
      <div className="flex flex-col gap-6">
        {statusError && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-red-600 dark:text-red-400">{statusError}</p>
            {/* The settings stay reachable when the status can't be read. */}
            {!status && (
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenAutomation}
                icon={<Workflow className="h-3.5 w-3.5" />}
              >
                {t("board.action.automation")}
              </Button>
            )}
          </div>
        )}

        {status && (
          <section className="flex flex-col gap-4 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
            <div className="flex flex-wrap items-center gap-2">
              <WatcherBadge tone={status.enabled ? "green" : "neutral"}>
                {status.enabled ? t("board.enabled.on") : t("board.enabled.off")}
              </WatcherBadge>
              {status.mode && (
                <WatcherBadge tone={status.live.length > 0 && status.businessTime ? "red" : "blue"}>
                  {status.live.length === 0
                    ? t("board.mode.simulate")
                    : t(status.businessTime ? "board.mode.live" : "board.mode.liveOnHold", {
                        count: status.live.length,
                      })}
                </WatcherBadge>
              )}
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-700 dark:text-gray-300">
              <span>
                {t("board.lastLook")}:{" "}
                {status.lastTickAt ? formatUpdatedAt(status.lastTickAt) : t("board.never")}
              </span>
              <span>
                {t("board.nextLook")}:{" "}
                {status.nextLookAt ? formatUpdatedAt(status.nextLookAt) : t("board.never")}
              </span>
              <span>
                {t("board.usage.approvals", {
                  used: status.approvalsToday,
                  max: settings?.limits.maxApprovesPerDay ?? "?",
                })}
              </span>
              <span>
                {t("board.usage.claims", {
                  used: status.testClaimsToday,
                  max: settings?.limits.maxClaimsPerDay ?? "?",
                })}
              </span>
              {status.scoreboard && (
                <span>
                  {t("board.score", {
                    days: status.scoreboard.days,
                    reviews: scoreText(status.scoreboard.reviews),
                    tests: scoreText(status.scoreboard.tests),
                    decisions: scoreText(status.scoreboard.decisions),
                  })}
                </span>
              )}
              {status.today && (
                <span>
                  {t("board.usage.sessions", {
                    reviews: status.today.reviews,
                    tests: status.today.tests,
                    minutes: Math.round(status.today.durationMs / 60_000),
                    cost: status.today.costUsd.toFixed(2),
                  })}
                </span>
              )}
            </div>

            {status.enabled && !status.businessTime && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200">
                <p className="font-medium">
                  {t("board.offHours.title", {
                    when: status.nextBusinessStart
                      ? new Date(status.nextBusinessStart).toLocaleString(
                          language === "pt" ? "pt-BR" : "en-US",
                          { weekday: "long", hour: "2-digit", minute: "2-digit" },
                        )
                      : "—",
                  })}
                </p>
                <ul className="mt-1 list-disc pl-5">
                  <li>{t("board.offHours.looks")}</li>
                  <li>{t("board.offHours.notices")}</li>
                  {settings?.features.devQueue && settings.live.devQueue && (
                    <li>{t("board.offHours.devQueue")}</li>
                  )}
                  <li>{t("board.offHours.waiting")}</li>
                </ul>
              </div>
            )}
            {status.lastError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
                <p className="font-medium">
                  {t("board.lastError")} · {formatUpdatedAt(status.lastError.at)}
                </p>
                <p className="break-words">{status.lastError.message}</p>
              </div>
            )}
            {status.pausedReason && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                {t("board.paused", {
                  reason: translateServerText(status.pausedReason, language),
                })}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void runCommand("run", boardWatcherApi.runBoardWatcherNow)}
                disabled={busy !== null}
                icon={
                  <RefreshCw className={`h-3.5 w-3.5 ${busy === "run" ? "animate-spin" : ""}`} />
                }
              >
                {t("board.action.run")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void togglePause()}
                disabled={busy !== null}
                icon={
                  status.pausedReason ? (
                    <Play className="h-3.5 w-3.5" />
                  ) : (
                    <Pause className="h-3.5 w-3.5" />
                  )
                }
              >
                {status.pausedReason ? t("board.action.resume") : t("board.action.pause")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void runCommand("digest", boardWatcherApi.sendBoardWatcherDigestNow)}
                disabled={busy !== null}
                icon={<Send className="h-3.5 w-3.5" />}
              >
                {t("board.action.digest")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenAutomation}
                icon={<Workflow className="h-3.5 w-3.5" />}
              >
                {t("board.action.automation")}
              </Button>
            </div>
          </section>
        )}

        {status && (
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {t("board.now.title")}
            </h3>
            <div className="flex flex-wrap gap-2">
              {status.running && <WatcherBadge tone="blue">{t("board.now.running")}</WatcherBadge>}
              {status.reviewing && (
                <WatcherBadge tone="blue">{t("board.now.reviewing")}</WatcherBadge>
              )}
              {!status.running && !status.reviewing && (
                <WatcherBadge>{t("board.now.idle")}</WatcherBadge>
              )}
            </div>
            {status.jobsBlockedBy && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                {t("board.now.blocked", {
                  reason: translateServerText(status.jobsBlockedBy, language),
                })}
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                  {t("board.now.pendingReviews")}
                </p>
                {status.pendingReviews.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t("board.now.none")}</p>
                ) : (
                  <ul className="flex flex-col gap-1 text-sm text-gray-800 dark:text-gray-200">
                    {status.pendingReviews.map((subject) => (
                      <li key={subject} className="break-all font-mono text-xs">
                        {subject}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                  {t("board.now.pendingTests")}
                </p>
                {status.pendingTests.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t("board.now.none")}</p>
                ) : (
                  <ul className="flex flex-col gap-1 text-sm text-gray-800 dark:text-gray-200">
                    {status.pendingTests.map((subject) => (
                      <li key={subject} className="break-all font-mono text-xs">
                        {subject}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        )}

        {status && (
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {t("board.decisions.title")}
            </h3>
            {lastDecisions.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t("board.decisions.none")}
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {DECISION_COLUMNS.map((column) => {
                  const items = decisionsByColumn(lastDecisions, column.id);
                  return (
                    <div
                      key={column.id}
                      className="flex min-w-0 flex-col gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-800"
                    >
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        {t(column.label)}
                      </h4>
                      {items.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {t("board.decisions.empty")}
                        </p>
                      ) : (
                        <ul className="flex flex-col gap-2">
                          {items.map((decision, index) => (
                            <li
                              key={`${decision.subject}-${index}`}
                              className="flex flex-col gap-1 border-b border-gray-100 pb-2 last:border-b-0 dark:border-gray-800"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="break-all font-mono text-xs font-medium text-gray-900 dark:text-gray-100">
                                  {decision.subject}
                                </span>
                                <WatcherBadge>
                                  {t(DECISION_ACTION_KEYS[decision.action])}
                                </WatcherBadge>
                              </div>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                {translateServerText(decision.reason, language)}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <WatcherHistory
          refreshKey={historyRefreshKey}
          feedback={feedback}
          onFeedbackSaved={onFeedbackSaved}
        />
      </div>
    </Modal>
  );
}
