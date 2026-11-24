import type { TranslationKey } from "../i18n/translations";
import type { SchedulerBlock, SchedulerStatus } from "../services/tasksApi";

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** What the task queue scheduler is waiting on, in words. */
export const BLOCK_KEYS: Record<SchedulerBlock, TranslationKey> = {
  paused: "scheduler.blocked.paused",
  vpn_disconnected: "scheduler.blocked.vpnDisconnected",
  max_sessions: "scheduler.blocked.maxSessions",
  recent_launch: "scheduler.blocked.recentLaunch",
  low_memory: "scheduler.blocked.lowMemory",
  memory_pressure: "scheduler.blocked.memoryPressure",
  usage_limit: "scheduler.blocked.usageLimit",
};

/** Why the scheduler holds the queue, with the numbers behind it (sessions, RAM, plan use, when
 *  the spacing ends); null when nothing holds it. */
export function describeSchedulerBlock(
  status: SchedulerStatus | null,
  t: Translate,
): string | null {
  const blockedBy = status?.blockedBy;
  if (!status || !blockedBy) return null;
  switch (blockedBy) {
    case "recent_launch":
      return status.launchSpacingEndsAt
        ? t("scheduler.blocked.recentLaunchAt", {
            time: new Date(status.launchSpacingEndsAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          })
        : t(BLOCK_KEYS[blockedBy]);
    case "max_sessions":
      return t("scheduler.blocked.maxSessionsCount", {
        active: status.activeSessions,
        max: status.maxSessions,
      });
    case "low_memory":
      return status.freeMemoryPercent === null
        ? t(BLOCK_KEYS[blockedBy])
        : t("scheduler.blocked.lowMemoryPercent", {
            free: status.freeMemoryPercent,
            min: status.minFreeMemoryPercent,
          });
    case "usage_limit":
      return status.usagePercent === null
        ? t(BLOCK_KEYS[blockedBy])
        : t("scheduler.blocked.usageLimitPercent", {
            usage: status.usagePercent,
            max: status.maxUsagePercent,
          });
    default:
      return t(BLOCK_KEYS[blockedBy]);
  }
}
