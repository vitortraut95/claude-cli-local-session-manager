import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant =
  "primary" | "danger" | "outline" | "outline-danger" | "ghost" | "link" | "unstyled";

type ButtonSize = "sm" | "md" | "icon" | "none";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  fullWidth?: boolean;
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  // The brand violet: one primary action per view.
  primary: "bg-violet-600 text-white shadow-sm hover:bg-violet-700",
  danger: "bg-red-600 text-white hover:bg-red-700",
  outline:
    "border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:border-gray-600 dark:hover:bg-gray-800",
  "outline-danger":
    "border border-red-200 bg-white text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:bg-gray-900 dark:text-red-400 dark:hover:bg-red-950/50",
  ghost:
    "text-gray-600 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200",
  link: "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200",
  // No color classes — spacing/typography from `size` still applies.
  unstyled: "",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "min-h-8 gap-1.5 rounded-md px-3 py-1 text-xs font-medium disabled:opacity-60",
  md: "min-h-10 gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60",
  icon: "min-h-8 min-w-8 rounded-md p-1.5 disabled:opacity-40",
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
