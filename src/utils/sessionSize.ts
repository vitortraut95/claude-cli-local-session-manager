const KB = 1024;
const MB = 1024 * KB;

/**
 * Thresholds calibrated against real session sizes on disk rather than a token-accurate context
 * estimate (the .jsonl file's size is a loose proxy for cumulative spend, not the live context
 * window — it keeps growing even across a /compact). Most sessions land well under 2 MB; only a
 * handful of unusually long-running ones cross into double digits.
 */
const HEALTHY_MAX_BYTES = 2 * MB;
const CAUTION_MAX_BYTES = 8 * MB;
/** Sizes at or beyond this are treated as "fully red" — the bar doesn't keep growing forever. */
const CRITICAL_REFERENCE_BYTES = 20 * MB;

export function formatBytes(bytes: number): string {
  if (bytes < MB) return `${Math.max(1, Math.round(bytes / KB))} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
}

export type SessionSizeStatus = "healthy" | "caution" | "critical";

export function sessionSizeStatus(bytes: number): SessionSizeStatus {
  if (bytes < HEALTHY_MAX_BYTES) return "healthy";
  if (bytes < CAUTION_MAX_BYTES) return "caution";
  return "critical";
}

const STATUS_MESSAGES: Record<SessionSizeStatus, string> = {
  healthy: "Healthy size for resuming.",
  caution: "Getting large — consider running /compact soon.",
  critical: "Very large — run /compact or start a fresh session for better results.",
};

export function sessionSizeMessage(bytes: number): string {
  return STATUS_MESSAGES[sessionSizeStatus(bytes)];
}

/**
 * Piecewise-linear position in [0, 1] for the meter's fill width: the healthy/caution/critical
 * bands each get an equal third of the bar, regardless of how skewed the underlying byte
 * thresholds are — otherwise the common (small) case would be squashed into a sliver next to a
 * rare 17 MB outlier.
 */
export function sessionSizeFraction(bytes: number): number {
  if (bytes <= 0) return 0;
  if (bytes < HEALTHY_MAX_BYTES) {
    return (bytes / HEALTHY_MAX_BYTES) * (1 / 3);
  }
  if (bytes < CAUTION_MAX_BYTES) {
    return 1 / 3 + ((bytes - HEALTHY_MAX_BYTES) / (CAUTION_MAX_BYTES - HEALTHY_MAX_BYTES)) * (1 / 3);
  }
  const capped = Math.min(bytes, CRITICAL_REFERENCE_BYTES);
  return (
    2 / 3 +
    ((capped - CAUTION_MAX_BYTES) / (CRITICAL_REFERENCE_BYTES - CAUTION_MAX_BYTES)) * (1 / 3)
  );
}

type Rgb = readonly [number, number, number];

const GREEN: Rgb = [22, 163, 74]; // tailwind green-600
const AMBER: Rgb = [245, 158, 11]; // tailwind amber-500
const RED: Rgb = [220, 38, 38]; // tailwind red-600

function mix(from: Rgb, to: Rgb, t: number): Rgb {
  const [fr, fg, fb] = from;
  const [tr, tg, tb] = to;
  return [Math.round(fr + (tr - fr) * t), Math.round(fg + (tg - fg) * t), Math.round(fb + (tb - fb) * t)];
}

/** Interpolates the meter's fill color across green → amber → red as `fraction` goes 0 → 1. */
export function sessionSizeColor(fraction: number): string {
  const clamped = Math.min(Math.max(fraction, 0), 1);
  const [r, g, b] = clamped <= 0.5 ? mix(GREEN, AMBER, clamped * 2) : mix(AMBER, RED, (clamped - 0.5) * 2);
  return `rgb(${r}, ${g}, ${b})`;
}
