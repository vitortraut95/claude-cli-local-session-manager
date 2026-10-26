import { useLanguage } from "../hooks/useLanguage";
import { Select } from "./Select";

/** Select values for a prefix: null = not chosen yet, "" = no prefix. */
const PREFIX_UNSET = "__unset__";
const PREFIX_NONE = "__none__";

function prefixToValue(prefix: string | null): string {
  return prefix === null ? PREFIX_UNSET : prefix === "" ? PREFIX_NONE : prefix;
}

function valueToPrefix(value: string): string | null {
  return value === PREFIX_UNSET ? null : value === PREFIX_NONE ? "" : value;
}

type TaskQueuePrefixSelectProps = {
  value: string | null;
  onChange: (prefix: string | null) => void;
  branchTypes: string[];
  className?: string;
};

export function TaskQueuePrefixSelect({
  value,
  onChange,
  branchTypes,
  className = "",
}: TaskQueuePrefixSelectProps) {
  const { t } = useLanguage();
  // A stored prefix no longer among the configured types stays selectable.
  const options = value && !branchTypes.includes(value) ? [value, ...branchTypes] : branchTypes;
  return (
    <Select
      value={prefixToValue(value)}
      onChange={(event) => onChange(valueToPrefix(event.target.value))}
      aria-label={t("taskQueueModal.prefixAriaLabel")}
      className={`${value === null ? "border-amber-400 dark:border-amber-600" : ""} ${className}`}
    >
      <option value={PREFIX_UNSET} disabled>
        {t("taskQueueModal.prefixUnset")}
      </option>
      {options.map((prefix) => (
        <option key={prefix} value={prefix}>
          {prefix}/
        </option>
      ))}
      <option value={PREFIX_NONE}>{t("taskQueueModal.prefixNone")}</option>
    </Select>
  );
}
