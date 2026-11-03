import { CalendarClock, Copy } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useToast } from "../hooks/useToast";
import * as boardWatcherApi from "../services/boardWatcherApi";
import type { DailyPreview } from "../services/boardWatcherApi";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { Button } from "./Button";

/** The daily summary on demand: the same as the 09:45 Teams card, built when asked. */
export function DailyPreviewPanel() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [preview, setPreview] = useState<DailyPreview | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setPreview(await boardWatcherApi.fetchDailyPreview());
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "board.daily.error"), "error");
    } finally {
      setLoading(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(t("board.daily.copied"), "success");
    } catch {
      showToast(t("board.daily.copyError"), "error");
    }
  };

  const section = (heading: string, items: string[]) =>
    items.length > 0 && (
      <div>
        <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">{heading}</p>
        <ul className="flex flex-col gap-1 text-sm text-gray-800 dark:text-gray-200">
          {items.map((item) => (
            <li key={item} className="break-words">
              • {item}
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t("board.daily.title")}
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
          icon={<CalendarClock className="h-3.5 w-3.5" />}
        >
          {loading
            ? t("board.daily.loading")
            : preview
              ? t("board.daily.refresh")
              : t("board.daily.show")}
        </Button>
      </div>
      {preview && (
        <div className="flex flex-col gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-800">
          {section(
            preview.dayLabel === "ontem"
              ? t("board.daily.yesterday")
              : t("board.daily.lastDay", { day: preview.dayLabel }),
            preview.yesterday.length ? preview.yesterday : [t("board.daily.nothing")],
          )}
          {section(t("board.daily.today"), preview.today)}
          {section(t("board.daily.stuck"), preview.stuck)}
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("board.daily.text")}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void copy(preview.text)}
                icon={<Copy className="h-3.5 w-3.5" />}
              >
                {t("board.daily.copy")}
              </Button>
            </div>
            <p className="whitespace-pre-line text-sm text-gray-800 dark:text-gray-200">
              {preview.text}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
