import {
  ArrowRightCircle,
  Code2,
  FlaskConical,
  GitPullRequest,
  GripVertical,
  Info,
  ListOrdered,
  Loader2,
  Rocket,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { useLanguage } from "../hooks/useLanguage";
import type { TranslationKey } from "../i18n/translations";
import type { BoardWatcherStatus, WatcherWork } from "../services/boardWatcherApi";
import type { QueueItem, QueueState } from "../utils/boardQueue";
import { translateServerText } from "../utils/boardWatcher";
import { SubjectIcon, SubjectLinks } from "./BoardSubject";
import { Tooltip } from "./Tooltip";

const STATE_LABEL: Record<QueueState, TranslationKey> = {
  running: "board.queue.state.running",
  queued: "board.queue.state.queued",
  next: "board.queue.state.next",
  waiting: "board.queue.state.waiting",
};

const STATE_TONE: Record<QueueState, string> = {
  running:
    "bg-violet-500/15 text-violet-800 ring-violet-500/40 dark:text-violet-200 dark:ring-violet-400/40",
  queued: "bg-cyan-500/10 text-cyan-800 ring-cyan-500/30 dark:text-cyan-200 dark:ring-cyan-400/30",
  next: "bg-fuchsia-500/10 text-fuchsia-800 ring-fuchsia-500/30 dark:text-fuchsia-200 dark:ring-fuchsia-400/30",
  waiting:
    "bg-gray-100 text-gray-700 ring-gray-200 dark:bg-white/5 dark:text-gray-300 dark:ring-white/15",
};

const WORK: Record<WatcherWork, { label: TranslationKey; icon: LucideIcon; tone: string }> = {
  review: {
    label: "board.queue.work.review",
    icon: GitPullRequest,
    tone: "bg-sky-500/10 text-sky-800 ring-sky-500/30 dark:text-sky-200 dark:ring-sky-400/30",
  },
  dev: {
    label: "board.queue.work.dev",
    icon: Code2,
    tone: "bg-emerald-500/10 text-emerald-800 ring-emerald-500/30 dark:text-emerald-200 dark:ring-emerald-400/30",
  },
  test: {
    label: "board.queue.work.test",
    icon: FlaskConical,
    tone: "bg-amber-500/10 text-amber-800 ring-amber-500/30 dark:text-amber-200 dark:ring-amber-400/30",
  },
  retest: {
    label: "board.queue.work.retest",
    icon: RotateCcw,
    tone: "bg-orange-500/10 text-orange-800 ring-orange-500/30 dark:text-orange-200 dark:ring-orange-400/30",
  },
  progress: {
    label: "board.queue.work.progress",
    icon: ArrowRightCircle,
    tone: "bg-gray-100 text-gray-700 ring-gray-200 dark:bg-white/5 dark:text-gray-300 dark:ring-white/15",
  },
};

/** What the item is: a code review, an implementation, a test… */
function WorkBadge({ work }: { work: WatcherWork }) {
  const { t } = useLanguage();
  const { label, icon: Icon, tone } = WORK[work];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${tone}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {t(label)}
    </span>
  );
}

/** `items` with `subject` moved to where `target` is. */
function moved(items: string[], subject: string, target: string): string[] {
  const from = items.indexOf(subject);
  const to = items.indexOf(target);
  if (from < 0 || to < 0 || from === to) return items;
  const next = items.filter((s) => s !== subject);
  next.splice(to, 0, subject);
  return next;
}

