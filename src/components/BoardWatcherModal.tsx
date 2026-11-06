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
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useLanguage } from "../hooks/useLanguage";
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
import { formatUpdatedAt } from "../utils/formatDate";
import { modeOf, MODE_AUTOMATIONS, type AutomationMode } from "../../shared/automationModes";
import type { AutomationFocus } from "./AutomationModesEditor";
import { AnchoredMenu } from "./AnchoredMenu";
import { AttentionPanel } from "./AttentionPanel";
import { BoardQueue } from "./BoardQueue";
import { Button } from "./Button";
import { DailyPreviewPanel } from "./DailyPreviewPanel";
import { HomologPanel } from "./HomologPanel";
import { AutomationSetupModal } from "./AutomationSetupModal";
import { Modal } from "./Modal";
import { ToolbarIconButton } from "./ToolbarIconButton";
import { BetaBadge } from "./BetaBadge";
import { LiveActivityPanel } from "./LiveActivityPanel";
import { WatcherEye, type EyeState } from "./WatcherEye";
import { Tooltip } from "./Tooltip";
import { WatcherHistory } from "./WatcherHistory";

/** How often the status is re-read while the modal is open. */
const POLL_MS = 15_000;

type BoardWatcherModalProps = {
  onClose: () => void;
  /** Opens the Automation settings (in place of this modal), highlighting one automation's card. */
  onOpenAutomation: (focus?: AutomationFocus) => void;
};

