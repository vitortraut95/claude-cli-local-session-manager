import { Gauge, Loader2 } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import type { TranslationKey } from "../i18n/translations";
import type { ClaudeUsageStatus } from "../services/systemApi";
import { Button } from "./Button";
import { Tooltip } from "./Tooltip";

type UsageLimitsBadgeProps = {
  status: ClaudeUsageStatus | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
};

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** Short labels for known limit kinds; unknown kinds fall back to a transform of the raw `kind`. */
const COMPACT_LABEL_KEYS: Record<string, TranslationKey> = {
  session: "usageLimitsBadge.compact.session",
  weekly_all: "usageLimitsBadge.compact.weeklyAll",
};
const FULL_LABEL_KEYS: Record<string, TranslationKey> = {
  session: "usageLimitsBadge.full.session",
  weekly_all: "usageLimitsBadge.full.weeklyAll",
  weekly_opus: "usageLimitsBadge.full.weeklyOpus",
  weekly_sonnet: "usageLimitsBadge.full.weeklySonnet",
};

function compactLabel(kind: string, t: Translate): string {
  const key = COMPACT_LABEL_KEYS[kind];
  return key ? t(key) : kind.replace(/^weekly_/, "").slice(0, 6);
}

function fullLabel(kind: string, t: Translate): string {
  const key = FULL_LABEL_KEYS[kind];
  return key ? t(key) : kind.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** "resets in 3h 12min (30/07 21:29)": relative countdown plus absolute local time. */
function formatResetsAt(resetsAt: string | null, t: Translate): string | null {
  if (!resetsAt) return null;
  const date = new Date(resetsAt);
  if (Number.isNaN(date.getTime())) return null;

  const absolute = date.toLocaleString(undefined, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) return t("usageLimitsBadge.resetsSoon", { absolute });

  const totalMinutes = Math.round(diffMs / 60000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (days === 0 && minutes > 0) parts.push(`${minutes}min`);
  const relative = parts.length > 0 ? parts.join(" ") : t("usageLimitsBadge.lessThanOneMin");
  return t("usageLimitsBadge.resetsIn", { relative, absolute });
}

export function UsageLimitsBadge({ status, loading, error, onRefresh }: UsageLimitsBadgeProps) {
  const { t } = useLanguage();
  const limits = status?.limits ?? [];
  const maxPercent = limits.reduce((max, limit) => Math.max(max, limit.percent), 0);
  const urgency = maxPercent >= 90 ? "critical" : maxPercent >= 70 ? "warning" : "normal";

  const colorClass =
    urgency === "critical"
      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-400"
      : urgency === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-400"
        : "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-400";

  const compactText =
    limits.length > 0
      ? limits
          .map((limit) => `${compactLabel(limit.kind, t)} ${Math.round(limit.percent)}%`)
          .join(" · ")
      : error
        ? t("usageLimitsBadge.unavailable")
        : t("usageLimitsBadge.noData");

  // Extra-usage credits: hidden when the monthly limit is 0, which would show a confusing "0 / 0".
  const extraUsage = status?.extraUsage;
  const showExtraUsage = Boolean(extraUsage?.isEnabled && extraUsage.monthlyLimit > 0);

  const tooltipContent = (
    <div className="flex flex-col gap-2 text-left">
      <p className="font-semibold">{t("usageLimitsBadge.title")}</p>
      {limits.length === 0 && !loading && <p>{t("usageLimitsBadge.noLimits")}</p>}
      {error && <p className="text-xs text-red-300">{error}</p>}
      {limits.map((limit) => {
        const resetText = formatResetsAt(limit.resetsAt, t);
        return (
          <div key={limit.kind}>
            <p>
              {fullLabel(limit.kind, t)}: <strong>{Math.round(limit.percent)}%</strong>
            </p>
            {resetText && <p className="text-gray-300">{resetText}</p>}
          </div>
        );
      })}
      {showExtraUsage && extraUsage && (
        <p className="border-t border-gray-600 pt-1 text-gray-300">
          {t("usageLimitsBadge.extraUsage", {
            usedCredits: extraUsage.usedCredits,
            monthlyLimit: extraUsage.monthlyLimit,
            currency: extraUsage.currency,
          })}
        </p>
      )}
      <p className="text-gray-400">{t("usageLimitsBadge.clickToRefresh")}</p>
    </div>
  );

  return (
    <Tooltip content={tooltipContent}>
      <Button
        variant="unstyled"
        onClick={onRefresh}
        aria-label={t("usageLimitsBadge.title")}
        className={`border ${colorClass}`}
        icon={
          loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gauge className="h-4 w-4" />
        }
      >
        {compactText}
      </Button>
    </Tooltip>
  );
}
