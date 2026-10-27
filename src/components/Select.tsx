import { Check, ChevronDown, Search } from "lucide-react";
import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEventHandler,
  type KeyboardEvent,
  type MouseEventHandler,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../hooks/useLanguage";

type SelectProps = {
  value: string;
  /** Same shape callers used with a native `<select>`: read `event.target.value`. */
  onChange?: (event: { target: { value: string } }) => void;
  /** `<option>`s, optionally inside `<optgroup>`s (fragments, arrays and `false` are fine). */
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
  disabled?: boolean;
  title?: string;
  "aria-label"?: string;
  /** Looks enabled but doesn't open — the caller explains why (with onMouseDown/onFocus). */
  "aria-disabled"?: boolean;
  /** Runs before opening; `preventDefault()` keeps it closed. */
  onMouseDown?: MouseEventHandler<HTMLButtonElement>;
  onFocus?: FocusEventHandler<HTMLButtonElement>;
};

type Item = {
  value: string;
  label: string;
  group: string | null;
  disabled: boolean;
  title?: string;
};

type OptionProps = {
  value?: string | number;
  disabled?: boolean;
  title?: string;
  children?: ReactNode;
};
type GroupProps = { label?: string; children?: ReactNode };

function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

/** The `<option>`s in `children`, in order, with the label of the `<optgroup>` around each. */
function collectItems(children: ReactNode, group: string | null = null): Item[] {
  const items: Item[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === Fragment) {
      items.push(...collectItems((child as ReactElement<GroupProps>).props.children, group));
    } else if (child.type === "optgroup") {
      const props = (child as ReactElement<GroupProps>).props;
      items.push(...collectItems(props.children, props.label ?? null));
    } else if (child.type === "option") {
      const props = (child as ReactElement<OptionProps>).props;
      const label = textOf(props.children);
      items.push({
        value: props.value === undefined ? label : String(props.value),
        label,
        group,
        disabled: Boolean(props.disabled),
        title: props.title,
      });
    }
  });
  return items;
}

/** Case- and accent-insensitive. */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

const POPOVER_MAX_HEIGHT = 320;

/**
 * The app's only select: a button that opens a searchable list (typing filters by option and group
 * label). Takes `<option>`/`<optgroup>` children like a native `<select>`. The list is portalled to
 * `document.body` with fixed position, so a modal's overflow or a card's transform can't clip it;
 * Escape closes the list without reaching the modal under it.
 */
export function Select({
  value,
  onChange,
  children,
  icon,
  className = "",
  disabled = false,
  title,
  "aria-label": ariaLabel,
  "aria-disabled": ariaDisabled,
  onMouseDown,
  onFocus,
}: SelectProps) {
  const { t } = useLanguage();
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState<CSSProperties>({});

  const items = useMemo(() => collectItems(children), [children]);
  const selected = items.find((item) => item.value === value);
  const filtered = useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) return items;
    return items.filter((item) => normalize(`${item.group ?? ""} ${item.label}`).includes(needle));
  }, [items, query]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const openList = () => {
    if (disabled || ariaDisabled) return;
    setQuery("");
    const index = items.findIndex((item) => item.value === value);
    setActive(Math.max(index, 0));
    setOpen(true);
  };

  const choose = (item: Item) => {
    if (item.disabled) return;
    close(true);
    if (item.value !== value) onChange?.({ target: { value: item.value } });
  };

  // Placed under the trigger, or above it when there's no room below.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const below = window.innerHeight - rect.bottom;
      const above = rect.top;
      const up = below < POPOVER_MAX_HEIGHT && above > below;
      setPosition({
        left: Math.min(rect.left, window.innerWidth - Math.max(rect.width, 240) - 8),
        minWidth: Math.max(rect.width, 240),
        maxWidth: Math.min(window.innerWidth - 16, 560),
        ...(up ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
        maxHeight: Math.min(POPOVER_MAX_HEIGHT, (up ? above : below) - 12),
      });
    };
    place();
    const onScroll = (event: Event) => {
      if (popoverRef.current?.contains(event.target as Node)) return;
      place();
    };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  // A click anywhere else closes it.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const move = (step: 1 | -1) => {
    if (filtered.length === 0) return;
    // The next enabled option in that direction, wrapping around.
    const order = filtered.map(
      (_, k) => (active + step * (k + 1) + filtered.length * 2) % filtered.length,
    );
    const next = order.find((index) => !filtered[index]?.disabled);
    if (next !== undefined) setActive(next);
  };

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      move(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = filtered[active];
      if (item) choose(item);
    } else if (event.key === "Escape") {
      // Keeps the modal under it from closing too (its listener is on window).
      event.stopPropagation();
      close(true);
    } else if (event.key === "Tab") {
      close(false);
    }
  };

  return (
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
          {icon}
        </span>
      )}
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-disabled={ariaDisabled}
        disabled={disabled}
        title={title ?? selected?.title}
        onMouseDown={(event) => {
          onMouseDown?.(event);
          if (event.defaultPrevented || event.button !== 0) return;
          event.preventDefault();
          if (open) close(false);
          else openList();
        }}
        onFocus={onFocus}
        onKeyDown={(event) => {
          if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            openList();
          }
        }}
        className={`w-full truncate rounded-lg border border-gray-300 bg-white py-2 text-left ${icon ? "pl-9" : "pl-3"} pr-8 text-sm text-gray-700 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:focus:border-gray-600 dark:focus:ring-gray-100/10 ${className}`}
      >
        {selected?.label ?? value}
        {/* Keeps the trigger's height when the label is empty. */}
        {"​"}
      </button>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />

      {open &&
        createPortal(
          <div
            ref={popoverRef}
            style={position}
            className="fixed z-[1000] flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white text-sm shadow-lg dark:border-gray-700 dark:bg-gray-900"
          >
            <div className="relative border-b border-gray-200 dark:border-gray-700">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                onKeyDown={onSearchKeyDown}
                placeholder={t("select.search")}
                aria-controls={listId}
                className="w-full bg-transparent py-2 pl-8 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none dark:text-gray-100"
              />
            </div>
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              className="min-h-0 flex-1 overflow-y-auto py-1"
            >
              {filtered.length === 0 && (
                <li className="px-3 py-2 text-gray-500 dark:text-gray-400">
                  {t("select.noResults")}
                </li>
              )}
              {filtered.map((item, index) => {
                const header = item.group !== null && item.group !== filtered[index - 1]?.group;
                return (
                  <Fragment key={`${item.group ?? ""}\u0000${item.value}`}>
                    {header && (
                      <li className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        {item.group}
                      </li>
                    )}
                    <li
                      role="option"
                      data-index={index}
                      aria-selected={item.value === value}
                      aria-disabled={item.disabled}
                      title={item.title}
                      onMouseEnter={() => setActive(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => choose(item)}
                      className={`flex cursor-pointer items-center gap-2 py-1.5 pr-3 ${item.group !== null ? "pl-5" : "pl-3"} ${
                        item.disabled
                          ? "cursor-not-allowed text-gray-400 dark:text-gray-600"
                          : "text-gray-700 dark:text-gray-200"
                      } ${index === active && !item.disabled ? "bg-gray-100 dark:bg-gray-800" : ""}`}
                    >
                      <span className="min-w-0 flex-1 truncate">{item.label || " "}</span>
                      {item.value === value && (
                        <Check className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                      )}
                    </li>
                  </Fragment>
                );
              })}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}
