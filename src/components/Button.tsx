import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "danger" | "outline" | "ghost" | "link" | "unstyled";

export type ButtonSize = "sm" | "md" | "icon" | "none";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  fullWidth?: boolean;
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-marrom-900 text-white hover:bg-marrom-800 dark:bg-marrom-600 dark:hover:bg-marrom-700",
  danger: "bg-vinho-900 text-white hover:bg-vinho-800 dark:bg-vinho-600 dark:hover:bg-vinho-700",
  outline:
    "border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:bg-stone-800",
  ghost:
    "text-stone-600 hover:bg-stone-100 hover:text-stone-700 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-200",
  link: "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200",
  // No color classes — spacing/typography from `size` still applies. Escape hatch for one-off
  // buttons whose coloring doesn't fit the standard palette (e.g. status-driven or `text-current`
  // based colors) and would otherwise fight a variant's own color classes for precedence.
  unstyled: "",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "gap-1 rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-60",
  md: "gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60",
  icon: "rounded-md p-1.5 disabled:opacity-40",
  none: "text-sm font-medium disabled:opacity-60",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    icon,
    fullWidth = false,
    className = "",
    children,
    type = "button",
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex shrink-0 items-center justify-center transition-colors disabled:cursor-not-allowed ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});
