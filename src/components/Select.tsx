import { ChevronDown } from "lucide-react";
import type { ReactNode, SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  icon?: ReactNode;
};

export function Select({ icon, className = "", children, ...rest }: SelectProps) {
  return (
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
          {icon}
        </span>
      )}
      <select
        className={`w-full appearance-none rounded-lg border border-gray-300 bg-white py-2 ${icon ? "pl-9" : "pl-3"} pr-8 text-sm text-gray-700 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:focus:border-gray-600 dark:focus:ring-gray-100/10 ${className}`}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
    </div>
  );
}
