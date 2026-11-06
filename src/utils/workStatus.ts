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
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/60 dark:text-violet-300",
  waiting_user:
    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300",
  done: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300",
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

/** The dot color of each status, for compact pills and the list's rows. */
export const WORK_STATUS_DOT: Record<WorkStatus | "none", string> = {
  none: "bg-gray-400 dark:bg-gray-500",
  todo: "bg-gray-400",
  in_progress: "bg-violet-500 dark:bg-violet-400",
  waiting_user: "bg-amber-500 dark:bg-amber-400",
  done: "bg-emerald-500 dark:bg-emerald-400",
};
