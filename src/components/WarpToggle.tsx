import { TerminalSquare } from "lucide-react";
import { Tooltip } from "./Tooltip";

type WarpToggleProps = {
  enabled: boolean;
  onToggle: () => void;
};

export function WarpToggle({ enabled, onToggle }: WarpToggleProps) {
  return (
    <Tooltip
      content={
        enabled
          ? "Continue opens sessions in Warp (experimental) — click to use the default terminal instead"
          : "Continue opens sessions in the default terminal — click to use Warp instead (experimental)"
      }
    >
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={enabled ? "Disable Warp terminal" : "Enable Warp terminal (experimental)"}
        onClick={onToggle}
        className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition-colors ${
          enabled
            ? "border-orange-300 bg-orange-100 dark:border-orange-800 dark:bg-orange-950/50"
            : "border-gray-300 bg-gray-100 dark:border-gray-700 dark:bg-gray-800"
        }`}
      >
        <span
          className={`inline-flex h-6 w-6 items-center justify-center rounded-full bg-white shadow transition-transform dark:bg-gray-950 ${
            enabled ? "translate-x-7" : "translate-x-1"
          }`}
        >
          <TerminalSquare
            className={`h-3.5 w-3.5 ${enabled ? "text-orange-500" : "text-gray-400"}`}
          />
        </span>
      </button>
    </Tooltip>
  );
}
