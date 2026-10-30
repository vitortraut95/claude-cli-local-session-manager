import { ChevronRight, Pause, Play, RefreshCw, Send } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useToast } from "../hooks/useToast";
import type { TranslationKey } from "../i18n/translations";
import * as boardWatcherApi from "../services/boardWatcherApi";
import type { WatcherFeedback } from "../services/boardWatcherApi";
import { feedbackEntryKey } from "../../shared/boardWatcher";
import { WatcherFeedbackNote, WatcherVoteButtons } from "./WatcherFeedbackControls";
import type {
  AutomationSettings,
  BoardWatcherStatus,
  WatcherActionEntry,
  WatcherDecision,
} from "../services/boardWatcherApi";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { formatUpdatedAt } from "../utils/formatDate";
import {
  ACTION_KIND_KEYS,
  DECISION_ACTION_KEYS,
  HISTORY_FILTERS,
  decisionColumn,
  isRateable,
  matchesHistoryFilter,
  translateServerText,
  type DecisionColumn,
  type HistoryFilter,
} from "../utils/boardWatcher";
import { Button } from "./Button";
import { MarkdownView } from "./MarkdownView";
import { Modal } from "./Modal";

/** How often the status is re-read while the modal is open. */
const POLL_MS = 15_000;

const DECISION_COLUMNS: { id: DecisionColumn; label: TranslationKey }[] = [
  { id: "todo", label: "board.decisions.todo" },
  { id: "waitTest", label: "board.decisions.waitTest" },
  { id: "codeReview", label: "board.decisions.codeReview" },
];

const HISTORY_FILTER_KEYS: Record<HistoryFilter, TranslationKey> = {
  all: "board.history.filter.all",
  reviews: "board.history.filter.reviews",
  tests: "board.history.filter.tests",
  queue: "board.history.filter.queue",
  notices: "board.history.filter.notices",
};

/** Small colored label; the text says the same thing, so color is never the only signal. */
function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "blue" | "green" | "red";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    green: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
    red: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

type BoardWatcherModalProps = {
  onClose: () => void;
};

/** "18/20 (90%)", or "—" with no verdict yet. */
function scoreText(score: { up: number; down: number }): string {
  const total = score.up + score.down;
  return total === 0 ? "—" : `${score.up}/${total} (${Math.round((score.up / total) * 100)}%)`;
}

