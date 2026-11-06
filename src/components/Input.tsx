import { forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  icon?: ReactNode;
  rightElement?: ReactNode;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { icon, rightElement, className = "", ...rest },
  ref,
) {
  return (
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
          {icon}
        </span>
      )}
      <input
        ref={ref}
        className={`w-full rounded-lg border border-gray-300 bg-white py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/25 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-violet-400 dark:focus:ring-violet-400/30 ${icon ? "pl-9" : "pl-3"} ${rightElement ? "pr-9" : "pr-3"} ${className}`}
        {...rest}
      />
      {rightElement && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2">{rightElement}</span>
      )}
    </div>
  );
});
