import { Calendar } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import { Input } from "./Input";

type DateRangeFilterProps = {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
};

export function DateRangeFilter({ from, to, onChange }: DateRangeFilterProps) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Input
        type="date"
        value={from}
        onChange={(event) => onChange(event.target.value, to)}
        max={to || undefined}
        aria-label={t("dateRangeFilter.fromLabel")}
        icon={<Calendar className="h-4 w-4" />}
        className="sm:w-40"
      />
      <span className="text-sm text-stone-400 dark:text-stone-500">{t("dateRangeFilter.to")}</span>
      <Input
        type="date"
        value={to}
        onChange={(event) => onChange(from, event.target.value)}
        min={from || undefined}
        aria-label={t("dateRangeFilter.toLabel")}
        icon={<Calendar className="h-4 w-4" />}
        className="sm:w-40"
      />
    </div>
  );
}
