import type { ReactNode } from "react";

/** Small colored label; the text says the same thing, so color is never the only signal. */
export function WatcherBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "blue" | "green" | "red";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    green: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
    red: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
