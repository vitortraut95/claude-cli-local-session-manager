import { Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { LinkifiedText } from "./LinkifiedText";
import { MarkdownView } from "./MarkdownView";
import { useLanguage } from "../hooks/useLanguage";
import * as sessionsApi from "../services/sessionsApi";
import type { Session, TranscriptItem, TranscriptTurn } from "../../shared/session";

type SessionTranscriptModalProps = {
  session: Session;
  onClose: () => void;
};

/** How much of each prompt the left column shows. */
const PROMPT_PREVIEW_LENGTH = 200;

function formatTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString([], {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Prompts on the left; the selected one, with the agent's replies and tool calls, on the right.
 *  Mounted only while open, so each open fetches again (an active session keeps growing). */
export function SessionTranscriptModal({ session, onClose }: SessionTranscriptModalProps) {
  const [turns, setTurns] = useState<TranscriptTurn[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState(0);
  const { t } = useLanguage();

  useEffect(() => {
    let cancelled = false;
    sessionsApi
      .fetchSessionTranscript(session.id)
      .then((result) => {
        if (!cancelled) setTurns(result);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        setTurns(session.prompts.map((prompt) => ({ prompt, timestamp: null, items: [] })));
      });
    return () => {
      cancelled = true;
    };
    // session.prompts only feeds the fallback; refetching when the list reloads isn't needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  const current = turns?.[selected];

  return (
    <Modal open title={session.title} onClose={onClose} size="xxxl">
      {turns === null ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("transcriptModal.loading")}</p>
      ) : turns.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("transcriptModal.empty")}</p>
      ) : (
        <div className="flex h-[80dvh] flex-col gap-3">
          {loadError && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {t("transcriptModal.loadError")}
            </p>
          )}
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,22rem)_minmax(0,1fr)] gap-4">
            <ol className="flex min-h-0 flex-col gap-2 overflow-y-auto pr-1">
              {turns.map((turn, index) => {
                const toolCount = turn.items.filter((item) => item.kind === "tool").length;
                return (
                  <li key={index}>
                    <button
                      type="button"
                      onClick={() => setSelected(index)}
                      className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${
                        index === selected
                          ? "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/40"
                          : "border-gray-100 bg-gray-50 hover:border-gray-300 dark:border-gray-800 dark:bg-gray-800/50 dark:hover:border-gray-600"
                      }`}
                    >
                      <span className="mb-1 flex justify-between gap-2 text-xs font-medium text-gray-400 dark:text-gray-500">
                        <span>
                          #{index + 1} {formatTime(turn.timestamp)}
                        </span>
                        {toolCount > 0 && (
                          <span>{t("transcriptModal.toolCount", { count: toolCount })}</span>
                        )}
                      </span>
                      <span className="line-clamp-3 break-words text-gray-700 dark:text-gray-300">
                        {turn.prompt.slice(0, PROMPT_PREVIEW_LENGTH)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            {current && (
              // Keyed so each prompt opens scrolled to the top.
              <div key={selected} className="min-h-0 overflow-y-auto pr-1">
                <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-sm text-gray-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-gray-200">
                  <span className="mb-1 block text-xs font-medium text-blue-500 dark:text-blue-400">
                    {t("transcriptModal.you")} · #{selected + 1} {formatTime(current.timestamp)}
                  </span>
                  <p className="whitespace-pre-wrap break-words">
                    <LinkifiedText text={current.prompt} />
                  </p>
                </div>
                {current.items.length === 0 && !loadError ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t("transcriptModal.noReply")}
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {current.items.map((item, index) => (
                      <TranscriptItemView key={index} item={item} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function TranscriptItemView({ item }: { item: TranscriptItem }) {
  if (item.kind === "text") {
    return (
      <div className="text-sm text-gray-800 dark:text-gray-200">
        <MarkdownView source={item.text} />
      </div>
    );
  }
  return (
    <div
      className={`flex items-start gap-2 rounded-md px-2 py-1 font-mono text-xs ${
        item.isError
          ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
          : "bg-gray-50 text-gray-600 dark:bg-gray-800/60 dark:text-gray-400"
      }`}
    >
      <Wrench className="mt-0.5 h-3 w-3 shrink-0" />
      <span className="min-w-0 whitespace-pre-wrap break-all">
        <span className="font-semibold">{item.name}</span>
        {item.summary && ` ${item.summary}`}
      </span>
    </div>
  );
}
