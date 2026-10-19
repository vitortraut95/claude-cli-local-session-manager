import { useCallback, useState } from "react";

const DEFAULT_FEEDBACK_DURATION_MS = 2500;

/**
 * Copies `text` to the clipboard and marks `key` (defaults to `text`) as "copied" for a short
 * window. Errors are left to the caller: the returned promise rejects on a copy failure.
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