/** The board watcher at a glance: state, what it's doing, its last decisions and its history. */
export function BoardWatcherModal({ onClose }: BoardWatcherModalProps) {
  const { t, language } = useLanguage();
  const { showToast } = useToast();
  const [status, setStatus] = useState<BoardWatcherStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [actions, setActions] = useState<WatcherActionEntry[] | null>(null);
  const [actionsError, setActionsError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"run" | "pause" | "digest" | null>(null);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
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

  // The history changes when a look or a test finishes, so it's re-read then.
  const lastTickAt = status?.lastTickAt ?? null;
  const reviewing = status?.reviewing ?? false;
  useEffect(() => {
    let cancelled = false;
    boardWatcherApi
      .fetchWatcherActions(200)
      .then((result) => {
        if (!cancelled) {
          setActions(result);
          setActionsError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setActionsError(resolveApiErrorMessage(err, t, "board.history.loadError"));
      });
    return () => {
      cancelled = true;
    };
  }, [lastTickAt, reviewing, t]);

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

  const visibleActions = (actions ?? []).filter((entry) =>
    matchesHistoryFilter(entry, historyFilter),
  );
  const lastDecisions = status?.lastDecisions ?? [];

  return (
    <Modal open title={t("board.title")} onClose={onClose} size="xxl">
      <div className="flex flex-col gap-6">
        {statusError && <p className="text-sm text-red-600 dark:text-red-400">{statusError}</p>}

        {status && (
          <section className="flex flex-col gap-4 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={status.enabled ? "green" : "neutral"}>
                {status.enabled ? t("board.enabled.on") : t("board.enabled.off")}
              </Badge>
              {status.mode && (
                <Badge tone={status.live.length > 0 ? "red" : "blue"}>
                  {status.live.length > 0
                    ? t("board.mode.live", { count: status.live.length })
                    : t("board.mode.simulate")}
                </Badge>
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
            </div>
          </section>
        )}

        {status && (
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {t("board.now.title")}
            </h3>
            <div className="flex flex-wrap gap-2">
              {status.running && <Badge tone="blue">{t("board.now.running")}</Badge>}
              {status.reviewing && <Badge tone="blue">{t("board.now.reviewing")}</Badge>}
              {!status.running && !status.reviewing && <Badge>{t("board.now.idle")}</Badge>}
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
                                <Badge>{t(DECISION_ACTION_KEYS[decision.action])}</Badge>
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

        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {t("board.history.title")}
            </h3>
            <div
              role="group"
              aria-label={t("board.history.filter")}
              className="flex flex-wrap gap-1.5"
            >
              {HISTORY_FILTERS.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  aria-pressed={historyFilter === filter}
                  onClick={() => setHistoryFilter(filter)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    historyFilter === filter
                      ? "border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900"
                      : "border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                  }`}
                >
                  {t(HISTORY_FILTER_KEYS[filter])}
                </button>
              ))}
            </div>
          </div>

          {actionsError && <p className="text-sm text-red-600 dark:text-red-400">{actionsError}</p>}
          {!actionsError && actions === null && (
            <p className="text-sm text-gray-500 dark:text-gray-400">…</p>
          )}
          {actions !== null && visibleActions.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t("board.history.empty")}</p>
          )}
          {visibleActions.length > 0 && (
            <ul className="flex flex-col divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
              {visibleActions.map((entry, index) => (
                <li key={`${entry.ts}-${entry.subject}-${index}`}>
                  <details className="group px-3 py-2">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 text-sm">
                      <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-open:rotate-90" />
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatUpdatedAt(entry.ts)}
                      </span>
                      <Badge tone={entry.action.endsWith("failed") ? "red" : "neutral"}>
                        {t(ACTION_KIND_KEYS[entry.action])}
                      </Badge>
                      {entry.live && (
                        <span title={t("board.history.live.title")}>
                          <Badge tone="green">{t("board.history.live")}</Badge>
                        </span>
                      )}
                      <span className="break-all font-mono text-xs font-medium text-gray-900 dark:text-gray-100">
                        {entry.subject}
                      </span>
                      <span className="min-w-0 break-words text-gray-700 dark:text-gray-300">
                        {entry.title}
                      </span>
                      {isRateable(entry) && (
                        <WatcherVoteButtons
                          entry={entry}
                          feedback={feedback[feedbackEntryKey(entry)]}
                          onSaved={onFeedbackSaved}
                        />
                      )}
                    </summary>
                    <div className="mt-3 flex flex-col gap-3 pl-6">
                      {feedback[feedbackEntryKey(entry)] && (
                        <WatcherFeedbackNote
                          key={feedback[feedbackEntryKey(entry)]?.verdict}
                          entry={entry}
                          feedback={feedback[feedbackEntryKey(entry)]!}
                          onSaved={onFeedbackSaved}
                        />
                      )}
                      {entry.detail && <MarkdownView source={entry.detail} />}
                      {entry.files && entry.files.length > 0 && (
                        <div className="flex flex-col gap-2">
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            {t("board.history.evidence")}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {entry.files.map((file) => {
                              const name = file.split(/[\\/]/).pop() ?? file;
                              return (
                                <a
                                  key={file}
                                  href={boardWatcherApi.evidenceUrl(file)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={t("board.history.openEvidence", { name })}
                                  className="block overflow-hidden rounded-md border border-gray-200 dark:border-gray-800"
                                >
                                  <img
                                    src={boardWatcherApi.evidenceUrl(file)}
                                    alt={name}
                                    loading="lazy"
                                    className="h-24 w-auto max-w-48 object-cover object-top"
                                  />
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  );
}
