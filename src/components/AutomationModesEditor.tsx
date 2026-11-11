import { GitPullRequest } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useReviewSkill } from "../hooks/useReviewSkill";
import { SkillPreferenceSelect } from "./SkillPreferenceSelect";
import type { TranslationKey } from "../i18n/translations";
import type { AutomationFeatures } from "../services/boardWatcherApi";
import type { Automation } from "../../shared/boardWatcher";

/** A card of the editor: one automation, or the Teams notices. */
export type AutomationFocus = Automation | "notices";

type ModesEditorProps = {
  features: AutomationFeatures;
  onChange: (input: Partial<AutomationFeatures>) => void;
  /** Why an automation can't be turned on yet (the setup panel: a column or token missing). */
  unavailable?: Partial<Record<Automation | "notices", string>>;
  disabled?: boolean;
  /** The card to scroll to and outline for a moment. */
  focus?: AutomationFocus;
};

type OnOffOption = { on: boolean; label: TranslationKey; selectedClass: string };

const ON_OFF_OPTIONS: OnOffOption[] = [
  {
    on: false,
    label: "automationModes.off",
    selectedClass: "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100",
  },
  {
    on: true,
    label: "automationModes.on",
    selectedClass: "bg-emerald-600 text-white shadow-sm dark:bg-emerald-500 dark:text-gray-950",
  },
];

function OnOffSelector({
  label,
  on,
  disabled,
  onChange,
}: {
  label: string;
  on: boolean;
  disabled: boolean;
  onChange: (on: boolean) => void;
}) {
  const { t } = useLanguage();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex shrink-0 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800"
    >
      {ON_OFF_OPTIONS.map((option) => {
        const selected = option.on === on;
        return (
          <button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.on)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 disabled:cursor-not-allowed disabled:opacity-50 ${
              selected
                ? option.selectedClass
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            {t(option.label)}
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

/** The code review skill the reviews run, chosen right in the card; without it code review
 *  can't be turned on. */
function ReviewSkillField({ reviewSkill }: { reviewSkill: ReturnType<typeof useReviewSkill> }) {
  const { t } = useLanguage();
  const { skillsHub, loaded, ready } = reviewSkill;
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
        {t("taskReviewSkill.title")}
      </span>
      {skillsHub?.installedSkills && (
        <SkillPreferenceSelect
          preference="taskReviewSkill"
          icon={<GitPullRequest className="h-3.5 w-3.5" />}
          label={t("taskReviewSkill.title")}
          skillsHub={skillsHub}
        />
      )}
      {loaded && !ready && (
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
          {t("automationModes.codeReview.skillRequired")}
        </p>
      )}
    </div>
  );
}

/**
 * The automations, one card each, on or off; an automation that is on acts for real, so its card
 * only adds the options that go with it. Used by the Automation modal (saved on each change) and by
 * the setup panel's last step (kept as a draft).
 */
export function AutomationModesEditor({
  features,
  onChange,
  unavailable = {},
  disabled = false,
  focus,
}: ModesEditorProps) {
  const { t } = useLanguage();
  const setFeature = (key: keyof AutomationFeatures, value: boolean) => onChange({ [key]: value });
  const reviewSkill = useReviewSkill();

  const isOn = (automation: Automation) => !unavailable[automation] && features[automation];

  // Code review can always be turned off, but only on with its skill.
  const blocked = (automation: Automation) =>
    automation === "codeReview" && !reviewSkill.ready && !features.codeReview;
  const toggle = (automation: Automation, title: string) => (
    <OnOffSelector
      label={title}
      on={isOn(automation)}
      disabled={disabled || Boolean(unavailable[automation]) || blocked(automation)}
      onChange={(on) => setFeature(automation, on)}
    />
  );

  const review = isOn("codeReview");
  const devQueue = isOn("devQueue");
  const testQueue = isOn("testQueue");
  const rebuild = isOn("rebuild");
  const reviewTitle = t("automationModes.codeReview.title");
  const devTitle = t("automationModes.devQueue.title");
  const testTitle = t("automationModes.testQueue.title");
  const rebuildTitle = t("automationModes.rebuild.title");

  return (
    <div className="flex flex-col gap-3">
      <Card
        title={reviewTitle}
        description={t("automationModes.codeReview.description")}
        control={toggle("codeReview", reviewTitle)}
        unavailable={unavailable.codeReview}
        focused={focus === "codeReview"}
      >
        <ReviewSkillField reviewSkill={reviewSkill} />
        {review && (
          <>
            <Note>{t("automationModes.codeReview.note")}</Note>
            <Option
              checked={features.reviewUnapprovedDeploying}
              disabled={disabled}
              label={t("automationModes.codeReview.unapproved")}
              help={t("automationModes.codeReview.unapproved.help")}
              onChange={(value) => setFeature("reviewUnapprovedDeploying", value)}
            />
          </>
        )}
      </Card>

      <Card
        title={devTitle}
        description={t("automationModes.devQueue.description")}
        control={toggle("devQueue", devTitle)}
        unavailable={unavailable.devQueue}
        focused={focus === "devQueue"}
      >
        {devQueue && <Note>{t("automationModes.devQueue.note")}</Note>}
      </Card>

      <Card
        title={testTitle}
        description={t("automationModes.testQueue.description")}
        control={toggle("testQueue", testTitle)}
        unavailable={unavailable.testQueue}
        focused={focus === "testQueue"}
      >
        {testQueue && <Note>{t("automationModes.testQueue.note")}</Note>}
      </Card>

      <Card
        title={rebuildTitle}
        description={t("automationModes.rebuild.description")}
        control={toggle("rebuild", rebuildTitle)}
        unavailable={unavailable.rebuild}
        focused={focus === "rebuild"}
      >
        {rebuild && <Note>{t("automationModes.rebuild.note")}</Note>}
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
