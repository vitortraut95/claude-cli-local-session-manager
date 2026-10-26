import { ChevronDown, FlaskConical, Loader2 } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import type { WorkStatus } from "../../shared/session";
import { WORK_STATUS_CLASSES, WORK_STATUS_LABEL_KEYS, WORK_STATUSES } from "../utils/workStatus";
import { Tooltip } from "./Tooltip";

type WorkStatusSelectProps = {
  value: WorkStatus | null;
  /** The card's task key; null = the status is the session's own. */
  taskKey: string | null;
  /** Set for a test session: only in progress or done, behind a "Test" chip. */
  testKey?: string | null;
  saving: boolean;
  onChange: (status: WorkStatus | null) => void;
};

const TEST_STATUSES: readonly WorkStatus[] = ["in_progress", "done"];

/** A session card's editable status tag: a native select styled as a colored pill. */
export function WorkStatusSelect({
  value,
  taskKey,
  testKey = null,
  saving,
  onChange,
}: WorkStatusSelectProps) {
  const { t } = useLanguage();
  const statuses = testKey ? TEST_STATUSES : WORK_STATUSES;
  return (
    <Tooltip
      content={
        testKey
          ? t("workStatus.testTooltip", { key: testKey })
          : taskKey
            ? t("workStatus.taskTooltip", { key: taskKey })
            : t("workStatus.sessionTooltip")
      }
    >
      <span className="relative inline-flex w-fit items-center gap-1">
        {testKey && (
          <span className="flex h-5 items-center gap-1 rounded-full bg-teal-50 px-2 text-xs font-medium text-teal-700 dark:bg-teal-950/50 dark:text-teal-300">
            <FlaskConical className="h-3 w-3" />
            {t("workStatus.testChip")}
          </span>
        )}
        <select
          value={value ?? ""}
          onChange={(event) => onChange((event.target.value || null) as WorkStatus | null)}
          disabled={saving}
          aria-label={t("workStatus.ariaLabel")}
          className={`cursor-pointer appearance-none h-5 rounded-full border py-0 pl-2.5 pr-6 text-xs leading-4 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:cursor-wait disabled:opacity-60 dark:focus:ring-gray-100/10 ${WORK_STATUS_CLASSES[value ?? "none"]}`}
        >
          {(!testKey || value === null) && (
            <option value="" disabled={Boolean(testKey)}>
              {t("workStatus.none")}
            </option>
          )}
          {statuses.map((status) => (
            <option key={status} value={status}>
              {t(WORK_STATUS_LABEL_KEYS[status])}
            </option>
          ))}
        </select>
        {saving ? (
          <Loader2 className="pointer-events-none absolute right-1.5 h-3 w-3 animate-spin" />
        ) : (
          <ChevronDown className="pointer-events-none absolute right-1.5 h-3 w-3 opacity-70" />
        )}
      </span>
    </Tooltip>
  );
}
