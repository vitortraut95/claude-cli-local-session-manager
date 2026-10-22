import type { ReactNode } from "react";

type SettingRowProps = {
  /** The input/select, on the left at a fixed width so the rows line up. */
  control: ReactNode;
  label: ReactNode;
  description?: ReactNode;
  /** Tailwind width of the control column (default fits a short number). */
  controlWidth?: string;
};

/** One setting per line: the control on the left, its label and a short description on the right. */
export function SettingRow({
  control,
  label,
  description,
  controlWidth = "w-24",
}: SettingRowProps) {
  return (
    <div className="flex items-center gap-3">
      <div className={`${controlWidth} shrink-0`}>{control}</div>
      <div className="min-w-0">
        <p className="text-sm text-gray-900 dark:text-gray-100">{label}</p>
        {description && <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>}
      </div>
    </div>
  );
}
