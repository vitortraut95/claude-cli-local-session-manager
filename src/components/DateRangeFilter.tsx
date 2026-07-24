import { Calendar } from "lucide-react";
import { Input } from "./Input";

type DateRangeFilterProps = {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
};

export function DateRangeFilter({ from, to, onChange }: DateRangeFilterProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Input
        type="date"
        value={from}
        onChange={(event) => onChange(event.target.value, to)}
        max={to || undefined}
        aria-label="Updated from"
        icon={<Calendar className="h-4 w-4" />}
        className="sm:w-40"
      />
      <span className="text-sm text-gray-400 dark:text-gray-500">to</span>
      <Input
        type="date"
        value={to}
        onChange={(event) => onChange(from, event.target.value)}
        min={from || undefined}
        aria-label="Updated to"
        icon={<Calendar className="h-4 w-4" />}
        className="sm:w-40"
      />
    </div>
  );
}
