import { FlaskConical, Pause, Play, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useToast } from "../hooks/useToast";
import type { TranslationKey } from "../i18n/translations";
import * as preferencesApi from "../services/preferencesApi";
import type { OrchestratorPreferences } from "../services/preferencesApi";
import * as tasksApi from "../services/tasksApi";
import type { HeavyRunHookStatus, SchedulerBlock, SchedulerStatus } from "../services/tasksApi";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { Button } from "./Button";
import { Input } from "./Input";

const BLOCK_KEYS: Record<SchedulerBlock, TranslationKey> = {
  paused: "scheduler.blocked.paused",
  max_sessions: "scheduler.blocked.maxSessions",
  recent_launch: "scheduler.blocked.recentLaunch",
  low_memory: "scheduler.blocked.lowMemory",
  memory_pressure: "scheduler.blocked.memoryPressure",
  usage_limit: "scheduler.blocked.usageLimit",
};

/** Same bounds the server accepts (`isOrchestratorPreferences`). */
const LIMITS: Record<Exclude<keyof OrchestratorPreferences, "enabled">, [number, number]> = {
  maxSessions: [1, 50],
  minFreeMemoryPercent: [0, 90],
  maxUsagePercent: [1, 100],
  testSlots: [1, 16],
  testMemoryMaxGb: [1, 256],
  testCpuPercent: [50, 6400],
  previewSlots: [1, 16],
  previewMemoryMaxGb: [1, 64],
};

type SchedulerPanelProps = {
  status: SchedulerStatus | null;
  /** Re-reads the status right away (after a settings change or "check now"). */
  onRefresh: () => void;
  onRunNow: () => void;
  running: boolean;
};

/** The task queue modal's top block: pause/resume, limits, and what the scheduler is waiting on. */
export function SchedulerPanel({ status, onRefresh, onRunNow, running }: SchedulerPanelProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [settings, setSettings] = useState<OrchestratorPreferences | null>(null);
  // Typed text per field, committed on blur.
  const [drafts, setDrafts] = useState<Partial<Record<keyof typeof LIMITS, string>>>({});
  const [hook, setHook] = useState<HeavyRunHookStatus | null>(null);
  const [savingHook, setSavingHook] = useState(false);

  useEffect(() => {
    let cancelled = false;
    tasksApi
      .fetchHeavyRunHookStatus()
      .then((result) => {
        if (!cancelled) setHook(result);
      })
      .catch(() => undefined);
    preferencesApi
      .fetchPreferences()
      .then((prefs) => {
        if (!cancelled && prefs.orchestrator) setSettings(prefs.orchestrator);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async (next: OrchestratorPreferences) => {
    setSettings(next);
    try {
      await preferencesApi.updatePreferences({ orchestrator: next });
      onRefresh();
    } catch {
      showToast(t("scheduler.saveError"), "error");
    }
  };

  const commitNumber = (field: keyof typeof LIMITS) => {
    if (!settings) return;
    const raw = drafts[field];
    setDrafts((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
    if (raw === undefined) return;
    const [min, max] = LIMITS[field];
    const parsed = Math.round(Number(raw));
    if (!Number.isFinite(parsed) || raw.trim() === "") return;
    const value = Math.min(max, Math.max(min, parsed));
    if (value !== settings[field]) void save({ ...settings, [field]: value });
  };

  const numberField = (field: keyof typeof LIMITS, labelKey: TranslationKey) => (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
        {t(labelKey)}
      </span>
      <Input
        type="number"
        min={LIMITS[field][0]}
        max={LIMITS[field][1]}
        value={drafts[field] ?? String(settings?.[field] ?? "")}
        disabled={!settings}
        onChange={(event) => setDrafts((current) => ({ ...current, [field]: event.target.value }))}
        onBlur={() => commitNumber(field)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commitNumber(field);
        }}
      />
    </label>
  );

  const toggleHook = async () => {
    if (!hook) return;
    setSavingHook(true);
    try {
      const next = await tasksApi.setHeavyRunHookInstalled(!hook.installed);
      setHook(next);
      showToast(
        t(next.installed ? "scheduler.tests.hookInstalled" : "scheduler.tests.hookRemoved"),
        "success",
      );
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "scheduler.tests.hookError"), "error");
    } finally {
      setSavingHook(false);
    }
  };

  const enabled = settings?.enabled ?? status?.enabled ?? true;
  const blockedBy = status?.blockedBy ?? null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {enabled ? t("scheduler.title.running") : t("scheduler.title.paused")}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {status?.launching
              ? t("scheduler.launching", { key: status.launching })
              : blockedBy
                ? t(BLOCK_KEYS[blockedBy])
                : status && status.waiting > 0
                  ? t("scheduler.ready", { count: status.waiting })
                  : t("scheduler.idle")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRunNow}
            disabled={running || !enabled}
            icon={<RefreshCw className={`h-3.5 w-3.5 ${running ? "animate-spin" : ""}`} />}
          >
            {t("scheduler.runNow")}
          </Button>
          <Button
            variant={enabled ? "outline" : "primary"}
            size="sm"
            onClick={() => settings && void save({ ...settings, enabled: !enabled })}
            disabled={!settings}
            icon={enabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          >
            {enabled ? t("scheduler.pause") : t("scheduler.resume")}
          </Button>
        </div>
      </div>

      {status && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
          <span>
            {t("scheduler.metric.sessions", {
              active: status.activeSessions,
              max: status.maxSessions,
            })}
          </span>
          {status.freeMemoryPercent !== null && (
            <span>
              {t("scheduler.metric.memory", {
                free: status.freeMemoryPercent,
                min: status.minFreeMemoryPercent,
              })}
            </span>
          )}
          {status.usagePercent !== null && (
            <span>
              {t("scheduler.metric.usage", {
                used: status.usagePercent,
                max: status.maxUsagePercent,
              })}
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {numberField("maxSessions", "scheduler.setting.maxSessions")}
        {numberField("minFreeMemoryPercent", "scheduler.setting.minFreeMemory")}
        {numberField("maxUsagePercent", "scheduler.setting.maxUsage")}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{t("scheduler.explanation")}</p>

      <div className="flex flex-col gap-3 border-t border-gray-100 pt-3 dark:border-gray-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <FlaskConical className="h-4 w-4" /> {t("scheduler.tests.title")}
            </p>
            <p
              className={`text-xs ${
                hook?.installed
                  ? "text-green-700 dark:text-green-400"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {hook === null
                ? "…"
                : hook.installed
                  ? t("scheduler.tests.on")
                  : t("scheduler.tests.off")}
            </p>
          </div>
          <Button
            variant={hook?.installed ? "outline" : "primary"}
            size="sm"
            onClick={() => void toggleHook()}
            disabled={!hook || savingHook}
          >
            {hook?.installed ? t("scheduler.tests.remove") : t("scheduler.tests.install")}
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {numberField("testSlots", "scheduler.setting.testSlots")}
          {numberField("testMemoryMaxGb", "scheduler.setting.testMemory")}
          {numberField("testCpuPercent", "scheduler.setting.testCpu")}
          {numberField("previewSlots", "scheduler.setting.previewSlots")}
          {numberField("previewMemoryMaxGb", "scheduler.setting.previewMemory")}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t("scheduler.tests.explanation", {
            path: hook?.heavyRunPath ?? "scripts/heavy-run",
            settings: hook?.settingsPath ?? "~/.claude/settings.json",
          })}
        </p>
      </div>
    </div>
  );
}
