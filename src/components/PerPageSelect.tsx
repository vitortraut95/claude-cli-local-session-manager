import { ChevronDown } from "lucide-react";
import { PER_PAGE_OPTIONS } from "../hooks/useSessions";

type PerPageSelectProps = {
  value: number;
  onChange: (value: number) => void;
};

export function PerPageSelect({ value, onChange }: PerPageSelectProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label="Sessions per page"
        className="w-full appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-gray-700 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 sm:w-auto dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:focus:border-gray-600 dark:focus:ring-gray-100/10"
      >
        {PER_PAGE_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option === 999999 ? "All" : `${option} / page`}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
    </div>
  );
}
