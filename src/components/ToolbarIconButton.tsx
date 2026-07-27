import type { ReactNode } from "react";
import { Tooltip } from "./Tooltip";

export type ToolbarIconButtonColor = "neutral" | "amber" | "green" | "blue";

const COLOR_CLASSES: Record<ToolbarIconButtonColor, string> = {
  neutral:
    "text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200",
  amber:
    "text-amber-500 hover:bg-amber-50 hover:text-amber-600 dark:text-amber-400 dark:hover:bg-amber-950/40",
  green:
    "text-green-600 hover:bg-green-50 hover:text-green-700 dark:text-green-400 dark:hover:bg-green-950/40",
  blue: "text-blue-500 hover:bg-blue-50 hover:text-blue-600 dark:text-blue-400 dark:hover:bg-blue-950/40",
};

type ToolbarIconButtonProps = {
  tooltip: string;
  ariaLabel: string;
  icon: ReactNode;
  color: ToolbarIconButtonColor;
  onClick: () => void;
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
}: ToolbarIconButtonProps) {
  return (
    <Tooltip content={tooltip}>
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${COLOR_CLASSES[color]}`}
      >
        {icon}
      </button>
    </Tooltip>
  );
}
