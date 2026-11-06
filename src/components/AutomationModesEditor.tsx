import { useEffect, useRef, type ReactNode } from "react";
import { useLanguage } from "../hooks/useLanguage";
import type { TranslationKey } from "../i18n/translations";
import type { AutomationFeatures, AutomationLive } from "../services/boardWatcherApi";
import {
  modeOf,
  switchesForMode,
  type AutomationMode,
  type ModeAutomation,
  type Switches,
  type SwitchesInput,
} from "../../shared/automationModes";

const MODES: AutomationMode[] = ["off", "simulate", "live"];

const MODE_LABELS: Record<AutomationMode, TranslationKey> = {
  off: "automationModes.mode.off",
  simulate: "automationModes.mode.simulate",
  live: "automationModes.mode.live",
};

const MODE_ON_CLASSES: Record<AutomationMode, string> = {
  off: "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100",
  simulate: "bg-violet-600 text-white shadow-sm dark:bg-violet-500",
  live: "bg-emerald-600 text-white shadow-sm dark:bg-emerald-500 dark:text-gray-950",
};

/** A card of the editor: one automation, or the Teams notices. */
export type AutomationFocus = ModeAutomation | "notices";

type ModesEditorProps = {
  switches: Switches;
  onChange: (input: SwitchesInput) => void;
  /** Why an automation can't be turned on yet (the setup panel: a column or token missing). */
  unavailable?: Partial<Record<ModeAutomation | "notices", string>>;
  disabled?: boolean;
  /** The card to scroll to and outline for a moment. */
  focus?: AutomationFocus;
};

function ModeSelector({
  label,
  mode,
  disabled,
  onChange,
}: {
  label: string;
  mode: AutomationMode;
  disabled: boolean;
  onChange: (mode: AutomationMode) => void;
}) {
  const { t } = useLanguage();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex shrink-0 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800"
    >
      {MODES.map((option) => {
        const on = option === mode;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(option)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 disabled:cursor-not-allowed disabled:opacity-50 ${
              on
                ? MODE_ON_CLASSES[option]
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            {t(MODE_LABELS[option])}
          </button>
        );
      })}
    </div>
  );
}

