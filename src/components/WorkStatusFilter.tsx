import { CircleDot } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import {
  WORK_STATUS_LABEL_KEYS,
  WORK_STATUSES,
  parseWorkStatusFilter,
  type WorkStatusFilter as Filter,
} from "../utils/workStatus";
import { Select } from "./Select";

type WorkStatusFilterProps = {
  value: Filter;
  onChange: (value: Filter) => void;
};

export function WorkStatusFilter({ value, onChange }: WorkStatusFilterProps) {
  const { t } = useLanguage();
  return (
    <Select
      value={value}
      onChange={(event) => onChange(parseWorkStatusFilter(event.target.value))}
      aria-label={t("workStatusFilter.ariaLabel")}
      icon={<CircleDot className="h-4 w-4" />}
      className="sm:w-56"
    >
      <option value="">{t("workStatusFilter.all")}</option>
      <option value="open">{t("workStatusFilter.open")}</option>
      {WORK_STATUSES.map((status) => (
        <option key={status} value={status}>
          {t(WORK_STATUS_LABEL_KEYS[status])}
        </option>
      ))}
      <option value="none">{t("workStatus.none")}</option>
    </Select>
  );
}
