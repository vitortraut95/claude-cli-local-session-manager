import type { BusinessHours } from "./config.js";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const STEP_MINUTES = 5;

const formatters = new Map<string, Intl.DateTimeFormat>();

function localParts(
  date: Date,
  timezone: string,
): { weekday: number; minutes: number; day: string } {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    formatters.set(timezone, formatter);
  }
  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    weekday: WEEKDAYS.indexOf(parts.weekday ?? ""),
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    day: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function isBusinessTime(date: Date, hours: BusinessHours): boolean {
  const { weekday, minutes } = localParts(date, hours.timezone);
  return (
    hours.days.includes(weekday) &&
    minutes >= toMinutes(hours.start) &&
    minutes < toMinutes(hours.end)
  );
}

/** "YYYY-MM-DD" in the business timezone, for per-day limits. */
export function localDay(date: Date, hours: BusinessHours): string {
  return localParts(date, hours.timezone).day;
}

/** Business minutes in [from, to), in whole 5-minute steps (a partial last step doesn't count,
 *  so a wait is never reached early); stops counting once `cap` is reached. */
export function businessMinutesBetween(
  from: Date,
  to: Date,
  hours: BusinessHours,
  cap = Infinity,
): number {
  const step = STEP_MINUTES * 60_000;
  let total = 0;
  for (let t = from.getTime(); t + step <= to.getTime() && total < cap; t += step) {
    if (isBusinessTime(new Date(t), hours)) total += STEP_MINUTES;
  }
  return total;
}
