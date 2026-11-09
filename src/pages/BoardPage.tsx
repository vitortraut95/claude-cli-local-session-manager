import {
  CalendarDays,
  CheckCheck,
  FlaskConical,
  Sparkles,
  Target,
  GitBranch,
  Info,
  Pause,
  Play,
  RefreshCw,
  Send,
  Settings,
  Workflow,
  Wrench,
  EyeOff,
  Pencil,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useShell } from "../hooks/useShell";
import { useToast } from "../hooks/useToast";
import type { TranslationKey } from "../i18n/translations";
import * as boardWatcherApi from "../services/boardWatcherApi";
import type {
  AutomationSettings,
  BoardWatcherStatus,
  WatcherActivity,
  WatcherFeedback,
} from "../services/boardWatcherApi";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { isBoardDemo } from "../utils/boardDemo";
import { queueItems } from "../utils/boardQueue";
import { translateServerText } from "../utils/boardWatcher";
import { formatUpdatedAt } from "../utils/formatDate";
import { AUTOMATIONS } from "../../shared/boardWatcher";
import { AnchoredMenu } from "../components/AnchoredMenu";
import { AttentionPanel } from "../components/AttentionPanel";
import { BoardQueue } from "../components/BoardQueue";
import { Button } from "../components/Button";
import { DailyPreviewPanel } from "../components/DailyPreviewPanel";
import { HomologPanel } from "../components/HomologPanel";
import { AutomationSetupModal } from "../components/AutomationSetupModal";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { BetaBadge } from "../components/BetaBadge";
import { LiveActivityPanel } from "../components/LiveActivityPanel";
import { WatcherEye, type EyeState } from "../components/WatcherEye";
import { Tooltip } from "../components/Tooltip";
import { WatcherHistory } from "../components/WatcherHistory";

/** How often the status is re-read while the page is open. */
const POLL_MS = 15_000;

/** "18/20 (90%)", or "—" with no verdict yet. */
function scoreText(score: { up: number; down: number } | undefined): string {
  if (!score) return "—";
  const total = score.up + score.down;
  return total === 0 ? "—" : `${score.up}/${total} (${Math.round((score.up / total) * 100)}%)`;
}

/** The Board page; while its automations (beta) are off, how to turn them on. */
export function BoardPage() {
  const { automationsOn } = useShell();
  return automationsOn ? <BoardWatcher /> : <BoardOff />;
}

function BoardOff() {
  const { t } = useLanguage();
  const { openSettings } = useShell();
  return (
    <div className="flex min-h-dvh flex-col">
      <PageHeader
        title={
          <>
            {t("board.title")} <BetaBadge />
          </>
        }
        subtitle={t("boardPage.subtitle")}
      />
      <div className="mx-auto flex max-w-xl flex-col items-center px-6 py-20 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
          <EyeOff className="h-7 w-7" aria-hidden="true" />
        </span>
        <h2 className="mt-5 text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t("boardPage.off.title")}
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{t("boardPage.off.body")}</p>
        <Button className="mt-6" onClick={openSettings} icon={<Settings className="h-4 w-4" />}>
          {t("boardPage.off.openSettings")}
        </Button>
      </div>
    </div>
  );
}

