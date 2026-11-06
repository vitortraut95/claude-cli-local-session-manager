import {
  ChevronRight,
  Circle,
  FlaskConical,
  GitPullRequest,
  Hammer,
  Loader2,
  PauseCircle,
  Power,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import type { TranslationKey } from "../i18n/translations";
import * as boardWatcherApi from "../services/boardWatcherApi";
import type {
  WatcherActivity,
  WatcherActivityEvent,
  WatcherActivityKind,
} from "../services/boardWatcherApi";
import { translateServerText } from "../utils/boardWatcher";

/** How often the feed is asked for what's new while the Board is open and visible. */
const POLL_MS = 2_000;
/** How many steps the panel keeps. */
const KEEP = 40;

const TONE: Partial<Record<WatcherActivityKind, string>> = {
  lookFailed: "bg-red-500",
  reviewFailed: "bg-red-500",
  testFailed: "bg-red-500",
  stopped: "bg-amber-500",
  blocked: "bg-amber-500",
  switchOff: "bg-amber-500",
  reviewDone: "bg-emerald-500",
  testDone: "bg-emerald-500",
  lookDone: "bg-emerald-500",
  switchOn: "bg-emerald-500",
};

const KIND_ICON: Partial<Record<WatcherActivityKind, typeof GitPullRequest>> = {
  review: GitPullRequest,
  reviewDone: GitPullRequest,
  reviewFailed: GitPullRequest,
  reviewSkipped: GitPullRequest,
  test: FlaskConical,
  testDone: FlaskConical,
  testFailed: FlaskConical,
  diagnose: Hammer,
  diagnosed: Hammer,
  rebuild: Hammer,
  blocked: PauseCircle,
  stopped: PauseCircle,
  switchOn: Power,
  switchOff: Power,
};

/** The step's type as a small icon, in the color of how it went. */
function KindIcon({ kind }: { kind: WatcherActivityKind }) {
  const Icon = KIND_ICON[kind] ?? Circle;
  const tone = (TONE[kind] ?? "bg-violet-500").replace("bg-", "text-");
  return (
    <span className="relative z-10 mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gray-950">
      <Icon className={`h-3 w-3 ${tone}`} aria-hidden="true" />
    </span>
  );
}

/** What stands out in the feed (a look's routine steps fold into one line). */
const HIGHLIGHT = new Set<WatcherActivityKind>([
  "reviewDone",
  "reviewFailed",
  "testDone",
  "testFailed",
  "rebuild",
  "diagnosed",
  "blocked",
  "stopped",
  "switchOn",
  "switchOff",
]);

type LookRow = {
  type: "look";
  seq: number;
  at: string;
  issues?: string;
  prs?: string;
  decisions?: string;
  seconds?: string;
  done: boolean;
  failed?: string;
  steps: WatcherActivityEvent[];
};
type Row = LookRow | { type: "event"; event: WatcherActivityEvent };

/** A look and its routine steps (read the board, the PRs, decided) become one row; everything
 *  else stays a row of its own. Oldest first. */
function groupRows(events: WatcherActivityEvent[]): Row[] {
  const rows: Row[] = [];
  let open: LookRow | null = null;
  for (const event of events) {
    if (event.kind === "look") {
      open = { type: "look", seq: event.seq, at: event.at, done: false, steps: [] };
      rows.push(open);
    } else if (
      open &&
      (event.kind === "issues" || event.kind === "prs" || event.kind === "decisions")
    ) {
      open.steps.push(event);
      if (event.kind === "issues") open.issues = event.detail;
      if (event.kind === "prs") open.prs = event.detail;
      if (event.kind === "decisions") open.decisions = event.detail;
    } else if (open && (event.kind === "lookDone" || event.kind === "lookFailed")) {
      open.steps.push(event);
      open.done = true;
      if (event.kind === "lookDone") open.seconds = event.detail;
      else open.failed = event.detail ?? "";
      open = null;
    } else {
      rows.push({ type: "event", event });
    }
  }
  return rows;
}

function elapsed(since: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(since)) / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function clock(at: string, language: string): string {
  return new Date(at).toLocaleTimeString(language === "pt" ? "pt-BR" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * The watcher's live feed: what it's doing right now (with a running timer) and each step as it
 * happens, newest on top. Reports `current` up so the eye can show it's analyzing.
 */
export function LiveActivityPanel({
  onCurrentChange,
  stoppedText,
  nextUp = [],
}: {
  /** What starts after the running step, said under it. */
  nextUp?: string[];
  onCurrentChange?: (current: WatcherActivity["current"]) => void;
  /** Set while nothing can run (eye closed, paused, off): said instead of "waiting for the next
   *  look", and the live dot stops. */
  stoppedText?: string | null;
}) {
  const { t, language } = useLanguage();
  const [events, setEvents] = useState<WatcherActivityEvent[]>([]);
  const [current, setCurrent] = useState<WatcherActivity["current"]>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const lastSeq = useRef(0);
  // A session still finishing after a stop keeps the panel live.
  const stopped = Boolean(stoppedText) && !current;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      if (document.visibilityState === "visible") {
        try {
          const activity = await boardWatcherApi.fetchWatcherActivity(lastSeq.current);
          if (cancelled) return;
          const latest = activity.events.at(-1);
          if (latest) {
            lastSeq.current = latest.seq;
            setEvents((prev) => [...prev, ...activity.events].slice(-KEEP));
          }
          // A new object every poll would re-render the whole Board: only a real change counts.
          setCurrent((prev) =>
            prev?.kind === activity.current?.kind &&
            prev?.subject === activity.current?.subject &&
            prev?.since === activity.current?.since
              ? prev
              : activity.current,
          );
          setFailed(false);
        } catch {
          if (!cancelled) setFailed(true);
        }
      }
      if (!cancelled) timer = setTimeout(() => void poll(), POLL_MS);
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  // The eye shows "analyzing" while something runs.
  useEffect(() => {
    onCurrentChange?.(current);
  }, [current, onCurrentChange]);

  // The running step's timer.
  useEffect(() => {
    if (!current) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [current]);

  const describe = (kind: WatcherActivityKind, subject?: string, detail?: string) => {
    const shownDetail =
      kind === "diagnosed" && detail
        ? t(`board.live.kind.${detail}` as TranslationKey)
        : detail
          ? translateServerText(detail, language)
          : "";
    return t(`board.live.${kind}` as TranslationKey, {
      subject: subject ?? "",
      detail: shownDetail,
    });
  };

  return (
    <section className="flex h-full flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
          {!stopped && (
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60 motion-safe:animate-ping" />
          )}
          <span
            className={`relative inline-flex h-2.5 w-2.5 rounded-full ${stopped ? "bg-gray-400 dark:bg-gray-600" : "bg-red-500"}`}
          />
        </span>
        <h3
          className={`text-xs font-semibold tracking-widest uppercase ${
            stopped ? "text-gray-500 dark:text-gray-400" : "text-red-600 dark:text-red-400"
          }`}
        >
          {t("board.live.title")}
        </h3>
      </div>

      <div
        className={`relative overflow-hidden rounded-lg border px-3 py-2 ${
          current
            ? "border-violet-300/70 bg-gradient-to-r from-violet-50 to-fuchsia-50 dark:border-violet-500/30 dark:from-violet-950/50 dark:to-fuchsia-950/30"
            : "border-gray-200 dark:border-gray-800"
        }`}
        aria-live="polite"
      >
        {current && (
          <div
            aria-hidden="true"
            className="watcher-shimmer pointer-events-none absolute inset-y-0 left-0 w-full bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/10"
          />
        )}
        {current ? (
          <p className="relative flex items-center gap-2 text-sm text-gray-900 dark:text-gray-100">
            <Loader2 className="h-4 w-4 shrink-0 text-violet-500 motion-safe:animate-spin" />
            <span className="min-w-0 flex-1">
              <span className="font-medium">{t("board.live.now")}:</span>{" "}
              {describe(current.kind, current.subject)}
            </span>
            <span className="shrink-0 font-mono text-xs text-violet-600 tabular-nums dark:text-violet-300">
              {elapsed(current.since, now)}
            </span>
          </p>
        ) : null}
        {current && nextUp.length > 0 && (
          <p className="relative mt-1 truncate pl-6 text-xs text-gray-400">
            {t("board.live.nextUp", { list: nextUp.join(", ") })}
          </p>
        )}
        {current ? null : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {stoppedText ?? t("board.live.idle")}
          </p>
        )}
      </div>

      {failed && (
        <p className="text-xs text-amber-700 dark:text-amber-400">{t("board.live.offline")}</p>
      )}

      {events.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">{t("board.live.empty")}</p>
      ) : (
        <ol className="relative flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-1 xl:max-h-[26rem]">
          {/* The timeline's rail, behind the dots. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1 bottom-1 left-[4.6rem] w-px bg-gradient-to-b from-violet-500/60 via-fuchsia-500/30 to-transparent"
          />
          {[...groupRows(events)].reverse().map((row) =>
            row.type === "look" ? (
              <li key={`look-${row.seq}`} className="motion-safe:animate-[fadeIn_0.4s_ease-out]">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-start gap-2 text-xs [&::-webkit-details-marker]:hidden">
                    <span className="mt-0.5 shrink-0 font-mono text-gray-400 tabular-nums dark:text-gray-500">
                      {clock(row.at, language)}
                    </span>
                    <span
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                        row.failed ? "bg-red-500" : row.done ? "bg-gray-400" : "bg-violet-500"
                      }`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 text-gray-500 dark:text-gray-400">
                      {row.failed
                        ? t("board.live.lookGroupFailed", {
                            detail: translateServerText(row.failed, language),
                          })
                        : row.done
                          ? t("board.live.lookGroup", {
                              issues: row.issues ?? "—",
                              prs: row.prs ?? "—",
                              decisions: row.decisions ?? "—",
                              seconds: row.seconds ?? "—",
                            })
                          : t("board.live.lookGroupRunning")}
                    </span>
                    <ChevronRight
                      className="mt-0.5 h-3 w-3 shrink-0 text-gray-400 transition-transform group-open:rotate-90 motion-reduce:transition-none"
                      aria-hidden="true"
                    />
                  </summary>
                  <ol className="mt-1 ml-[4.5rem] flex flex-col gap-0.5 border-l border-gray-200 pl-3 dark:border-gray-800">
                    {row.steps.map((step) => (
                      <li key={step.seq} className="text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-mono tabular-nums">{clock(step.at, language)}</span>{" "}
                        {describe(step.kind, step.subject, step.detail)}
                      </li>
                    ))}
                  </ol>
                </details>
              </li>
            ) : (
              <li
                key={row.event.seq}
                className="flex items-start gap-2 text-xs motion-safe:animate-[fadeIn_0.4s_ease-out]"
              >
                <span className="mt-0.5 shrink-0 font-mono text-gray-400 tabular-nums dark:text-gray-500">
                  {clock(row.event.at, language)}
                </span>
                <KindIcon kind={row.event.kind} />
                <span
                  className={`min-w-0 break-words ${
                    HIGHLIGHT.has(row.event.kind)
                      ? "font-medium text-gray-900 dark:text-gray-100"
                      : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {describe(row.event.kind, row.event.subject, row.event.detail)}
                </span>
              </li>
            ),
          )}
        </ol>
      )}
    </section>
  );
}
