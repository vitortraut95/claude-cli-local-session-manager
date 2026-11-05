import { ChevronRight, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import type { TranslationKey } from "../i18n/translations";
import * as boardWatcherApi from "../services/boardWatcherApi";
import type {
  WatcherActionEntry,
  WatcherFeedback,
  WatcherHistoryGroup,
} from "../services/boardWatcherApi";
import { feedbackEntryKey } from "../../shared/boardWatcher";
import { resolveApiErrorMessage } from "../utils/apiClient";
import {
  ACTION_KIND_KEYS,
  HISTORY_FILTERS,
  isRateable,
  type HistoryFilter,
} from "../utils/boardWatcher";
import { formatUpdatedAt } from "../utils/formatDate";
import { Button } from "./Button";
import { Input } from "./Input";
import { MarkdownView } from "./MarkdownView";
import { WatcherBadge } from "./WatcherBadge";
import { WatcherFeedbackNote, WatcherVoteButtons } from "./WatcherFeedbackControls";

const PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 300;

const HISTORY_FILTER_KEYS: Record<HistoryFilter, TranslationKey> = {
  all: "board.history.filter.all",
  reviews: "board.history.filter.reviews",
  tests: "board.history.filter.tests",
  queue: "board.history.filter.queue",
  notices: "board.history.filter.notices",
};

type FeedbackProps = {
  feedback: Record<string, WatcherFeedback>;
  onFeedbackSaved: (saved: WatcherFeedback) => void;
};

/** One recorded action inside a ticket's group: when, what, the 👍/👎 and its detail. */
function HistoryEntry({
  entry,
  feedback,
  onFeedbackSaved,
}: FeedbackProps & { entry: WatcherActionEntry }) {
  const { t } = useLanguage();
  const saved = feedback[feedbackEntryKey(entry)];
  return (
    <li>
      <details className="group/entry py-1.5">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 text-sm">
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform group-open/entry:rotate-90" />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {formatUpdatedAt(entry.ts)}
          </span>
          <WatcherBadge tone={entry.action.endsWith("failed") ? "red" : "neutral"}>
            {t(ACTION_KIND_KEYS[entry.action])}
          </WatcherBadge>
          {entry.live && (
            <span title={t("board.history.live.title")}>
              <WatcherBadge tone="green">{t("board.history.live")}</WatcherBadge>
            </span>
          )}
          {entry.subject !== entry.title && entry.subject.includes(": ") && (
            <span className="min-w-0 break-words text-xs text-gray-600 dark:text-gray-400">
              {entry.subject}
            </span>
          )}
          {isRateable(entry) && (
            <WatcherVoteButtons entry={entry} feedback={saved} onSaved={onFeedbackSaved} />
          )}
        </summary>
        <div className="mt-2 flex flex-col gap-3 pl-5">
          {saved && (
            <WatcherFeedbackNote
              key={saved.verdict}
              entry={entry}
              feedback={saved}
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
  );
}

/** A ticket's or PR's line: its latest action, how many there were; opens its timeline. */
function HistoryGroup({ group, ...feedbackProps }: FeedbackProps & { group: WatcherHistoryGroup }) {
  const { t } = useLanguage();
  const latest = group.entries[0];
  return (
    <li>
      <details className="group px-3 py-2">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 text-sm">
          <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-open:rotate-90" />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {formatUpdatedAt(group.lastTs)}
          </span>
          <span className="break-all font-mono text-xs font-medium text-gray-900 dark:text-gray-100">
            {group.subject}
          </span>
          <span className="min-w-0 flex-1 break-words text-gray-700 dark:text-gray-300">
            {group.title}
          </span>
          {latest && (
            <WatcherBadge tone={latest.action.endsWith("failed") ? "red" : "neutral"}>
              {t(ACTION_KIND_KEYS[latest.action])}
            </WatcherBadge>
          )}
          {group.live && <WatcherBadge tone="green">{t("board.history.live")}</WatcherBadge>}
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {t("board.history.count", { count: group.entries.length })}
          </span>
        </summary>
        <ul className="mt-2 flex flex-col divide-y divide-gray-100 border-l border-gray-200 pl-4 dark:divide-gray-800 dark:border-gray-800">
          {group.entries.map((entry, index) => (
            <HistoryEntry
              key={`${entry.ts}-${entry.action}-${index}`}
              entry={entry}
              {...feedbackProps}
            />
          ))}
        </ul>
      </details>
    </li>
  );
}

type WatcherHistoryProps = FeedbackProps & {
  /** Changes when there may be something new (a look or a session finished): page 1 is re-read. */
  refreshKey: string;
};

/** The Board's history, one line per ticket/PR, with search, filters and infinite scroll. */
export function WatcherHistory({ refreshKey, ...feedbackProps }: WatcherHistoryProps) {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<WatcherHistoryGroup[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  // Answers to an older filter/search are dropped.
  const requestId = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const id = ++requestId.current;
    boardWatcherApi
      .fetchWatcherHistory({ filter, q: query, cursor: null, limit: PAGE_SIZE })
      .then((page) => {
        if (id !== requestId.current) return;
        setGroups(page.groups);
        setNextCursor(page.nextCursor);
        setError(null);
      })
      .catch((err: unknown) => {
        if (id === requestId.current)
          setError(resolveApiErrorMessage(err, t, "board.history.loadError"));
      });
  }, [filter, query, refreshKey, t]);

  const loadMore = () => {
    if (!nextCursor || loadingMore) return;
    const id = requestId.current;
    setLoadingMore(true);
    boardWatcherApi
      .fetchWatcherHistory({ filter, q: query, cursor: nextCursor, limit: PAGE_SIZE })
      .then((page) => {
        if (id !== requestId.current) return;
        setGroups((current) => [...(current ?? []), ...page.groups]);
        setNextCursor(page.nextCursor);
      })
      .catch((err: unknown) => {
        if (id === requestId.current)
          setError(resolveApiErrorMessage(err, t, "board.history.loadError"));
      })
      .finally(() => setLoadingMore(false));
  };
  // The observer calls the latest `loadMore` (its cursor) without being re-created each render.
  const loadMoreRef = useRef(loadMore);
  useEffect(() => {
    loadMoreRef.current = loadMore;
  });

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !nextCursor) return;
    const observer = new IntersectionObserver((items) => {
      if (items.some((item) => item.isIntersecting)) loadMoreRef.current();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [nextCursor]);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t("board.history.title")}
        </h3>
        <div role="group" aria-label={t("board.history.filter")} className="flex flex-wrap gap-1.5">
          {HISTORY_FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={filter === option}
              onClick={() => setFilter(option)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filter === option
                  ? "border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900"
                  : "border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
              }`}
            >
              {t(HISTORY_FILTER_KEYS[option])}
            </button>
          ))}
        </div>
      </div>
      <Input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t("board.history.search")}
        aria-label={t("board.history.search")}
        icon={<Search className="h-4 w-4" />}
      />

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {!error && groups === null && <p className="text-sm text-gray-500 dark:text-gray-400">…</p>}
      {groups !== null && groups.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {query ? t("board.history.noMatch") : t("board.history.empty")}
        </p>
      )}
      {groups !== null && groups.length > 0 && (
        <ul className="flex flex-col divide-y divide-gray-100 rounded-xl border border-gray-200 dark:divide-white/5 dark:border-white/10 dark:bg-white/[0.02]">
          {groups.map((group) => (
            <HistoryGroup key={group.subject} group={group} {...feedbackProps} />
          ))}
        </ul>
      )}
      {nextCursor && (
        <div ref={sentinel} className="flex justify-center">
          <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "…" : t("board.history.loadMore")}
          </Button>
        </div>
      )}
    </section>
  );
}
