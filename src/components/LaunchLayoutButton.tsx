import { ChevronDown, LayoutGrid, Loader2, SquareTerminal } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useTeamLinks } from "../hooks/useTeamLinks";
import type { TerminalLayout } from "../services/preferencesApi";
import { Button } from "./Button";

type LaunchLayoutButtonProps = {
  label: ReactNode;
  icon?: ReactNode;
  busy?: boolean;
  disabled?: boolean;
  /** `layout` = where the user picked to open it; undefined = the `terminalLayout` preference. */
  onLaunch: (layout?: TerminalLayout) => void;
  variant?: "primary" | "outline";
  size?: "sm" | "md";
  fullWidth?: boolean;
  /** Edge the menu lines up with — "right" for a button at the right edge of a modal. */
  align?: "left" | "right";
};

/**
 * Button of an action that opens a Claude session. With the Limux grid as `terminalLayout` it
 * opens a menu asking whether this one goes to the grid or to a terminal of its own; otherwise it
 * launches on click.
 */
export function LaunchLayoutButton({
  label,
  icon,
  busy = false,
  disabled = false,
  onLaunch,
  variant = "primary",
  size = "md",
  fullWidth = false,
  align = "left",
}: LaunchLayoutButtonProps) {
  const { t } = useLanguage();
  const { gridLayout } = useTeamLinks();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Closes only the menu, not the modal around it.
        event.stopImmediatePropagation();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  const buttonIcon = busy ? <Loader2 className={`${iconSize} animate-spin`} /> : icon;

  if (!gridLayout) {
    return (
      <Button
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        onClick={() => onLaunch()}
        disabled={disabled || busy}
        icon={buttonIcon}
      >
        {label}
      </Button>
    );
  }

  const options = [
    {
      layout: "limux-grid" as const,
      label: t("launchIn.grid"),
      icon: <LayoutGrid className="h-4 w-4" />,
    },
    {
      layout: "tabs" as const,
      label: t("launchIn.terminal"),
      icon: <SquareTerminal className="h-4 w-4" />,
    },
  ];

  return (
    <div ref={containerRef} className={`relative flex ${fullWidth ? "flex-1" : ""}`}>
      <Button
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || busy}
        aria-haspopup="menu"
        aria-expanded={open}
        icon={buttonIcon}
      >
        {label}
        <ChevronDown className={iconSize} />
      </Button>
      {open && (
        <div
          role="menu"
          className={`absolute bottom-full z-20 mb-1 w-full min-w-44 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900 ${align === "right" ? "right-0" : "left-0"}`}
        >
          {options.map((option) => (
            <button
              key={option.layout}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onLaunch(option.layout);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-800"
            >
              <span className="text-gray-500 dark:text-gray-400">{option.icon}</span>
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