function Option({
  checked,
  label,
  help,
  disabled,
  onChange,
}: {
  checked: boolean;
  label: string;
  help?: string;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`flex items-start gap-2 ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 accent-violet-600 dark:border-gray-600"
      />
      <span className="min-w-0">
        <span className="block text-sm text-gray-800 dark:text-gray-200">{label}</span>
        {help && <span className="block text-xs text-gray-500 dark:text-gray-400">{help}</span>}
      </span>
    </label>
  );
}

function Card({
  title,
  description,
  control,
  unavailable,
  focused = false,
  children,
}: {
  title: string;
  description: string;
  control: ReactNode;
  unavailable?: string;
  focused?: boolean;
  children?: ReactNode;
}) {
  const { t } = useLanguage();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focused]);
  return (
    <section
      ref={ref}
      className={`rounded-lg border border-gray-200 p-4 dark:border-gray-800 ${focused ? "automation-focus" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
          {unavailable && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
              {t("automationModes.unavailable", { reason: unavailable })}
            </p>
          )}
        </div>
        {control}
      </div>
      {children && (
        <div className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
          {children}
        </div>
      )}
    </section>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="text-xs text-gray-600 dark:text-gray-400">{children}</p>;
}

/**
 * The automations, one card each with a single mode (off, simulation, for real); the real actions
 * that belong to an automation are options inside its card. Used by the Automation modal (saved
 * on each change) and by the setup panel's last step (kept as a draft).
 */
export function AutomationModesEditor({
  switches,
  onChange,
  unavailable = {},
  disabled = false,
  focus,
}: ModesEditorProps) {
  const { t } = useLanguage();
  const { features, live } = switches;
  const setFeature = (key: keyof AutomationFeatures, value: boolean) =>
    onChange({ features: { [key]: value }, live: {} });
  const setLive = (key: keyof AutomationLive, value: boolean) =>
    onChange({ features: {}, live: { [key]: value } });

  const selector = (automation: ModeAutomation, title: string) => (
    <ModeSelector
      label={title}
      mode={unavailable[automation] ? "off" : modeOf(automation, switches)}
      disabled={disabled || Boolean(unavailable[automation])}
      onChange={(mode) => onChange(switchesForMode(automation, mode))}
    />
  );

  const review = unavailable.codeReview ? "off" : modeOf("codeReview", switches);
  const devQueue = unavailable.devQueue ? "off" : modeOf("devQueue", switches);
  const testQueue = unavailable.testQueue ? "off" : modeOf("testQueue", switches);
  const rebuild = unavailable.rebuild ? "off" : modeOf("rebuild", switches);
  const reviewTitle = t("automationModes.codeReview.title");
  const devTitle = t("automationModes.devQueue.title");
  const testTitle = t("automationModes.testQueue.title");
  const rebuildTitle = t("automationModes.rebuild.title");

  return (
    <div className="flex flex-col gap-3">
      <Card
        title={reviewTitle}
        description={t("automationModes.codeReview.description")}
        control={selector("codeReview", reviewTitle)}
        unavailable={unavailable.codeReview}
        focused={focus === "codeReview"}
      >
        {review === "simulate" && (
          <>
            <Note>{t("automationModes.simulate.note")}</Note>
            <Option
              checked={features.reviewSessions}
              disabled={disabled}
              label={t("automationModes.codeReview.sessions")}
              help={t("automationModes.codeReview.sessions.help")}
              onChange={(value) => setFeature("reviewSessions", value)}
            />
          </>
        )}
        {review === "live" && (
          <>
            <Option
              checked={live.comments}
              disabled={disabled}
              label={t("automationModes.codeReview.comments")}
              help={t("automationModes.codeReview.comments.help")}
              onChange={(value) => setLive("comments", value)}
            />
            <Option
              checked={live.approve}
              disabled={disabled}
              label={t("automationModes.codeReview.approve")}
              help={t("automationModes.codeReview.approve.help")}
              onChange={(value) => setLive("approve", value)}
            />
          </>
        )}
        {review !== "off" && (
          <Option
            checked={features.reviewUnapprovedDeploying}
            disabled={disabled}
            label={t("automationModes.codeReview.unapproved")}
            help={t("automationModes.codeReview.unapproved.help")}
            onChange={(value) => setFeature("reviewUnapprovedDeploying", value)}
          />
        )}
      </Card>

      <Card
        title={devTitle}
        description={t("automationModes.devQueue.description")}
        control={selector("devQueue", devTitle)}
        unavailable={unavailable.devQueue}
        focused={focus === "devQueue"}
      >
        {devQueue === "simulate" && <Note>{t("automationModes.simulate.note")}</Note>}
        {devQueue === "live" && (
          <>
            <Note>{t("automationModes.devQueue.live.note")}</Note>
            <Option
              checked={live.startProgress}
              disabled={disabled}
              label={t("automationModes.devQueue.startProgress")}
              help={t("automationModes.devQueue.startProgress.help")}
              onChange={(value) => setLive("startProgress", value)}
            />
          </>
        )}
      </Card>

      <Card
        title={testTitle}
        description={t("automationModes.testQueue.description")}
        control={selector("testQueue", testTitle)}
        unavailable={unavailable.testQueue}
        focused={focus === "testQueue"}
      >
        {testQueue === "simulate" && <Note>{t("automationModes.simulate.note")}</Note>}
        {testQueue === "live" && <Note>{t("automationModes.testQueue.live.note")}</Note>}
      </Card>

      <Card
        title={rebuildTitle}
        description={t("automationModes.rebuild.description")}
        control={selector("rebuild", rebuildTitle)}
        unavailable={unavailable.rebuild}
        focused={focus === "rebuild"}
      >
        {rebuild === "simulate" && <Note>{t("automationModes.simulate.note")}</Note>}
        {rebuild === "live" && <Note>{t("automationModes.rebuild.live.note")}</Note>}
      </Card>

      <Card
        title={t("automationModes.notices.title")}
        description={t("automationModes.notices.description")}
        control={null}
        unavailable={unavailable.notices}
        focused={focus === "notices"}
      >
        <Option
          checked={!unavailable.notices && features.instantNotices}
          disabled={disabled || Boolean(unavailable.notices)}
          label={t("automationModes.notices.instant")}
          help={t("automationModes.notices.instant.help")}
          onChange={(value) => setFeature("instantNotices", value)}
        />
        <Option
          checked={!unavailable.notices && features.digest}
          disabled={disabled || Boolean(unavailable.notices)}
          label={t("automationModes.notices.digest")}
          onChange={(value) => setFeature("digest", value)}
        />
      </Card>
    </div>
  );
}