/** The board watcher at a glance: state, what it's doing, its last decisions and its history. */
function BoardWatcher() {
  const { t, language } = useLanguage();
  const { openAutomation: onOpenAutomation, automationRevision } = useShell();
  const { showToast } = useToast();
  const [status, setStatus] = useState<BoardWatcherStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [busy, setBusy] = useState<"run" | "pause" | "digest" | null>(null);
  const [feedback, setFeedback] = useState<Record<string, WatcherFeedback>>({});
  const [liveCurrent, setLiveCurrent] = useState<WatcherActivity["current"]>(null);
  const [tool, setTool] = useState<"daily" | "homolog" | "setup" | null>(null);

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
  }, [t, automationRevision]);

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
  }, [automationRevision]);

  // The history changes when a look or a session finishes, so it's re-read then.
  const historyRefreshKey = `${status?.lastTickAt ?? ""}|${String(status?.reviewing ?? false)}`;

  const startItemNow = async (subject: string) => {
    try {
      const result = await boardWatcherApi.startBoardWatcherItemNow(subject);
      setStatus(result);
      const still = result.lastDecisions.find(
        (d) => d.subject === subject && (d.action === "wait" || d.action === "skip"),
      );
      if (still) {
        showToast(
          t("board.queue.startNow.stillWaiting", {
            subject,
            reason: translateServerText(still.reason, language),
          }),
          "error",
        );
      } else {
        showToast(t("board.queue.startNow.started", { subject }), "success");
      }
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "board.actionError"), "error");
    }
  };

  // Shown in the new order right away; saved in the background.
  const reorderQueue = async (subjects: string[]) => {
    setStatus((current) => (current ? { ...current, priority: subjects } : current));
    try {
      setStatus(await boardWatcherApi.prioritizeBoardWatcherItems(subjects));
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "board.actionError"), "error");
    }
  };

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

  const eyeState: EyeState = !status?.enabled
    ? "sleeping"
    : status.pausedReason
      ? "paused"
      : status.running || status.reviewing || liveCurrent
        ? "analyzing"
        : status.businessTime
          ? "watching"
          : "sleeping";
  const opensAt = status?.nextBusinessStart
    ? new Date(status.nextBusinessStart).toLocaleString(language === "pt" ? "pt-BR" : "en-US", {
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
  const eyeText = !status?.enabled
    ? t("board.eye.sleepingOff")
    : status.pausedReason
      ? t("board.eye.paused")
      : eyeState === "analyzing"
        ? t("board.eye.analyzing")
        : eyeState === "watching"
          ? t("board.eye.watching")
          : t("board.eye.sleepingHours", {
              when: status.nextBusinessStart
                ? new Date(status.nextBusinessStart).toLocaleString(
                    language === "pt" ? "pt-BR" : "en-US",
                    { weekday: "long", hour: "2-digit", minute: "2-digit" },
                  )
                : "—",
            });

  const automationChips = settings
    ? AUTOMATIONS.map((automation) => ({ automation, on: settings.features[automation] }))
    : [];
  const noticesOn = settings ? settings.features.instantNotices || settings.features.digest : false;
  const queue = status ? queueItems(status, liveCurrent) : [];
  const nextUp = queue
    .filter((item) => item.state === "queued" || item.state === "next")
    .map((item) => item.subject)
    .slice(0, 3);
  const offHoursList = status && status.enabled && !status.businessTime && (
    <ul className="list-disc space-y-0.5 pl-4 text-left">
      <li>{t("board.offHours.looks")}</li>
      <li>{t("board.offHours.notices")}</li>
      <li>{t("board.offHours.devQueue")}</li>
      <li>{t("board.offHours.waiting")}</li>
      {noticesOn && settings?.features.digest && <li>{t("board.offHours.digest")}</li>}
    </ul>
  );

  const chipClass =
    "inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium ring-1 ring-inset transition before:h-1.5 before:w-1.5 before:rounded-full before:content-[''] hover:brightness-110";

  return (
    <div className="flex min-h-dvh flex-col">
      <PageHeader
        title={
          <>
            <WatcherEye state={eyeState} className="h-6 w-10" />
            {t("board.title")}
            <BetaBadge />
            {isBoardDemo() && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-800 uppercase ring-1 ring-amber-400/40 ring-inset dark:text-amber-200">
                {t("board.demo")}
              </span>
            )}
          </>
        }
        subtitle={t("boardPage.subtitle")}
        actions={
          status && (
            <>
              <AnchoredMenu
                align="right"
                buttonClassName="min-h-10 gap-2 rounded-lg border border-gray-300 bg-white px-3.5 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
                label={
                  <>
                    <Wrench className="h-4 w-4" />
                    {t("board.tools")}
                  </>
                }
              >
                {(close) => (
                  <div className="flex min-w-52 flex-col py-1">
                    {(
                      [
                        ["daily", CalendarDays, t("board.tools.daily")],
                        ["homolog", GitBranch, t("board.tools.homolog")],
                      ] as const
                    ).map(([key, Icon, label]) => (
                      <button
                        key={key}
                        type="button"
                        role="menuitem"
                        disabled={!status.enabled || !status.businessTime}
                        onClick={() => {
                          close();
                          setTool(key);
                        }}
                        className="flex min-h-9 items-center gap-2 rounded-md px-3 text-left text-sm text-gray-800 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </button>
                    ))}
                    <button
                      type="button"
                      role="menuitem"
                      disabled={busy !== null || !status.businessTime}
                      onClick={() => {
                        close();
                        void runCommand("digest", boardWatcherApi.sendBoardWatcherDigestNow);
                      }}
                      className="flex min-h-9 items-center gap-2 rounded-md px-3 text-left text-sm text-gray-800 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      <Send className="h-4 w-4" />
                      {t("board.action.digest")}
                    </button>
                  </div>
                )}
              </AnchoredMenu>
              <Tooltip content={t("settings.boardAutomations.setup")}>
                <Button
                  variant="outline"
                  size="icon"
                  className="min-h-10 min-w-10 text-violet-700 dark:text-violet-300"
                  onClick={() => setTool("setup")}
                  aria-label={t("settings.boardAutomations.setup")}
                  icon={<Settings className="h-4 w-4" />}
                />
              </Tooltip>
              {/* Outside business hours everything is already stopped: only a pause to undo shows. */}
              {status.enabled && (status.businessTime || status.pausedReason) && (
                <Tooltip
                  content={
                    status.pausedReason
                      ? t("board.action.resume.hint")
                      : t("board.action.pause.hint")
                  }
                >
                  <Button
                    variant="outline"
                    onClick={() => void togglePause()}
                    disabled={busy !== null}
                    icon={
                      status.pausedReason ? (
                        <Play className="h-4 w-4" />
                      ) : (
                        <Pause className="h-4 w-4" />
                      )
                    }
                  >
                    {status.pausedReason ? t("board.action.resume") : t("board.action.pause")}
                  </Button>
                </Tooltip>
              )}
              <Tooltip
                content={
                  status.businessTime ? null : t("board.action.run.closed", { when: opensAt })
                }
              >
                <span className="inline-flex">
                  <Button
                    onClick={() => void runCommand("run", boardWatcherApi.runBoardWatcherNow)}
                    disabled={busy !== null || !status.businessTime}
                    icon={
                      <RefreshCw className={`h-4 w-4 ${busy === "run" ? "animate-spin" : ""}`} />
                    }
                  >
                    {t("board.action.run")}
                  </Button>
                </span>
              </Tooltip>
            </>
          )
        }
      />

      <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-5 px-4 py-6 sm:px-7">
        {statusError && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-500/30 dark:bg-red-950/40"
          >
            <p className="flex-1 text-sm text-red-700 dark:text-red-300">{statusError}</p>
            {/* The settings stay reachable when the status can't be read. */}
            {!status && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenAutomation()}
                icon={<Workflow className="h-3.5 w-3.5" />}
              >
                {t("board.action.automation")}
              </Button>
            )}
          </div>
        )}

        {!status && !statusError && (
          <div aria-hidden="true" className="flex flex-col gap-4">
            <div className="skeleton h-24 rounded-xl bg-gray-200 dark:bg-gray-800/60" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className="skeleton h-28 rounded-xl bg-gray-200 dark:bg-gray-800/60"
                />
              ))}
            </div>
          </div>
        )}

        {status && (
          <section
            aria-label={t("board.hero.title")}
            className="relative flex flex-col gap-4 overflow-hidden rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-white px-5 py-4 lg:flex-row lg:items-center dark:border-violet-500/25 dark:from-violet-950/70 dark:via-gray-950 dark:to-gray-950"
          >
            <div
              aria-hidden="true"
              className="watcher-dots pointer-events-none absolute inset-0 opacity-50 [mask-image:linear-gradient(to_right,black,transparent_60%)]"
            />
            <div className="relative flex min-w-0 flex-1 items-center gap-4">
              <div className="relative shrink-0">
                <div
                  aria-hidden="true"
                  className="absolute -inset-3 rounded-full bg-[radial-gradient(circle,rgb(107_78_255/0.25),transparent_65%)]"
                />
                <WatcherEye state={eyeState} className="relative h-11 w-[4.5rem]" />
              </div>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-gray-900 dark:text-gray-100">
                  {eyeText}
                  {offHoursList && (
                    <Tooltip content={offHoursList}>
                      <button
                        type="button"
                        aria-label={t("board.offHours.info")}
                        className="rounded-full text-violet-600 hover:text-violet-800 dark:text-violet-300 dark:hover:text-violet-100"
                      >
                        <Info className="h-4 w-4" />
                      </button>
                    </Tooltip>
                  )}
                </p>
                <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                  {status.pausedReason
                    ? t("board.resumeForNextLook")
                    : status.nextLookAt
                      ? t("board.nextLookIn", { when: formatUpdatedAt(status.nextLookAt, language) })
                      : t("board.never")}
                </p>
              </div>
            </div>
            {settings && (
              <div className="relative flex flex-col gap-1.5">
              <p className="text-xs text-gray-600 dark:text-gray-400">{t("board.mode.chips.label")}</p>
              <ul aria-label={t("boardPage.modes")} className="flex flex-wrap gap-2">
                {automationChips.map(({ automation, on }) => (
                  <li key={automation}>
                    <button
                      type="button"
                      onClick={() => onOpenAutomation(automation)}
                      title={t("board.mode.chip.hint")}
                      className={`${chipClass} ${on ? CHIP_ON : CHIP_OFF}`}
                    >
                      {t(`board.mode.chip.${automation}` as TranslationKey)}:{" "}
                      {t(on ? "automationModes.on" : "automationModes.off")}
                      <Pencil aria-hidden="true" className="h-3 w-3 opacity-60" />
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={() => onOpenAutomation("notices")}
                    title={t("board.mode.chip.hint")}
                    className={`${chipClass} ${noticesOn ? CHIP_ON : CHIP_OFF}`}
                  >
                    {t("board.mode.chip.notices")}:{" "}
                    {t(noticesOn ? "automationModes.on" : "automationModes.off")}
                    <Pencil aria-hidden="true" className="h-3 w-3 opacity-60" />
                  </button>
                </li>
              </ul>
              </div>
            )}
          </section>
        )}

        {status && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              icon={<CheckCheck className="h-4 w-4" />}
              label={t("board.tile.approvals")}
              value={`${status.approvalsToday} / ${settings?.limits.maxApprovesPerDay ?? "?"}`}
              ratio={settings ? status.approvalsToday / settings.limits.maxApprovesPerDay : null}
            />
            <StatTile
              icon={<FlaskConical className="h-4 w-4" />}
              label={t("board.tile.tests")}
              value={`${status.testClaimsToday} / ${settings?.limits.maxClaimsPerDay ?? "?"}`}
              ratio={settings ? status.testClaimsToday / settings.limits.maxClaimsPerDay : null}
            />
            <StatTile
              icon={<Sparkles className="h-4 w-4" />}
              label={t("board.tile.sessions")}
              value={String((status.today?.reviews ?? 0) + (status.today?.tests ?? 0))}
              detail={t("board.tile.sessionsDetail", {
                reviews: status.today?.reviews ?? 0,
                tests: status.today?.tests ?? 0,
                minutes: Math.round((status.today?.durationMs ?? 0) / 60_000),
                cost: (status.today?.costUsd ?? 0).toFixed(2),
              })}
            />
            <StatTile
              icon={<Target className="h-4 w-4" />}
              label={t("board.tile.accuracy", { days: status.scoreboard?.days ?? 14 })}
              value={percent(status.scoreboard?.reviews)}
              detail={t("board.tile.accuracyDetail", {
                reviews: scoreText(status.scoreboard?.reviews),
                tests: scoreText(status.scoreboard?.tests),
              })}
            />
          </div>
        )}

        {status && (
          <div className="grid gap-5 xl:grid-cols-5">
            <div className="flex min-w-0 flex-col gap-5 xl:col-span-3">
              <AttentionPanel status={status} refreshKey={historyRefreshKey} />
              <BoardQueue
                status={status}
                items={queue}
                onStartNow={startItemNow}
                onReorder={(subjects) => void reorderQueue(subjects)}
              />
            </div>
            <div className="min-w-0 xl:col-span-2">
              <LiveActivityPanel
                onCurrentChange={setLiveCurrent}
                nextUp={nextUp}
                stoppedText={
                  !status.enabled
                    ? t("board.live.off")
                    : status.pausedReason
                      ? t("board.live.paused")
                      : status.businessTime
                        ? null
                        : t("board.live.closed", { when: opensAt })
                }
              />
            </div>
          </div>
        )}

        <WatcherHistory
          refreshKey={historyRefreshKey}
          linkBases={status?.linkBases}
          feedback={feedback}
          onFeedbackSaved={onFeedbackSaved}
        />
      </div>

      {tool === "setup" && <AutomationSetupModal onClose={() => setTool(null)} />}
      {(tool === "daily" || tool === "homolog") && (
        <Modal
          open
          title={tool === "daily" ? t("board.tools.daily") : t("board.tools.homolog")}
          onClose={() => setTool(null)}
          size="xl"
          placement="side"
        >
          {tool === "daily" ? <DailyPreviewPanel /> : <HomologPanel />}
        </Modal>
      )}
    </div>
  );
}

