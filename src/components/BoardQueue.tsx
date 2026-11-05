import { Info, ListOrdered } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import type { TranslationKey } from "../i18n/translations";
import type { BoardWatcherStatus } from "../services/boardWatcherApi";
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
  running: "bg-violet-500/15 text-violet-200 ring-violet-400/40",
  queued: "bg-cyan-500/10 text-cyan-200 ring-cyan-400/30",
  next: "bg-fuchsia-500/10 text-fuchsia-200 ring-fuchsia-400/30",
  waiting: "bg-white/5 text-gray-300 ring-white/15",
};

export function BoardQueue({ status, items }: { status: BoardWatcherStatus; items: QueueItem[] }) {
  const { t, language } = useLanguage();
  const calls = status.calls;
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
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
              className="rounded-full text-gray-500 hover:text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50"
            >
              <Info className="h-4 w-4" />
            </button>
          </Tooltip>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">{t("board.queue.empty")}</p>
      ) : (
        <ul className="flex max-h-[22rem] flex-col divide-y divide-white/5 overflow-y-auto pr-1">
          {items.map((item) => {
            const title = status.titles[item.subject];
            return (
              <li key={item.subject} className="flex items-start gap-3 py-2">
                <SubjectIcon subject={item.subject} />
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 items-baseline gap-2">
                    <span className="shrink-0 font-mono text-xs text-gray-200">{item.subject}</span>
                    {title && (
                      <span className="min-w-0 truncate text-sm text-gray-300" title={title}>
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
                      className="text-xs text-fuchsia-300 underline-offset-2 hover:underline"
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
                <SubjectLinks subject={item.subject} bases={status.linkBases} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
