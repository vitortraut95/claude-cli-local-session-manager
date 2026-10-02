import type { ReactNode } from "react";
import { Tooltip } from "./Tooltip";

export type ToolbarIconButtonColor =
  | "neutral"
  | "amber"
  | "green"
  | "blue"
  | "red"
  | "violet"
  | "teal"
  | "orange"
  | "pink"
  | "lime";

const COLOR_CLASSES: Record<ToolbarIconButtonColor, string> = {
  neutral:
    "text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200",
  amber:
    "text-amber-500 hover:bg-amber-50 hover:text-amber-600 dark:text-amber-400 dark:hover:bg-amber-950/40",
  green:
    "text-green-600 hover:bg-green-50 hover:text-green-700 dark:text-green-400 dark:hover:bg-green-950/40",
  blue: "text-blue-500 hover:bg-blue-50 hover:text-blue-600 dark:text-blue-400 dark:hover:bg-blue-950/40",
  red: "text-red-500 hover:bg-red-50 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-950/40",
  violet:
    "text-violet-500 hover:bg-violet-50 hover:text-violet-600 dark:text-violet-400 dark:hover:bg-violet-950/40",
  teal: "text-teal-600 hover:bg-teal-50 hover:text-teal-700 dark:text-teal-400 dark:hover:bg-teal-950/40",
  orange:
    "text-orange-500 hover:bg-orange-50 hover:text-orange-600 dark:text-orange-400 dark:hover:bg-orange-950/40",
  // Close to Bitbucket's own PR green (#94C748) — used by "Open PR".
  lime: "text-lime-600 hover:bg-lime-50 hover:text-lime-700 dark:text-lime-400 dark:hover:bg-lime-950/40",
  pink: "text-pink-500 hover:bg-pink-50 hover:text-pink-600 dark:text-pink-400 dark:hover:bg-pink-950/40",
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
 * actions get added to it over time. Icon size is forced here (`[&_svg]` below) rather than by
 * each caller's own `h-4 w-4`, so the whole toolbar resizes from one place.
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
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:h-5 [&_svg]:w-5 ${COLOR_CLASSES[color]}`}
        >
          {icon}
        </button>
      </span>
    </Tooltip>
  );
}
