import type { ReactNode } from "react";

/** `http(s)://` up to the next whitespace — the nicknames this renders (e.g. the "New task"
 *  modal's auto nickname, see NewTaskModal's `autoNickname`) only ever embed full links. */
const URL_PATTERN = /https?:\/\/[^\s]+/g;

/** Punctuation that usually ends a sentence rather than the link itself ("see https://x.com/a.")
 *  — kept outside the anchor. */
const TRAILING_PUNCTUATION = /[.,;:!?)\]}'"]+$/;

/**
 * Plain text with every `http(s)://` link turned into an anchor that opens in a new tab. Clicks
 * on a link don't propagate, so it's safe inside a clickable parent.
 */
export function LinkifiedText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index;
    const url = match[0].replace(TRAILING_PUNCTUATION, "");
    if (start > lastIndex) parts.push(text.slice(lastIndex, start));
    parts.push(
      <a
        key={start}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => event.stopPropagation()}
        className="break-all text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
      >
        {url}
      </a>,
    );
    lastIndex = start + url.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return <>{parts}</>;
}
