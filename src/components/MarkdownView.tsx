import type { ReactNode } from "react";

/**
 * Deliberately tiny markdown renderer — headings, paragraphs, bullet/numbered lists, fenced code,
 * blockquotes, tables (shown as preformatted text) and inline code, bold and links. Enough
 * to read a SKILL.md comfortably without pulling a markdown library into an app that otherwise has
 * none; anything it doesn't understand just renders as plain text.
 */
export function MarkdownView({ source }: { source: string }) {
  const lines = source.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]!;

    if (line.trim() === "") {
      index++;
      continue;
    }

    const fence = /^\s*```/.exec(line);
    if (fence) {
      const code: string[] = [];
      index++;
      while (index < lines.length && !/^\s*```/.test(lines[index]!)) code.push(lines[index++]!);
      index++;
      blocks.push(
        <pre
          key={blocks.length}
          className="overflow-x-auto rounded-md bg-gray-100 p-3 font-mono text-xs text-gray-800 dark:bg-gray-950 dark:text-gray-200"
        >
          {code.join("\n")}
        </pre>,
      );
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1]!.length;
      const className =
        level === 1
          ? "text-lg font-semibold"
          : level === 2
            ? "mt-2 text-base font-semibold"
            : "mt-1 text-sm font-semibold";
      blocks.push(
        <p key={blocks.length} className={`${className} text-gray-900 dark:text-gray-100`}>
          {renderInline(heading[2]!)}
        </p>,
      );
      index++;
      continue;
    }

    if (/^\s*\|/.test(line)) {
      const rows: string[] = [];
      while (index < lines.length && /^\s*\|/.test(lines[index]!)) rows.push(lines[index++]!);
      blocks.push(
        <pre
          key={blocks.length}
          className="overflow-x-auto rounded-md border border-gray-200 p-2 font-mono text-[11px] text-gray-700 dark:border-gray-800 dark:text-gray-300"
        >
          {rows.join("\n")}
        </pre>,
      );
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^\s*>/.test(lines[index]!)) {
        quote.push(lines[index++]!.replace(/^\s*>\s?/, ""));
      }
      blocks.push(
        <blockquote
          key={blocks.length}
          className="border-l-2 border-gray-300 pl-3 text-gray-600 dark:border-gray-700 dark:text-gray-400"
        >
          {renderInline(quote.join(" "))}
        </blockquote>,
      );
      continue;
    }

    const listItem = /^(\s*)([-*]|\d+\.)\s+(.*)$/;
    if (listItem.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: { depth: number; text: string }[] = [];
      while (index < lines.length) {
        const current = lines[index]!;
        const match = listItem.exec(current);
        if (match) {
          items.push({ depth: Math.floor(match[1]!.length / 2), text: match[3]! });
        } else if (/^\s{2,}\S/.test(current) && items.length > 0) {
          items[items.length - 1]!.text += ` ${current.trim()}`;
        } else {
          break;
        }
        index++;
      }
      const ListTag = ordered ? "ol" : "ul";
      blocks.push(
        <ListTag
          key={blocks.length}
          className={`${ordered ? "list-decimal" : "list-disc"} space-y-1 pl-5`}
        >
          {items.map((item, itemIndex) => (
            <li key={itemIndex} style={{ marginLeft: `${item.depth * 1.25}rem` }}>
              {renderInline(item.text)}
            </li>
          ))}
        </ListTag>,
      );
      continue;
    }

    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index]!.trim() !== "" &&
      !/^(#{1,6}\s|\s*```|\s*\||\s*>|\s*([-*]|\d+\.)\s)/.test(lines[index]!)
    ) {
      paragraph.push(lines[index++]!.trim());
    }
    blocks.push(<p key={blocks.length}>{renderInline(paragraph.join(" "))}</p>);
  }

  return (
    <div className="flex flex-col gap-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
      {blocks}
    </div>
  );
}

const INLINE_PATTERN = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;

function renderInline(text: string): ReactNode[] {
  return text.split(INLINE_PATTERN).map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
      return (
        <code
          key={index}
          className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[0.85em] text-gray-800 dark:bg-gray-800 dark:text-gray-200"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={index} className="font-semibold text-gray-900 dark:text-gray-100">
          {part.slice(2, -2)}
        </strong>
      );
    }
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) {
      const href = link[2]!;
      // Relative links point at files inside the skill folder — shown as text (the file list
      // below the preview names them), only real web links are clickable.
      return /^https?:\/\//.test(href) ? (
        <a key={index} href={href} target="_blank" rel="noreferrer" className="underline">
          {link[1]}
        </a>
      ) : (
        <span key={index} className="font-mono text-[0.85em]">
          {link[1]}
        </span>
      );
    }
    return part;
  });
}