/** "18/20 (90%)", or "—" with no verdict yet. */
function scoreText(score: { up: number; down: number } | undefined): string {
  if (!score) return "—";
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

  const modes = settings
    ? MODE_AUTOMATIONS.map((automation) => ({
        automation,
        mode: modeOf(automation, { features: settings.features, live: settings.live }),
      }))
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

  return (
    <Modal
      open
      title={t("board.title")}
      onClose={() => {
        if (!tool) onClose();
      }}
      size="full"
      tone="night"
      icon={<WatcherEye state={eyeState} className="h-5 w-8" />}
    >
      <div className="flex flex-col gap-5">
        {statusError && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-red-600 dark:text-red-400">{statusError}</p>
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

        {status && (
          // A 1px gradient frame around the hero, in the eye's colors.
          <div className="rounded-2xl bg-gradient-to-r from-violet-500/70 via-fuchsia-500/50 to-cyan-400/70 p-px shadow-lg shadow-violet-500/10 dark:shadow-violet-900/30">
            <section className="relative flex flex-col gap-3 overflow-hidden rounded-[15px] bg-gradient-to-br from-violet-950/90 via-gray-950 to-fuchsia-950/60 px-5 py-3 lg:flex-row lg:items-center">
              <div
                aria-hidden="true"
                className="watcher-dots pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(to_right,black,transparent_70%)]"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgb(217_70_239/0.22),transparent_65%)]"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-28 left-4 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgb(34_211_238/0.12),transparent_65%)]"
              />
              <div className="relative flex min-w-0 flex-1 items-center gap-4">
                <div className="relative shrink-0">
                  <div
                    aria-hidden="true"
                    className="absolute -inset-4 rounded-full bg-[radial-gradient(circle,rgb(139_92_246/0.35),transparent_65%)]"
                  />
                  <WatcherEye state={eyeState} className="relative h-12 w-20" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold tracking-widest text-violet-600 uppercase dark:text-violet-300">
                      {t("board.hero.title")}
                    </p>
                    <BetaBadge />
                    {isBoardDemo() && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-200 uppercase ring-1 ring-amber-400/40 ring-inset">
                        {t("board.demo")}
                      </span>
                    )}
                  </div>
                  <p className="flex flex-wrap items-baseline gap-x-3">
                    <span className="flex items-center gap-2 bg-gradient-to-r from-violet-200 via-fuchsia-200 to-cyan-200 bg-clip-text text-xl font-semibold tracking-tight text-transparent">
                      {eyeText}
                      {offHoursList && (
                        <Tooltip content={offHoursList}>
                          <button
                            type="button"
                            aria-label={t("board.offHours.info")}
                            className="rounded-full text-violet-500 hover:text-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 dark:text-violet-300 dark:hover:text-violet-100"
                          >
                            <Info className="h-4 w-4" />
                          </button>
                        </Tooltip>
                      )}
                    </span>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {status.nextLookAt
                        ? t("board.nextLookIn", { when: formatUpdatedAt(status.nextLookAt) })
                        : t("board.never")}
                    </span>
                  </p>
                  {settings && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {modes.map(({ automation, mode }) => (
                        <button
                          key={automation}
                          type="button"
                          onClick={() => onOpenAutomation(automation)}
                          title={t("board.mode.chip.hint")}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition before:h-1.5 before:w-1.5 before:rounded-full before:content-[''] hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 ${MODE_CHIP[mode]}`}
                        >
                          {t(`board.mode.chip.${automation}` as TranslationKey)}:{" "}
                          {t(MODE_LABEL[mode])}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => onOpenAutomation("notices")}
                        title={t("board.mode.chip.hint")}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition before:h-1.5 before:w-1.5 before:rounded-full before:content-[''] hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 ${noticesOn ? MODE_CHIP.live : MODE_CHIP.off}`}
                      >
                        {t("board.mode.chip.notices")}:{" "}
                        {noticesOn ? t("board.mode.chip.on") : t("automationModes.mode.off")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="relative flex flex-wrap gap-2 lg:justify-end">
                <Tooltip
                  content={
                    status.businessTime ? null : t("board.action.run.closed", { when: opensAt })
                  }
                >
                  <span className="inline-flex">
                    <Button
                      variant="unstyled"
                      size="sm"
                      className="rounded-lg bg-violet-600 text-white shadow-sm ring-1 ring-violet-400/30 ring-inset hover:bg-violet-500 focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:outline-none disabled:opacity-60"
                      onClick={() => void runCommand("run", boardWatcherApi.runBoardWatcherNow)}
                      disabled={busy !== null || !status.businessTime}
                      icon={
                        <RefreshCw
                          className={`h-3.5 w-3.5 ${busy === "run" ? "animate-spin" : ""}`}
                        />
                      }
                    >
                      {t("board.action.run")}
                    </Button>
                  </span>
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
                  </Tooltip>
                )}
                <AnchoredMenu
                  buttonClassName="gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                  label={
                    <>
                      <Wrench className="h-3.5 w-3.5" />
                      {t("board.tools")}
                    </>
                  }
                >
                  {(close) => (
                    <div className="flex min-w-48 flex-col py-1">
                      {(
                        [
                          ["daily", CalendarDays, t("board.tools.daily")],
                          ["homolog", GitBranch, t("board.tools.homolog")],
                        ] as const
                      ).map(([key, Icon, label]) => (
                        <button
                          key={key}
                          type="button"
                          disabled={!status.enabled || !status.businessTime}
                          onClick={() => {
                            close();
                            setTool(key);
                          }}
                          className="flex items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {label}
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={busy !== null || !status.businessTime}
                        onClick={() => {
                          close();
                          void runCommand("digest", boardWatcherApi.sendBoardWatcherDigestNow);
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-800"
                      >
                        <Send className="h-3.5 w-3.5" />
                        {t("board.action.digest")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          close();
                          onOpenAutomation();
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                      >
                        <Workflow className="h-3.5 w-3.5" />
                        {t("board.action.automation")}
                      </button>
                    </div>
                  )}
                </AnchoredMenu>
                <ToolbarIconButton
                  tooltip={t("settings.boardAutomations.setup")}
                  ariaLabel={t("settings.boardAutomations.setup")}
                  icon={<Settings />}
                  color="violet"
                  onClick={() => setTool("setup")}
                />
              </div>
            </section>
          </div>
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
              <BoardQueue status={status} items={queue} />
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
        >
          {tool === "daily" ? <DailyPreviewPanel /> : <HomologPanel />}
        </Modal>
      )}
    </Modal>
  );
}

const MODE_CHIP: Record<AutomationMode, string> = {
  off: "bg-white/5 text-gray-400 ring-1 ring-inset ring-white/10 before:bg-gray-500",
  simulate:
    "bg-violet-500/10 text-violet-200 ring-1 ring-inset ring-violet-400/30 before:bg-violet-400",
  live: "bg-emerald-500/10 text-emerald-200 ring-1 ring-inset ring-emerald-400/30 before:bg-emerald-400",
};

const MODE_LABEL: Record<AutomationMode, TranslationKey> = {
  off: "automationModes.mode.off",
  simulate: "automationModes.mode.simulate",
  live: "automationModes.mode.live",
};

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
    <div className="relative flex flex-col gap-1.5 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-4 ring-1 ring-inset ring-white/[0.02]">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 opacity-80"
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium tracking-wider text-gray-400 uppercase">{label}</p>
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/15 to-cyan-400/15 text-violet-600 dark:from-violet-400/20 dark:to-cyan-400/10 dark:text-violet-300">
          {icon}
        </span>
      </div>
      <p className="text-3xl font-semibold tracking-tight text-white tabular-nums">{value}</p>
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
