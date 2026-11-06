const relativeFormatters = new Map<string, Intl.RelativeTimeFormat>();

function relativeFormatter(locale: string): Intl.RelativeTimeFormat {
  let formatter = relativeFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    relativeFormatters.set(locale, formatter);
  }
  return formatter;
}
const absoluteFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Renders a recent timestamp as relative time ("5 minutes ago"), falling back to an absolute date
 *  beyond ~2 days. `language` picks the words ("há 5 minutos" in Portuguese); English by default. */
export function formatUpdatedAt(iso: string, language: "en" | "pt" = "en"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  const diffMs = date.getTime() - Date.now();
  const absDiffMs = Math.abs(diffMs);
  const relative = relativeFormatter(language === "pt" ? "pt-BR" : "en-US");

  if (absDiffMs < MINUTE) return language === "pt" ? "agora" : "just now";
  if (absDiffMs < HOUR) return relative.format(Math.round(diffMs / MINUTE), "minute");
  if (absDiffMs < DAY) return relative.format(Math.round(diffMs / HOUR), "hour");
  if (absDiffMs < 2 * DAY) return relative.format(Math.round(diffMs / DAY), "day");

  return language === "pt"
    ? date.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : absoluteFormatter.format(date);
}

/** Renders a millisecond duration compactly ("42m", "1h 12m", "3h") for the "active time" stat. */
export function formatActiveTime(ms: number): string {
  const totalMinutes = Math.round(ms / MINUTE);
  if (totalMinutes < 1) return "<1m";

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}
