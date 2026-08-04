import { AlertTriangle, Copy, GitFork, GitMerge, HelpCircle, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { t, type Language, type TranslationKey } from "../i18n/translations";
import { Modal } from "./Modal";

type OnboardingModalProps = {
  open: boolean;
  onClose: () => void;
  language: Language;
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
    icon: <GitFork className="h-4 w-4 shrink-0 text-violet-500 dark:text-violet-400" />,
  },
  {
    titleKey: "onboarding.step2.title",
    bodyKey: "onboarding.step2.body",
    icon: <Copy className="h-4 w-4 shrink-0 text-blue-500 dark:text-blue-400" />,
  },
  {
    titleKey: "onboarding.step3.title",
    bodyKey: "onboarding.step3.body",
    icon: <GitMerge className="h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" />,
  },
  {
    titleKey: "onboarding.step4.title",
    bodyKey: "onboarding.step4.body",
    icon: <Trash2 className="h-4 w-4 shrink-0 text-red-500 dark:text-red-400" />,
  },
  {
    titleKey: "onboarding.step5.title",
    bodyKey: "onboarding.step5.body",
    icon: <AlertTriangle className="h-4 w-4 shrink-0 text-orange-500 dark:text-orange-400" />,
  },
];

/**
 * Info-only modal (no onConfirm/onCancel — Modal.tsx only renders a footer when either is passed)
 * explaining the worktree-based dev workflow. Always mounted with an `open` prop, matching
 * UsageDetailsModal's convention: nothing here is per-open form state worth resetting.
 */
export function OnboardingModal({ open, onClose, language }: OnboardingModalProps) {
  return (
    <Modal
      open={open}
      title={t(language, "onboarding.title")}
      onClose={onClose}
      size="lg"
      icon={
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
          <HelpCircle className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">{t(language, "onboarding.intro")}</p>
        <ol className="flex flex-col gap-3">
          {STEPS.map((step) => (
            <li key={step.titleKey} className="flex gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-800">
              {step.icon}
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {t(language, step.titleKey)}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{t(language, step.bodyKey)}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Modal>
  );
}
