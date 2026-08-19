import {
  AlertTriangle,
  Copy,
  GitFork,
  GitMerge,
  HelpCircle,
  RefreshCw,
  Rocket,
  Scissors,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useLanguage } from "../hooks/useLanguage";
import type { TranslationKey } from "../i18n/translations";
import { Modal } from "./Modal";

type OnboardingModalProps = {
  open: boolean;
  onClose: () => void;
};

type Step = {
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
  icon: ReactNode;
};

const STEPS: Step[] = [
  {
    titleKey: "onboarding.step1.title",
    bodyKey: "onboarding.step1.body",
    icon: <Rocket className="h-4 w-4 shrink-0 text-purple-500 dark:text-purple-400" />,
  },
  {
    titleKey: "onboarding.step2.title",
    bodyKey: "onboarding.step2.body",
    icon: <GitFork className="h-4 w-4 shrink-0 text-violet-500 dark:text-violet-400" />,
  },
  {
    titleKey: "onboarding.step3.title",
    bodyKey: "onboarding.step3.body",
    icon: <Copy className="h-4 w-4 shrink-0 text-blue-500 dark:text-blue-400" />,
  },
  {
    titleKey: "onboarding.step4.title",
    bodyKey: "onboarding.step4.body",
    icon: <GitMerge className="h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" />,
  },
  {
    titleKey: "onboarding.step5.title",
    bodyKey: "onboarding.step5.body",
    icon: <Trash2 className="h-4 w-4 shrink-0 text-red-500 dark:text-red-400" />,
  },
  {
    titleKey: "onboarding.step6.title",
    bodyKey: "onboarding.step6.body",
    icon: <RefreshCw className="h-4 w-4 shrink-0 text-green-500 dark:text-green-400" />,
  },
  {
    titleKey: "onboarding.step7.title",
    bodyKey: "onboarding.step7.body",
    icon: <Scissors className="h-4 w-4 shrink-0 text-violet-500 dark:text-violet-400" />,
  },
  {
    titleKey: "onboarding.step8.title",
    bodyKey: "onboarding.step8.body",
    icon: <AlertTriangle className="h-4 w-4 shrink-0 text-orange-500 dark:text-orange-400" />,
  },
];

/**
 * Info-only modal (no onConfirm/onCancel — Modal.tsx only renders a footer when either is passed)
 * explaining the app's full session workflow — starting tasks (with or without a worktree),
 * testing/finishing/cleaning up, and resuming existing sessions. Always mounted with an `open`
 * prop, matching UsageDetailsModal's convention: nothing here is per-open form state worth
 * resetting.
 */
export function OnboardingModal({ open, onClose }: OnboardingModalProps) {
  const { t } = useLanguage();
  return (
    <Modal
      open={open}
      title={t("onboarding.title")}
      onClose={onClose}
      size="lg"
      icon={
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800">
          <HelpCircle className="h-5 w-5 text-stone-600 dark:text-stone-100" />
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-stone-600 dark:text-stone-100">{t("onboarding.intro")}</p>
        <ol className="flex flex-col gap-3">
          {STEPS.map((step) => (
            <li key={step.titleKey} className="flex gap-2 rounded-lg border border-stone-200 p-3 dark:border-stone-800">
              {step.icon}
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
                  {t(step.titleKey)}
                </p>
                <p className="text-sm text-stone-600 dark:text-stone-100">{t(step.bodyKey)}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Modal>
  );
}
