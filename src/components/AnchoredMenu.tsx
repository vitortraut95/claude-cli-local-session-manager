import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type AnchoredMenuProps = {
  /** The button's content (a chevron is appended). */
  label: ReactNode;
  buttonClassName: string;
  disabled?: boolean;
  /** The menu's content; `close` hides it (e.g. after a pick). */
  children: (close: () => void) => ReactNode;
  /** Edge of the button the menu lines up with; "right" for buttons near the window's right. */
  align?: "left" | "right";
  /** Leaves out the chevron (an icon-only trigger such as "⋯"). */
  hideChevron?: boolean;
  /** Accessible name when the label is an icon only. */
  ariaLabel?: string;
};

/**
 * A button that opens a menu under it. The menu is portalled to the body (fixed): inside a session
 * card it would sit under the next card of the grid (the card's hover transform makes it a
 * stacking context). Closes on an outside click, Escape, scroll or resize.
 */
export function AnchoredMenu({
  label,
  buttonClassName,
  disabled = false,
  children,
  align = "left",
  hideChevron = false,
  ariaLabel,
}: AnchoredMenuProps) {
  const [menuAt, setMenuAt] = useState<{
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuAt) return;
    const close = () => setMenuAt(null);
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Caught first (capture) so a modal under the menu doesn't close with it.
      event.stopPropagation();
      close();
    };
    const onScroll = (event: Event) => {
      // The menu's own scrolling doesn't move the button.
      if (!menuRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [menuAt]);

  const toggle = () => {
    if (menuAt) {
      setMenuAt(null);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Opens upward when the menu (up to max-h-80) wouldn't fit below the button.
    const vertical =
      rect.bottom + 330 > window.innerHeight && rect.top > 330
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 };
    setMenuAt(
      align === "right"
        ? { ...vertical, right: Math.max(8, window.innerWidth - rect.right) }
        : { ...vertical, left: rect.left },
    );
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={menuAt !== null}
        aria-label={ariaLabel}
        disabled={disabled}
        className={`flex items-center gap-1 disabled:cursor-not-allowed disabled:opacity-60 ${buttonClassName}`}
      >
        {label}
        {!hideChevron && <ChevronDown className="h-3 w-3 text-gray-400" />}
      </button>
      {menuAt &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={menuAt}
            className="fixed z-50 flex max-h-80 min-w-56 flex-col gap-1.5 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 text-xs shadow-lg dark:border-gray-700 dark:bg-gray-900"
          >
            {children(() => setMenuAt(null))}
          </div>,
          document.body,
        )}
    </>
  );
}
