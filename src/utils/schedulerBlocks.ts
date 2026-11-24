import type { TranslationKey } from "../i18n/translations";
import type { SchedulerBlock } from "../services/tasksApi";

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
