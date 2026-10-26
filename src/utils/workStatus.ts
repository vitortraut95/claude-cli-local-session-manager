import type { TranslationKey } from "../i18n/translations";
import { WORK_STATUSES, type WorkStatus } from "../../shared/session";

export { WORK_STATUSES };

export const WORK_STATUS_LABEL_KEYS: Record<WorkStatus, TranslationKey> = {
  todo: "workStatus.todo",
  in_progress: "workStatus.inProgress",
  waiting_user: "workStatus.waitingUser",
  done: "workStatus.done",
};

export const WORK_STATUS_CLASSES: Record<WorkStatus | "none", string> = {
  none: "border-dashed border-gray-300 bg-white text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400",
  todo: "border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300",
  in_progress:
    "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  waiting_user:
    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300",
  done: "border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300",
};

/** The list's status filter: "" = all, "open" = everything not done (what's left to resume),
 *  "none" = never set, or one status. */
export type WorkStatusFilter = "" | "open" | "none" | WorkStatus;

export function parseWorkStatusFilter(raw: string): WorkStatusFilter {
  return raw === "open" || raw === "none" || (WORK_STATUSES as readonly string[]).includes(raw)
    ? (raw as WorkStatusFilter)
    : "";
}

export function matchesWorkStatusFilter(
  status: WorkStatus | null | undefined,
  filter: WorkStatusFilter,
): boolean {
  if (filter === "") return true;
  if (filter === "open") return status !== "done";
  if (filter === "none") return !status;
  return status === filter;
}
