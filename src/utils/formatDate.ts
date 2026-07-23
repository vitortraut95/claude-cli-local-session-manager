const relativeFormatter = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
const absoluteFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Renders a recent timestamp as relative time ("há 5 minutos"), falling back to an absolute date beyond ~2 days. */
export function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  const diffMs = date.getTime() - Date.now();
  const absDiffMs = Math.abs(diffMs);

  if (absDiffMs < MINUTE) return "agora mesmo";
  if (absDiffMs < HOUR) return relativeFormatter.format(Math.round(diffMs / MINUTE), "minute");
  if (absDiffMs < DAY) return relativeFormatter.format(Math.round(diffMs / HOUR), "hour");
  if (absDiffMs < 2 * DAY) return relativeFormatter.format(Math.round(diffMs / DAY), "day");

  return absoluteFormatter.format(date);
}
