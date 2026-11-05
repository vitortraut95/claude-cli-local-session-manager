import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useToast } from "../hooks/useToast";
import * as boardWatcherApi from "../services/boardWatcherApi";
import type { WatcherActionEntry, WatcherFeedback } from "../services/boardWatcherApi";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { feedbackEntryKey } from "../../shared/boardWatcher";
import { Button } from "./Button";

type VoteButtonsProps = {
  entry: WatcherActionEntry;
  feedback: WatcherFeedback | undefined;
  onSaved: (feedback: WatcherFeedback) => void;
};

/** 👍/👎 on a history row; inside the row's `<summary>`, so clicks don't toggle it. */
export function WatcherVoteButtons({ entry, feedback, onSaved }: VoteButtonsProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);

  async function vote(verdict: "up" | "down") {
    setSaving(true);
    try {
      onSaved(
        await boardWatcherApi.saveWatcherFeedback({
          entryKey: feedbackEntryKey(entry),
          action: entry.action,
          subject: entry.subject,
          verdict,
          note: feedback?.verdict === verdict ? feedback.note : undefined,
        }),
      );
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "board.feedback.saveError"), "error");
    } finally {
      setSaving(false);
    }
  }

  const button = (verdict: "up" | "down") => {
    const pressed = feedback?.verdict === verdict;
    const Icon = verdict === "up" ? ThumbsUp : ThumbsDown;
    const tone =
      verdict === "up" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
    return (
      <button
        type="button"
        disabled={saving}
        aria-pressed={pressed}
        aria-label={t(verdict === "up" ? "board.feedback.up" : "board.feedback.down")}
        title={t(verdict === "up" ? "board.feedback.up" : "board.feedback.down")}
        onClick={(event) => {
          event.preventDefault();
          void vote(verdict);
        }}
        className={`rounded p-1 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-800 ${
          pressed ? tone : "text-gray-400"
        }`}
      >
        <Icon className="h-4 w-4" fill={pressed ? "currentColor" : "none"} />
      </button>
    );
  };

  return (
    <span className="ml-auto flex items-center gap-0.5">
      {button("up")}
      {button("down")}
    </span>
  );
}

type NoteProps = {
  entry: WatcherActionEntry;
  feedback: WatcherFeedback;
  onSaved: (feedback: WatcherFeedback) => void;
};

/** The "why" of a verdict, in the open row; a 👎 note becomes a lesson for the next sessions. */
export function WatcherFeedbackNote({ entry, feedback, onSaved }: NoteProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [note, setNote] = useState(feedback.note ?? "");
  const [saving, setSaving] = useState(false);
  const changed = note.trim() !== (feedback.note ?? "");

  async function save() {
    setSaving(true);
    try {
      onSaved(
        await boardWatcherApi.saveWatcherFeedback({
          entryKey: feedbackEntryKey(entry),
          action: entry.action,
          subject: entry.subject,
          verdict: feedback.verdict,
          note,
        }),
      );
      showToast(t("board.feedback.saved"), "success");
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "board.feedback.saveError"), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-gray-200 p-2 dark:border-gray-800">
      <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
        {t(feedback.verdict === "down" ? "board.feedback.noteDown" : "board.feedback.noteUp")}
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          maxLength={1000}
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
      </label>
      <div>
        <Button size="sm" onClick={() => void save()} disabled={!changed || saving}>
          {t("board.feedback.saveNote")}
        </Button>
      </div>
    </div>
  );
}
