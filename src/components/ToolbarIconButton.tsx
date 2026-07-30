import type { ReactNode } from "react";
import { Tooltip } from "./Tooltip";

export type ToolbarIconButtonColor = "neutral" | "amber" | "green" | "blue" | "red";

const COLOR_CLASSES: Record<ToolbarIconButtonColor, string> = {
  neutral:
    "text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200",
  amber:
    "text-amber-500 hover:bg-amber-50 hover:text-amber-600 dark:text-amber-400 dark:hover:bg-amber-950/40",
  green:
    "text-green-600 hover:bg-green-50 hover:text-green-700 dark:text-green-400 dark:hover:bg-green-950/40",
  blue: "text-blue-500 hover:bg-blue-50 hover:text-blue-600 dark:text-blue-400 dark:hover:bg-blue-950/40",
  red: "text-red-500 hover:bg-red-50 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-950/40",
};

type ToolbarIconButtonProps = {
  tooltip: string;
  ariaLabel: string;
  icon: ReactNode;
  color: ToolbarIconButtonColor;
  onClick: () => void;
  disabled?: boolean;
};

/**
 * One entry in a card's action toolbar (see SessionCard) — same footprint and interaction for
 * every icon, distinguished only by its color, so the row keeps reading consistently as more
 * actions get added to it over time.
 */
export function ToolbarIconButton({
  tooltip,
  ariaLabel,
  icon,
  color,
  onClick,
  disabled = false,
}: ToolbarIconButtonProps) {
  return (
    <Tooltip content={tooltip}>
      {/* A native `disabled` button doesn't reliably fire hover events, so the tooltip is
          anchored to this always-enabled wrapping span instead — same trick SessionCard uses for
          its own disabled Continue/Delete buttons. */}
      <span className="inline-flex shrink-0">
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={ariaLabel}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${COLOR_CLASSES[color]}`}
        >
          {icon}
        </button>
      </span>
    </Tooltip>
  );
}
