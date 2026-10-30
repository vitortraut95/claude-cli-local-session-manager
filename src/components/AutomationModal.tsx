import { useEffect, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useToast } from "../hooks/useToast";
import type { TranslationKey } from "../i18n/translations";
import * as boardWatcherApi from "../services/boardWatcherApi";
import type {
  AutomationFeatures,
  AutomationLimits,
  AutomationSettings,
  AutomationSettingsInput,
} from "../services/boardWatcherApi";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { HHMM_PATTERN, LIMIT_BOUNDS } from "../utils/boardWatcher";
import { Input } from "./Input";
import { Modal } from "./Modal";
import { SettingRow } from "./SettingRow";

type FeatureRow = {
  key: keyof AutomationFeatures;
  label: TranslationKey;
  description: TranslationKey;
};

const FEATURE_ROWS: FeatureRow[] = [
  {
    key: "devQueue",
    label: "automation.feature.devQueue",
    description: "automation.feature.devQueue.description",
  },
  {
    key: "codeReview",
    label: "automation.feature.codeReview",
    description: "automation.feature.codeReview.description",
  },
  {
    key: "reviewSessions",
    label: "automation.feature.reviewSessions",
    description: "automation.feature.reviewSessions.description",
  },
  {
    key: "testQueue",
    label: "automation.feature.testQueue",
    description: "automation.feature.testQueue.description",
  },
  {
    key: "instantNotices",
    label: "automation.feature.instantNotices",
    description: "automation.feature.instantNotices.description",
  },
  {
    key: "digest",
    label: "automation.feature.digest",
    description: "automation.feature.digest.description",
  },
];

const LIMIT_LABELS: Record<keyof AutomationLimits, TranslationKey> = {
  approveDelayHours: "automation.limit.approveDelayHours",
  waitTestGraceMinutes: "automation.limit.waitTestGraceMinutes",
  maxClaimedTests: "automation.limit.maxClaimedTests",
  maxClaimsPerDay: "automation.limit.maxClaimsPerDay",
  maxApprovesPerDay: "automation.limit.maxApprovesPerDay",
  maxCommentsPerPr: "automation.limit.maxCommentsPerPr",
  maxReviewRounds: "automation.limit.maxReviewRounds",
  descriptionMinScore: "automation.limit.descriptionMinScore",
};

const LIMIT_DESCRIPTIONS: Record<keyof AutomationLimits, TranslationKey> = {
  approveDelayHours: "automation.limit.approveDelayHours.description",
  waitTestGraceMinutes: "automation.limit.waitTestGraceMinutes.description",
  maxClaimedTests: "automation.limit.maxClaimedTests.description",
  maxClaimsPerDay: "automation.limit.maxClaimsPerDay.description",
  maxApprovesPerDay: "automation.limit.maxApprovesPerDay.description",
  maxCommentsPerPr: "automation.limit.maxCommentsPerPr.description",
  maxReviewRounds: "automation.limit.maxReviewRounds.description",
  descriptionMinScore: "automation.limit.descriptionMinScore.description",
};

/** Monday first; the values are the server's weekday numbers (0 = Sunday). */
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** The server's answer to a partial update, applied to the shown settings before it arrives. */
function applyInput(
  current: AutomationSettings,
  input: AutomationSettingsInput,
): AutomationSettings {
  return {
    ...current,
    enabled: input.enabled ?? current.enabled,
    features: { ...current.features, ...input.features },
    limits: { ...current.limits, ...input.limits },
    businessHours: { ...current.businessHours, ...input.businessHours },
  };
}

type SwitchProps = {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
};

