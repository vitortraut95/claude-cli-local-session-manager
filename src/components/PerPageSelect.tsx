import { useLanguage } from "../hooks/useLanguage";
import { PER_PAGE_OPTIONS } from "../hooks/useSessions";
import { Select } from "./Select";

type PerPageSelectProps = {
  value: number;
  onChange: (value: number) => void;
};

export function PerPageSelect({ value, onChange }: PerPageSelectProps) {
  const { t } = useLanguage();
  return (
    <Select
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      aria-label={t("perPageSelect.ariaLabel")}
      className="sm:w-auto"
    >
      {PER_PAGE_OPTIONS.map((option) => (
        <option key={option} value={option}>
          {option === 999999 ? t("perPageSelect.all") : t("perPageSelect.perPage", { count: option })}
        </option>
      ))}
    </Select>
  );
}
