import { ListChecks, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import type { TranslationKey } from "../i18n/translations";
import * as boardWatcherApi from "../services/boardWatcherApi";
import * as tasksApi from "../services/tasksApi";
import type { Session } from "../../shared/session";
import type { QueueEntry } from "../../shared/tasks";
import { formatUpdatedAt } from "../utils/formatDate";
import {
  buildTaskStatusRows,
  type TaskStatusLevel,
  type TaskStatusReason,
  type TaskStatusRow,
} from "../utils/taskStatuses";
import { Button } from "./Button";

/** How often the queue and the watcher's actions are re-read (the sessions come from the page). */
const REFRESH_MS = 30_000;
const COLLAPSED_KEY = "taskSidebar.collapsed";

const LEVEL_LABEL_KEYS: Record<TaskStatusLevel, TranslationKey> = {
  problem: "taskSidebar.level.problem",
  waiting: "taskSidebar.level.waiting",
  running: "taskSidebar.level.running",
};

const LEVEL_DOT_CLASSES: Record<TaskStatusLevel, string> = {
  problem: "bg-red-500",
  waiting: "bg-orange-400",
  running: "bg-green-500",
};

function reasonText(
  reason: TaskStatusReason,
  t: (key: TranslationKey, params?: Record<string, string>) => string,
): string {
  switch (reason.kind) {
    case "running":
      return t("taskSidebar.reason.running");
    case "inProgress":
      return t("taskSidebar.reason.inProgress");
    case "waitingUser":
      return t("taskSidebar.reason.waitingUser");
    case "todo":
      return t("taskSidebar.reason.todo");
    case "queued":
      return t("taskSidebar.reason.queued");
    case "launchError":
      return t("taskSidebar.reason.launchError", { message: reason.message });
    case "testFailed":
      return t("taskSidebar.reason.testFailed", { message: reason.message });
    case "reviewFailed":
      return t("taskSidebar.reason.reviewFailed", { message: reason.message });
  }
}

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

type TaskStatusSidebarProps = {
  /** The sessions the page already loaded (refreshed with it). */
  sessions: Session[];
  /** The key the session list is filtered to, if any. */
  activeKey: string;
  onSelectTask: (key: string) => void;
};

/**
 * Left column of the sessions page: one status per task that isn't done, worst first in color,
 * sorted by the last interaction. Collapses to a strip on large screens; on smaller ones a button
 * above the list opens it.
 */
export function TaskStatusSidebar({ sessions, activeKey, onSelectTask }: TaskStatusSidebarProps) {
  const { t } = useLanguage();
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [actions, setActions] = useState<boardWatcherApi.WatcherActionEntry[]>([]);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      // A failed read keeps the last good data; the sidebar stays quiet about it.
      void Promise.all([
        tasksApi.fetchTaskQueue().catch(() => null),
        boardWatcherApi.fetchWatcherActions(200).catch(() => null),
      ]).then(([nextQueue, nextActions]) => {
        if (cancelled) return;
        if (nextQueue) setQueue(nextQueue);
        if (nextActions) setActions(nextActions);
      });
    };
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const rows = useMemo(
    () => buildTaskStatusRows({ sessions, queue, actions }),
    [sessions, queue, actions],
  );

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // Private windows can refuse storage; the choice then lasts for this page only.
      }
      return next;
    });
  };

  const renderRow = (row: TaskStatusRow) => {
    const levelLabel = t(LEVEL_LABEL_KEYS[row.level]);
    const active = activeKey === row.key;
    return (
      <li key={row.key}>
        <button
          type="button"
          onClick={() => onSelectTask(row.key)}
          aria-current={active ? "true" : undefined}
          className={`flex w-full min-w-0 items-start gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20 dark:hover:bg-gray-800 dark:focus-visible:ring-gray-100/20 ${
            active ? "bg-gray-100 dark:bg-gray-800" : ""
          }`}
        >
          <span
            role="img"
            aria-label={levelLabel}
            className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${LEVEL_DOT_CLASSES[row.level]}`}
          />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate font-mono text-xs font-semibold text-gray-900 dark:text-gray-100">
                {row.key}
              </span>
              <span className="shrink-0 text-[11px] text-gray-500 dark:text-gray-400">
                {formatUpdatedAt(row.lastAt)}
              </span>
            </span>
            {row.title && (
              <span className="truncate text-xs text-gray-700 dark:text-gray-300">{row.title}</span>
            )}
            <span className="truncate text-xs text-gray-500 dark:text-gray-400">
              {reasonText(row.reason, t)}
            </span>
          </span>
        </button>
      </li>
    );
  };

  const legend = (
    <div className="flex flex-col gap-1 border-t border-gray-200 px-3 py-3 text-xs text-gray-600 dark:border-gray-800 dark:text-gray-400">
      <span className="font-medium">{t("taskSidebar.legend")}</span>
      {(["problem", "waiting", "running"] as const).map((level) => (
        <span key={level} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={`h-2.5 w-2.5 rounded-full ${LEVEL_DOT_CLASSES[level]}`}
          />
          {t(LEVEL_LABEL_KEYS[level])}
        </span>
      ))}
    </div>
  );

  return (
    <>
      <div className="px-4 pt-3 lg:hidden">
        <Button
          variant="outline"
          onClick={() => setMobileOpen((open) => !open)}
          aria-expanded={mobileOpen}
          icon={<ListChecks className="h-4 w-4" />}
        >
          {t("taskSidebar.toggle", { count: rows.length })}
        </Button>
      </div>

      <aside
        aria-label={t("taskSidebar.title")}
        className={`w-full shrink-0 border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 lg:sticky lg:top-0 lg:block lg:h-screen lg:border-b-0 lg:border-r ${
          collapsed ? "lg:w-12" : "lg:w-72"
        } ${mobileOpen ? "block" : "hidden"}`}
      >
        {collapsed && (
          <div className="hidden h-full flex-col items-center gap-3 py-3 lg:flex">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleCollapsed}
              aria-label={t("taskSidebar.expand")}
              icon={<PanelLeftOpen className="h-4 w-4" />}
            />
            <span
              className="text-xs font-semibold text-gray-500 dark:text-gray-400"
              aria-hidden="true"
            >
              {rows.length}
            </span>
          </div>
        )}
        <div className={`flex h-full flex-col ${collapsed ? "lg:hidden" : ""}`}>
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {t("taskSidebar.title")}{" "}
              <span className="font-normal text-gray-500">({rows.length})</span>
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleCollapsed}
              aria-label={t("taskSidebar.collapse")}
              className="hidden lg:inline-flex"
              icon={<PanelLeftClose className="h-4 w-4" />}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {rows.length === 0 ? (
              <p className="px-2 py-4 text-sm text-gray-500 dark:text-gray-400">
                {t("taskSidebar.empty")}
              </p>
            ) : (
              <ul className="flex flex-col gap-0.5">{rows.map(renderRow)}</ul>
            )}
          </div>
          {legend}
        </div>
      </aside>
    </>
  );
}