function Switch({ checked, disabled = false, label, onChange }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/30 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-gray-100/30 ${
        checked ? "bg-gray-900 dark:bg-gray-100" : "bg-gray-300 dark:bg-gray-700"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform dark:bg-gray-900 ${
          checked ? "translate-x-[1.125rem]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

type AutomationModalProps = {
  onClose: () => void;
};

/** The automation switches, limits and business hours. Every change is saved right away. */
export function AutomationModal({ onClose }: AutomationModalProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Typed text per number/time field, committed on blur (or Enter) like SchedulerPanel.
  const [drafts, setDrafts] = useState<
    Partial<Record<keyof AutomationLimits | "start" | "end", string>>
  >({});

  useEffect(() => {
    let cancelled = false;
    boardWatcherApi
      .fetchAutomationSettings()
      .then((result) => {
        if (!cancelled) setSettings(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(resolveApiErrorMessage(err, t, "automation.loadError"));
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const save = async (input: AutomationSettingsInput) => {
    if (!settings) return;
    const previous = settings;
    setSettings(applyInput(previous, input));
    try {
      setSettings(await boardWatcherApi.saveAutomationSettings(input));
    } catch (err) {
      setSettings(previous);
      showToast(resolveApiErrorMessage(err, t, "automation.saveError"), "error");
    }
  };

  const commitLimit = (field: keyof AutomationLimits) => {
    if (!settings) return;
    const raw = drafts[field];
    setDrafts((current) => ({ ...current, [field]: undefined }));
    if (raw === undefined || raw.trim() === "") return;
    const parsed = Math.round(Number(raw));
    if (!Number.isFinite(parsed)) return;
    const [min, max] = LIMIT_BOUNDS[field];
    const value = Math.min(max, Math.max(min, parsed));
    if (value !== settings.limits[field]) void save({ limits: { [field]: value } });
  };

  const commitHour = (field: "start" | "end") => {
    if (!settings) return;
    const raw = drafts[field];
    setDrafts((current) => ({ ...current, [field]: undefined }));
    if (raw === undefined || raw === settings.businessHours[field]) return;
    if (!HHMM_PATTERN.test(raw)) {
      showToast(t("automation.hours.invalid"), "error");
      return;
    }
    void save({ businessHours: { [field]: raw } });
  };

  const toggleDay = (day: number) => {
    if (!settings) return;
    const current = settings.businessHours.days;
    const days = current.includes(day)
      ? current.filter((value) => value !== day)
      : [...current, day].sort((a, b) => a - b);
    void save({ businessHours: { days } });
  };

  const features = settings?.features;
  const codeReviewOn = features?.codeReview ?? false;

  return (
    <Modal open title={t("automation.title")} onClose={onClose} size="lg">
      {loadError && <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>}
      {!loadError && !settings && <p className="text-sm text-gray-500 dark:text-gray-400">…</p>}
      {settings && (
        <div className="flex flex-col gap-6">
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
            {t("automation.simulation")}
          </p>

          {!settings.configured ? (
            <p className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-400">
              {t("automation.notConfigured")}
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {t("automation.enabled")}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t("automation.enabled.description")}
                  </p>
                </div>
                <Switch
                  checked={settings.enabled}
                  label={t("automation.enabled")}
                  onChange={(enabled) => void save({ enabled })}
                />
              </div>

              <section className="flex flex-col gap-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {t("automation.features")}
                </h3>
                {FEATURE_ROWS.map((row) => {
                  const nested = row.key === "reviewSessions";
                  const disabled = nested && !codeReviewOn;
                  return (
                    <div
                      key={row.key}
                      className={
                        nested ? "ml-6 border-l border-gray-200 pl-4 dark:border-gray-800" : ""
                      }
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm text-gray-900 dark:text-gray-100">{t(row.label)}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {t(row.description)}
                          </p>
                          {disabled && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {t("automation.feature.reviewSessions.needsReview")}
                            </p>
                          )}
                        </div>
                        <Switch
                          checked={features?.[row.key] ?? false}
                          disabled={disabled}
                          label={t(row.label)}
                          onChange={(value) => void save({ features: { [row.key]: value } })}
                        />
                      </div>
                    </div>
                  );
                })}
              </section>

              <section className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {t("automation.limits")}
                </h3>
                {(Object.keys(LIMIT_BOUNDS) as (keyof AutomationLimits)[]).map((field) => (
                  <SettingRow
                    key={field}
                    label={t(LIMIT_LABELS[field])}
                    description={t(LIMIT_DESCRIPTIONS[field])}
                    controlWidth="w-24"
                    control={
                      <Input
                        type="number"
                        min={LIMIT_BOUNDS[field][0]}
                        max={LIMIT_BOUNDS[field][1]}
                        value={drafts[field] ?? String(settings.limits[field])}
                        aria-label={t(LIMIT_LABELS[field])}
                        onChange={(event) =>
                          setDrafts((current) => ({ ...current, [field]: event.target.value }))
                        }
                        onBlur={() => commitLimit(field)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") commitLimit(field);
                        }}
                        className="py-1"
                      />
                    }
                  />
                ))}
              </section>

              <section className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {t("automation.hours")}
                </h3>
                <div className="flex flex-wrap gap-4">
                  <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
                    {t("automation.hours.start")}
                    <Input
                      type="time"
                      value={drafts.start ?? settings.businessHours.start}
                      onChange={(event) =>
                        setDrafts((current) => ({ ...current, start: event.target.value }))
                      }
                      onBlur={() => commitHour("start")}
                      className="w-28 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
                    {t("automation.hours.end")}
                    <Input
                      type="time"
                      value={drafts.end ?? settings.businessHours.end}
                      onChange={(event) =>
                        setDrafts((current) => ({ ...current, end: event.target.value }))
                      }
                      onBlur={() => commitHour("end")}
                      className="w-28 py-1"
                    />
                  </label>
                </div>
                <fieldset className="flex flex-col gap-2">
                  <legend className="text-xs text-gray-500 dark:text-gray-400">
                    {t("automation.hours.days")}
                  </legend>
                  <div className="flex flex-wrap gap-3">
                    {WEEKDAY_ORDER.map((day) => (
                      <label
                        key={day}
                        className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300"
                      >
                        <input
                          type="checkbox"
                          checked={settings.businessHours.days.includes(day)}
                          onChange={() => toggleDay(day)}
                          className="h-4 w-4 accent-gray-900 dark:accent-gray-100"
                        />
                        {t(`automation.weekday.${day}` as TranslationKey)}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t("automation.hours.timezone", { timezone: settings.businessHours.timezone })}
                </p>
              </section>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
