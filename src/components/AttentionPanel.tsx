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

type Kind =
  | "error"
  | "paused"
  | "blocked"
  | "weak"
  | "buildFailed"
  | "reviewFailed"
  | "testFailed"
  | "testRejected";

const KIND_LABEL: Record<Kind, TranslationKey> = {
  error: "board.attention.kind.error",
  paused: "board.attention.kind.paused",
  blocked: "board.attention.kind.blocked",
  weak: "board.attention.kind.weak",
  buildFailed: "board.attention.kind.buildFailed",
  reviewFailed: "board.attention.kind.reviewFailed",
  testFailed: "board.attention.kind.testFailed",
  testRejected: "board.attention.kind.testRejected",
};

type Item = {
  id: string;
  tone: "red" | "amber";
  kind: Kind;
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
            kind: "buildFailed",
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
            kind: "reviewFailed",
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
            kind: "testFailed",
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
            kind: "testRejected",
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
        kind: "error",
        detail: status.lastError.message,
        at: status.lastError.at,
      });
    }
    if (status.pausedReason) {
      list.push({
        id: `paused:${status.pausedReason}`,
        tone: "amber",
        kind: "paused",
        detail: status.pausedReason,
      });
    }
    if (status.jobsBlockedBy) {
      list.push({
        id: `blocked:${status.jobsBlockedBy}`,
        tone: "amber",
        kind: "blocked",
        detail: status.jobsBlockedBy,
      });
    }
    for (const decision of status.lastDecisions) {
      if (decision.action !== "weak-description") continue;
      list.push({
        id: `weak:${decision.subject}:${decision.reason}`,
        tone: "amber",
        kind: "weak",
        subject: decision.subject,
        detail: decision.reason,
      });
    }
    list.push(...fromActions(actions, since).reverse());
    // Errors first; the order within each tone is kept.
    return list
      .filter((item) => !dismissed.has(item.id))
      .sort((a, b) => Number(b.tone === "red") - Number(a.tone === "red"));
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
        <ul className="flex max-h-[26rem] flex-col gap-2 overflow-y-auto pr-1">
          {items.map((item) => {
            const red = item.tone === "red";
            const detail = item.detail ? translateServerText(item.detail, language) : null;
            return (
              <li
                key={item.id}
                className={`flex items-start gap-2.5 rounded-lg border border-l-4 bg-white px-3 py-2 dark:bg-gray-950/40 ${
                  red
                    ? "border-red-200 border-l-red-500 dark:border-red-500/20 dark:border-l-red-500"
                    : "border-amber-200 border-l-amber-500 dark:border-amber-500/20 dark:border-l-amber-400"
                }`}
              >
                {item.subject && <SubjectIcon subject={item.subject} />}
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span
                      className={`text-sm font-semibold ${
                        red ? "text-red-700 dark:text-red-300" : "text-amber-800 dark:text-amber-300"
                      }`}
                    >
                      {t(KIND_LABEL[item.kind])}
                    </span>
                    {item.subject && (
                      <span className="font-mono text-xs text-gray-800 dark:text-gray-200">
                        {item.subject}
                      </span>
                    )}
                    {item.at && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatUpdatedAt(item.at, language)}
                      </span>
                    )}
                  </p>
                  {detail && (
                    <p className="mt-0.5 text-xs break-words text-gray-600 dark:text-gray-400">
                      {detail}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {item.subject && (
                    <SubjectLinks subject={item.subject} bases={status.linkBases} />
                  )}
                  <button
                    type="button"
                    onClick={() => dismiss(item.id)}
                    aria-label={t("board.attention.dismiss")}
                    title={t("board.attention.dismiss")}
                    className="rounded p-1 text-gray-400 hover:bg-black/5 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 dark:hover:bg-white/10 dark:hover:text-gray-200"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
