import { CircleCheck, TriangleAlert } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import { Tooltip } from "./Tooltip";
import {
  formatBytes,
  sessionSizeColor,
  sessionSizeFraction,
  sessionSizeMessage,
  sessionSizeStatus,
} from "../utils/sessionSize";

type SessionSizeMeterProps = {
  sizeBytes: number;
};

/**
 * Meant to be placed flush against the bottom edge of its container (see SessionCard, which
 * cancels its own padding around this) — a full-width footer strip rather than an inline badge,
 * so it reads at a glance across every card in the list.
 */
export function SessionSizeMeter({ sizeBytes }: SessionSizeMeterProps) {
  const { t } = useLanguage();
  const status = sessionSizeStatus(sizeBytes);
  const fraction = sessionSizeFraction(sizeBytes);
  const message = sessionSizeMessage(sizeBytes);

  return (
    <Tooltip content={t("sessionSizeMeter.tooltip", { size: formatBytes(sizeBytes), message })}>
      <div className="flex w-full flex-col gap-1 rounded-b-xl bg-marrom-50 px-3 py-1.5 dark:bg-stone-800/50">
        <span className="flex items-center gap-1 text-[10px] text-stone-500 dark:text-stone-400">
          {status === "healthy" ? (
            <CircleCheck className="h-3 w-3 shrink-0" />
          ) : (
            <TriangleAlert className="h-3 w-3 shrink-0" />
          )}
          {t("sessionSizeMeter.label", { size: formatBytes(sizeBytes) })}
        </span>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.max(fraction * 100, 4)}%`,
              backgroundColor: sessionSizeColor(fraction),
            }}
          />
        </div>
      </div>
    </Tooltip>
  );
}
