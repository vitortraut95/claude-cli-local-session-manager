import { Gauge, Loader2 } from "lucide-react";
import type { ClaudeUsageStatus } from "../services/systemApi";
import { Button } from "./Button";
import { Tooltip } from "./Tooltip";

type UsageLimitsBadgeProps = {
  status: ClaudeUsageStatus | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
};

/** Short header-badge labels for the limit kinds actually seen in practice — anything else falls
 *  back to a generic transform of its raw `kind` so a new limit type Anthropic adds still shows
 *  up (just less prettily) instead of being silently dropped. */
const COMPACT_LABELS: Record<string, string> = { session: "5h", weekly_all: "7d" };
const FULL_LABELS: Record<string, string> = {
  session: "Sessão (5h)",
  weekly_all: "Semanal",
  weekly_opus: "Semanal (Opus)",
  weekly_sonnet: "Semanal (Sonnet)",
};

function compactLabel(kind: string): string {
  return COMPACT_LABELS[kind] ?? kind.replace(/^weekly_/, "").slice(0, 6);
}

function fullLabel(kind: string): string {
  return FULL_LABELS[kind] ?? kind.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** "reseta em 3h 12min (30/07 21:29)" — both the relative countdown and an absolute local time,
 *  since "quando expira" was the whole point of adding this. */
function formatResetsAt(resetsAt: string | null): string | null {
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
  if (diffMs <= 0) return `reseta em breve (${absolute})`;

  const totalMinutes = Math.round(diffMs / 60000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (days === 0 && minutes > 0) parts.push(`${minutes}min`);
  const relative = parts.length > 0 ? parts.join(" ") : "menos de 1min";
  return `reseta em ${relative} (${absolute})`;
}

export function UsageLimitsBadge({ status, loading, error, onRefresh }: UsageLimitsBadgeProps) {
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
      ? limits.map((limit) => `${compactLabel(limit.kind)} ${Math.round(limit.percent)}%`).join(" · ")
      : error
        ? "Uso indisponível"
        : "Uso —";

  // Anthropic's extra-usage-credits add-on: only worth a line when the account actually has a
  // limit configured — an account that's technically "enabled" but with a 0 monthly limit (the
  // common case for anyone who hasn't opted in) would otherwise show a confusing "0 / 0" line.
  const extraUsage = status?.extraUsage;
  const showExtraUsage = Boolean(extraUsage?.isEnabled && extraUsage.monthlyLimit > 0);

  const tooltipContent = (
    <div className="flex flex-col gap-2 text-left">
      <p className="font-semibold">Limites de uso do Claude</p>
      {error && <p className="text-red-300">{error}</p>}
      {!error && limits.length === 0 && !loading && <p>Nenhum limite reportado.</p>}
      {limits.map((limit) => {
        const resetText = formatResetsAt(limit.resetsAt);
        return (
          <div key={limit.kind}>
            <p>
              {fullLabel(limit.kind)}: <strong>{Math.round(limit.percent)}%</strong>
            </p>
            {resetText && <p className="text-gray-300">{resetText}</p>}
          </div>
        );
      })}
      {showExtraUsage && extraUsage && (
        <p className="border-t border-gray-600 pt-1 text-gray-300">
          Uso extra: {extraUsage.usedCredits} / {extraUsage.monthlyLimit} {extraUsage.currency}
        </p>
      )}
      <p className="text-gray-400">Clique para atualizar.</p>
    </div>
  );

  return (
    <Tooltip content={tooltipContent}>
      <Button
        variant="unstyled"
        onClick={onRefresh}
        aria-label="Claude usage limits"
        className={`border ${colorClass}`}
        icon={loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gauge className="h-4 w-4" />}
      >
        {compactText}
      </Button>
    </Tooltip>
  );
}