export function BoardQueue({
  status,
  items,
  onStartNow,
  onReorder,
}: {
  status: BoardWatcherStatus;
  items: QueueItem[];
  /** "Start now" on an item on hold; resolves once the look it triggers is done. */
  onStartNow: (subject: string) => Promise<void>;
  /** The queue's new order, top first (what's running isn't part of it). */
  onReorder: (subjects: string[]) => void;
}) {
  const { t, language } = useLanguage();
  const calls = status.calls;
  const [starting, setStarting] = useState<string | null>(null);
  // Only the row whose handle is held is draggable, so its text can still be selected.
  const [armed, setArmed] = useState<string | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const order = items.filter((item) => item.state !== "running").map((item) => item.subject);
  const endDrag = () => {
    setArmed(null);
    setDragged(null);
    setOver(null);
  };
  const moveBy = (subject: string, step: number, event: KeyboardEvent) => {
    const target = order[order.indexOf(subject) + step];
    if (!target) return;
    event.preventDefault();
    onReorder(moved(order, subject, target));
  };
  const start = (subject: string) => {
    setStarting(subject);
    void onStartNow(subject).finally(() => setStarting(null));
  };
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xs font-semibold tracking-widest text-gray-400 uppercase">
          <ListOrdered className="h-4 w-4 text-violet-400" aria-hidden="true" />
          {t("board.queue.title")} ({items.length})
        </h3>
        {calls && (
          <Tooltip
            content={`${t("board.now.calls", {
              seconds: Math.round(calls.lastLookMs / 1000),
              jira: calls.lastLook.jira,
              bitbucket: calls.lastLook.bitbucket,
              jenkins: calls.lastLook.jenkins,
              hour: calls.lastHour.bitbucket,
            })}${calls.retries > 0 ? ` ${t("board.now.retries", { count: calls.retries })}` : ""}`}
          >
            <button
              type="button"
              aria-label={t("board.queue.calls")}
              className="rounded-full text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50"
            >
              <Info className="h-4 w-4" />
            </button>
          </Tooltip>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">{t("board.queue.empty")}</p>
      ) : (
        <>
          {order.length > 1 && (
            <p className="text-xs text-gray-500">{t("board.queue.reorderHint")}</p>
          )}
          <ul className="flex max-h-[22rem] flex-col divide-y divide-gray-100 dark:divide-white/5 overflow-y-auto pr-1">
            {items.map((item) => {
              const title = status.titles[item.subject];
              const movable = item.state !== "running" && order.length > 1;
              return (
                <li
                  key={item.subject}
                  draggable={armed === item.subject}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    setDragged(item.subject);
                  }}
                  onDragOver={(event) => {
                    if (!dragged || !movable) return;
                    event.preventDefault();
                    if (over !== item.subject) setOver(item.subject);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (dragged && movable) onReorder(moved(order, dragged, item.subject));
                    endDrag();
                  }}
                  onDragEnd={endDrag}
                  className={`flex items-start gap-3 py-2 ${dragged === item.subject ? "opacity-50" : ""} ${
                    over === item.subject && dragged !== item.subject
                      ? "shadow-[inset_0_2px_0_0] shadow-violet-400/70"
                      : ""
                  }`}
                >
                  {movable ? (
                    <button
                      type="button"
                      aria-label={t("board.queue.dragHandle")}
                      title={t("board.queue.dragHandle")}
                      onPointerDown={() => setArmed(item.subject)}
                      onPointerUp={() => {
                        if (!dragged) setArmed(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "ArrowUp") moveBy(item.subject, -1, event);
                        if (event.key === "ArrowDown") moveBy(item.subject, 1, event);
                      }}
                      className="-ml-1 mt-0.5 cursor-grab rounded p-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50 active:cursor-grabbing"
                    >
                      <GripVertical className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : (
                    <span className="-ml-1 w-5 shrink-0" aria-hidden="true" />
                  )}
                  <SubjectIcon subject={item.subject} />
                  <div className="min-w-0 flex-1">
                    <p className="flex min-w-0 items-center gap-2">
                      {item.work && <WorkBadge work={item.work} />}
                      <span className="shrink-0 font-mono text-xs text-gray-800 dark:text-gray-200">
                        {item.subject}
                      </span>
                      {title && (
                        <span
                          className="min-w-0 truncate text-sm text-gray-700 dark:text-gray-300"
                          title={title}
                        >
                          {title}
                        </span>
                      )}
                    </p>
                    {item.reason && (
                      <p className="text-xs text-gray-500">
                        {translateServerText(item.reason, language)}
                      </p>
                    )}
                    {item.decision?.build && (
                      <a
                        href={item.decision.build.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-fuchsia-700 dark:text-fuchsia-300 underline-offset-2 hover:underline"
                      >
                        {t("board.queue.build", { name: item.decision.build.name })}
                      </a>
                    )}
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STATE_TONE[item.state]}`}
                  >
                    {item.state === "running" && (
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-violet-300 motion-safe:animate-pulse"
                        aria-hidden="true"
                      />
                    )}
                    {t(STATE_LABEL[item.state])}
                  </span>
                  {item.decision?.canStart && (
                    <Tooltip content={t("board.queue.startNow.tooltip")}>
                      <button
                        type="button"
                        disabled={starting !== null}
                        onClick={() => start(item.subject)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:text-violet-200 ring-1 ring-violet-400/40 ring-inset transition hover:bg-violet-500/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {starting === item.subject ? (
                          <Loader2
                            className="h-3 w-3 motion-safe:animate-spin"
                            aria-hidden="true"
                          />
                        ) : (
                          <Rocket className="h-3 w-3" aria-hidden="true" />
                        )}
                        {t("board.queue.startNow")}
                      </button>
                    </Tooltip>
                  )}
                  <SubjectLinks subject={item.subject} bases={status.linkBases} />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