/** On is green (a status color, never the brand's), off is gray. */
const CHIP_ON =
  "bg-emerald-50 text-emerald-800 ring-emerald-300 before:bg-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-400/30 dark:before:bg-emerald-400";
const CHIP_OFF =
  "bg-white text-gray-600 ring-gray-300 before:bg-gray-400 dark:bg-white/5 dark:text-gray-400 dark:ring-white/10 dark:before:bg-gray-500";

/** "100%", or "—" with no verdict yet. */
function percent(score: { up: number; down: number } | undefined): string {
  const total = score ? score.up + score.down : 0;
  return score && total > 0 ? `${Math.round((score.up / total) * 100)}%` : "—";
}

function StatTile({
  icon,
  label,
  value,
  detail,
  ratio,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: string;
  /** Used / limit, for a bar; null = no bar. */
  ratio?: number | null;
}) {
  const filled = ratio === null || ratio === undefined ? null : Math.min(1, Math.max(0, ratio));
  return (
    <div className="relative flex flex-col gap-1.5 overflow-hidden rounded-xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-violet-500 opacity-70" />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400">{label}</p>
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/15 to-cyan-400/15 text-violet-600 dark:from-violet-400/20 dark:to-cyan-400/10 dark:text-violet-300">
          {icon}
        </span>
      </div>
      <p className="text-3xl font-semibold tracking-tight text-gray-900 tabular-nums dark:text-white">
        {value}
      </p>
      {filled !== null && (
        <div
          className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
          aria-hidden="true"
        >
          <div
            className={`h-full rounded-full ${
              filled >= 1
                ? "bg-red-500"
                : filled >= 0.75
                  ? "bg-amber-500"
                  : "bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400"
            }`}
            style={{ width: `${filled * 100}%` }}
          />
        </div>
      )}
      {detail && <p className="text-xs text-gray-500 dark:text-gray-400">{detail}</p>}
    </div>
  );
}
