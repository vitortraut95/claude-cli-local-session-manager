import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import type { TranslationKey } from "../i18n/translations";
import * as boardWatcherApi from "../services/boardWatcherApi";
import type { BoardWatcherStatus, WatcherActionEntry } from "../services/boardWatcherApi";
import { formatUpdatedAt } from "../utils/formatDate";
import { translateServerText } from "../utils/boardWatcher";
import { SubjectIcon, SubjectLinks } from "./BoardSubject";

/** How far back the history is looked at for things that need the user. */
const WINDOW_MS = 24 * 60 * 60_000;
const DISMISSED_KEY = "board.attention.dismissed";

type Item = {
  id: string;
  tone: "red" | "amber";
  text: TranslationKey;
  subject?: string;
  detail?: string;
  at?: string;
};

/** Test verdicts that need the user (the report says it "would fail" or "couldn't test"). */
const REJECTED_VERDICT = /^(reprovaria|não conseguiu testar)/;

function readDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>): void {
  try {
    // Only the last ones matter: older items leave the 24h window anyway.
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids].slice(-200)));
  } catch {
    // A private window can refuse storage: the item just comes back next time.
  }
}

function fromActions(actions: WatcherActionEntry[], since: number): Item[] {
  return actions
    .filter((entry) => Date.parse(entry.ts) >= since)
    .flatMap((entry): Item[] => {
      const id = `${entry.action}:${entry.subject}:${entry.ts}`;
      if (entry.action === "build-failed") {
        return [
          {
            id,
            tone: "red",
            text: "board.attention.buildFailed",
            subject: entry.subject,
            at: entry.ts,
          },
        ];
      }
      if (entry.action === "review-failed") {
        return [
          {
            id,
            tone: "red",
            text: "board.attention.reviewFailed",
            subject: entry.subject,
            at: entry.ts,
          },
        ];
      }
      if (entry.action === "test-failed") {
        return [
          {
            id,
            tone: "red",
            text: "board.attention.testFailed",
            subject: entry.subject,
            at: entry.ts,
          },
        ];
      }
      if (entry.action === "tested" && entry.detail && REJECTED_VERDICT.test(entry.detail)) {
        return [
          {
            id,
            tone: "amber",
            text: "board.attention.testRejected",
            subject: entry.subject,
            detail: entry.detail.split(/[.,]/)[0],
            at: entry.ts,
          },
        ];
      }
      return [];
    });
}

/**
 * What needs the user, on top: the last look's error, a pause or a hold, weak task descriptions,
 * and from the last 24h failed builds, reviews and tests and rejected tests. Each item can be
 * dismissed (remembered in this browser).
 */
export function AttentionPanel({
  status,
  refreshKey,
}: {
  status: BoardWatcherStatus;
  refreshKey: string;
}) {
  const { t, language } = useLanguage();
  const [actions, setActions] = useState<WatcherActionEntry[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(readDismissed);
  const [since] = useState(() => Date.now() - WINDOW_MS);

  useEffect(() => {
    let cancelled = false;
    boardWatcherApi
      .fetchWatcherActions(300)
      .then((result) => {
        if (!cancelled) setActions(result);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const items = useMemo(() => {
    const list: Item[] = [];
    if (status.lastError) {
      list.push({
        id: `error:${status.lastError.at}`,
        tone: "red",
        text: "board.attention.error",
        detail: status.lastError.message,
        at: status.lastError.at,
      });
    }
    if (status.pausedReason) {
      list.push({
        id: `paused:${status.pausedReason}`,
        tone: "amber",
        text: "board.attention.paused",
        detail: status.pausedReason,
      });
    }
    if (status.jobsBlockedBy) {
      list.push({
        id: `blocked:${status.jobsBlockedBy}`,
        tone: "amber",
        text: "board.attention.blocked",
        detail: status.jobsBlockedBy,
      });
    }
    for (const decision of status.lastDecisions) {
      if (decision.action !== "weak-description") continue;
      list.push({
        id: `weak:${decision.subject}:${decision.reason}`,
        tone: "amber",
        text: "board.attention.weak",
        subject: decision.subject,
        detail: decision.reason,
      });
    }
    list.push(...fromActions(actions, since).reverse());
    return list.filter((item) => !dismissed.has(item.id));
  }, [status, actions, since, dismissed]);

  const dismiss = (id: string) => {
    setDismissed((current) => {
      const next = new Set(current).add(id);
      saveDismissed(next);
      return next;
    });
  };

  return (
    <section
      className={`flex flex-col gap-2 rounded-xl border p-4 ${
        items.length > 0
          ? "border-amber-300/70 bg-amber-50/70 dark:border-amber-400/25 dark:bg-amber-500/[0.06]"
          : "border-emerald-300/60 bg-emerald-50/60 dark:border-emerald-400/20 dark:bg-emerald-500/[0.05]"
      }`}
    >
      <h3 className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase">
        {items.length > 0 ? (
          <>
            <AlertTriangle
              className="h-4 w-4 text-amber-600 dark:text-amber-400"
              aria-hidden="true"
            />
            <span className="text-amber-800 dark:text-amber-300">
              {t("board.attention.title")} ({items.length})
            </span>
          </>
        ) : (
          <>
            <CheckCircle2
              className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
              aria-hidden="true"
            />
            <span className="text-emerald-800 dark:text-emerald-300">
              {t("board.attention.title")}
            </span>
          </>
        )}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-emerald-800 dark:text-emerald-200">
          {t("board.attention.allClear")}
        </p>
      ) : (
        <ul className="flex max-h-60 flex-col gap-1.5 overflow-y-auto pr-1">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-2 text-sm">
              {item.subject ? (
                <SubjectIcon subject={item.subject} />
              ) : (
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    item.tone === "red" ? "bg-red-500" : "bg-amber-500"
                  }`}
                  aria-hidden="true"
                />
              )}
              <span className="min-w-0 flex-1 break-words text-gray-800 dark:text-gray-200">
                {t(item.text, {
                  subject: item.subject ?? "",
                  detail: item.detail ? translateServerText(item.detail, language) : "",
                })}
                {item.at && (
                  <span className="ml-1.5 text-xs text-gray-500 dark:text-gray-400">
                    {formatUpdatedAt(item.at)}
                  </span>
                )}
              </span>
              {item.subject && <SubjectLinks subject={item.subject} bases={status.linkBases} />}
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label={t("board.attention.dismiss")}
                title={t("board.attention.dismiss")}
                className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-black/5 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 dark:hover:bg-white/10 dark:hover:text-gray-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
