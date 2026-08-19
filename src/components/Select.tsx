import { ChevronDown } from "lucide-react";
import type { ReactNode, SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  icon?: ReactNode;
};

export function Select({ icon, className = "", children, ...rest }: SelectProps) {
  return (
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500">
          {icon}
        </span>
      )}
      <select
        className={`w-full appearance-none rounded-lg border border-stone-300 bg-white py-2 ${icon ? "pl-9" : "pl-3"} pr-8 text-sm text-stone-700 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:focus:border-stone-600 dark:focus:ring-stone-100/10 cursor-pointer ${className}`}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400 dark:text-stone-500" />
    </div>
  );
}
