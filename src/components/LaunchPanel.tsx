import { ChevronsLeft, ChevronsRight, ExternalLink, Loader2, Rocket, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useQueueLaunches } from "../hooks/useQueueLaunches";
import type { TranslationKey } from "../i18n/translations";
import type { QueueLaunch, QueueLaunchStep } from "../services/tasksApi";
import type { Step } from "../utils/steps";
import { Button } from "./Button";
import { StepList } from "./StepList";
import { TaskQueueKindBadge } from "./TaskQueueKind";

const COLLAPSED_KEY = "launchPanel.collapsed";
/** How long a launch that went fine stays on screen before the panel closes by itself. */
const CLOSE_AFTER_MS = 3_000;

const STEP_LABELS: Record<string, TranslationKey> = {
  repo: "launchPanel.step.repo",
  base: "launchPanel.step.base",
  worktree: "launchPanel.step.worktree",
  prepare: "launchPanel.step.prepare",
  terminal: "launchPanel.step.terminal",
  session: "launchPanel.step.session",
};

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    // A convenience only.
  }
}

type LaunchPanelProps = {
  /** Opens the task queue, where a failed launch is retried. */
  onOpenQueue: () => void;
};

/**
 * Floating on the right while the queue launches something: each launch's steps, live. Folds into
 * a tab at the edge; closes by itself a moment after every launch went fine, and stays (until
 * closed) when one failed.
 */
export function LaunchPanel({ onOpenQueue }: LaunchPanelProps) {
  const { t } = useLanguage();
  const launches = useQueueLaunches();
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const shown = launches.filter((launch) => !dismissed.has(launch.id));
  const running = shown.filter((launch) => !launch.finishedAt).length;
  const failed = shown.some((launch) => launch.error);
  const allDone = shown.length > 0 && running === 0;

  const dismissShown = () =>
    setDismissed((current) => new Set([...current, ...shown.map((launch) => launch.id)]));

  // Everything went fine: let the last "done" be seen, then close.
  const shownIds = shown.map((launch) => launch.id).join(",");
  useEffect(() => {
    if (!allDone || failed) return;
    const ids = shownIds.split(",");
    const timer = window.setTimeout(
      () => setDismissed((current) => new Set([...current, ...ids])),
      CLOSE_AFTER_MS,
    );
    return () => window.clearTimeout(timer);
  }, [allDone, failed, shownIds]);

  if (shown.length === 0) return null;

  const toggle = (next: boolean) => {
    setCollapsed(next);
    writeCollapsed(next);
  };

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => toggle(false)}
        aria-label={t("launchPanel.expand")}
        title={t("launchPanel.expand")}
        className={`fixed top-1/3 right-0 z-40 flex flex-col items-center gap-2 rounded-l-xl border border-r-0 px-2 py-3 shadow-lg ${
          failed
            ? "border-red-300 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-950 dark:text-red-300"
            : "border-gray-200 bg-white text-violet-700 dark:border-gray-700 dark:bg-gray-900 dark:text-violet-300"
        }`}
      >
        <ChevronsLeft className="h-4 w-4" />
        {running > 0 ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Rocket className="h-4 w-4" />
        )}
        <span className="text-xs font-semibold tabular-nums">{running || shown.length}</span>
      </button>
    );
  }

  return (
    <aside
      aria-label={t("launchPanel.title")}
      className="fixed top-4 right-4 z-40 flex max-h-[calc(100dvh-6rem)] w-[min(22rem,calc(100%-2rem))] flex-col rounded-xl border border-gray-200 bg-white shadow-xl lg:max-h-[calc(100dvh-2rem)] dark:border-gray-700 dark:bg-gray-900"
    >
      <header className="flex items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        {running > 0 ? (
          <Loader2 className="h-4 w-4 animate-spin text-violet-600 dark:text-violet-400" />
        ) : (
          <Rocket className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        )}
        <h2 className="flex-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
          {running > 0 ? t("launchPanel.running", { count: running }) : t("launchPanel.title")}
        </h2>
        <button
          type="button"
          onClick={() => toggle(true)}
          aria-label={t("launchPanel.collapse")}
          title={t("launchPanel.collapse")}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
        {allDone && (
          <button
            type="button"
            onClick={dismissShown}
            aria-label={t("launchPanel.close")}
            title={t("launchPanel.close")}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </header>
      <ol className="flex flex-col gap-3 overflow-y-auto p-4">
        {shown.map((launch) => (
          <LaunchCard key={launch.id} launch={launch} onOpenQueue={onOpenQueue} />
        ))}
      </ol>
    </aside>
  );
}

function LaunchCard({ launch, onOpenQueue }: { launch: QueueLaunch; onOpenQueue: () => void }) {
  const { t } = useLanguage();
  const label = (step: QueueLaunchStep) =>
    step.key.startsWith("extra:")
      ? t("launchPanel.step.extra", { repo: step.label ?? step.key.slice("extra:".length) })
      : t(STEP_LABELS[step.key] ?? "launchPanel.step.prepare");
  const steps: Step[] = launch.steps.map((step) => ({
    key: step.key,
    label: label(step),
    status: step.status,
    error: step.error,
  }));
  const keys = launch.keys.join(" + ");

  return (
    <li className="flex flex-col gap-2.5 rounded-lg border border-gray-200 p-3 dark:border-gray-800">
      <div className="flex flex-wrap items-center gap-2">
        {launch.link ? (
          <a
            href={launch.link}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-sm font-medium text-gray-900 hover:underline dark:text-gray-100"
          >
            {keys}
            <ExternalLink className="h-3 w-3 text-gray-400" />
          </a>
        ) : (
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{keys}</span>
        )}
        <TaskQueueKindBadge kind={launch.kind} />
      </div>
      <StepList steps={steps} />
      {launch.finishedAt &&
        (launch.error ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-red-600 dark:text-red-400">
              {t("launchPanel.failed")}
            </span>
            <Button variant="outline" size="sm" onClick={onOpenQueue}>
              {t("launchPanel.openQueue")}
            </Button>
          </div>
        ) : (
          <span className="text-xs font-medium text-green-700 dark:text-green-400">
            {t("launchPanel.done")}
          </span>
        ))}
    </li>
  );
}
