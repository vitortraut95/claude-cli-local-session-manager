import { useCallback, useState } from "react";

const DEFAULT_FEEDBACK_DURATION_MS = 2500;

/**
 * Copies `text` to the clipboard and tracks which key should show "copied" feedback for a short
 * window afterward — shared shape behind `SessionCard`'s single copy button (`key` defaults to
 * `text` itself, since there's only ever one thing to copy there) and `StashList`
 * (`WorktreeToRootModal.tsx`, one button per list row, each keyed by its own stash SHA so only
 * the row actually clicked shows feedback). Both used to carry their own near-identical
 * `useState` + `setTimeout` pair for this.
 *
 * Deliberately doesn't own toast/error handling — callers differ on that (a copy failure gets a
 * toast everywhere, but a *success* toast is wanted in some places and not others, since a
 * "Copied!" tooltip already covers it) — so this only resolves/rejects the promise and lets the
 * caller's own try/catch decide what to show.
 */
export function useCopyFeedback(durationMs: number = DEFAULT_FEEDBACK_DURATION_MS) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copy = useCallback(
    async (text: string, key: string = text) => {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current));
      }, durationMs);
    },
    [durationMs],
  );

  return { copiedKey, copy };
}
