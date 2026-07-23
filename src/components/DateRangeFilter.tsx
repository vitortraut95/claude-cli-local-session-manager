import { Calendar } from "lucide-react";

type DateRangeFilterProps = {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
};

export function DateRangeFilter({ from, to, onChange }: DateRangeFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
        <input
          type="date"
          value={from}
          onChange={(event) => onChange(event.target.value, to)}
          max={to || undefined}
          aria-label="Updated from"
          className="w-full appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-700 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 sm:w-40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:focus:border-gray-600 dark:focus:ring-gray-100/10"
        />
      </div>
      <span className="text-sm text-gray-400 dark:text-gray-500">to</span>
      <div className="relative">
        <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
        <input
          type="date"
          value={to}
          onChange={(event) => onChange(from, event.target.value)}
          min={from || undefined}
          aria-label="Updated to"
          className="w-full appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-700 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 sm:w-40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:focus:border-gray-600 dark:focus:ring-gray-100/10"
        />
      </div>
    </div>
  );
}
