import { Bot, Globe, HelpCircle, Plus, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useTheme } from "../hooks/useTheme";
import { useUpdate } from "../hooks/useUpdate";
import { useUsageLimits } from "../hooks/useUsageLimits";
import { LANGUAGE_OPTIONS, type Language } from "../i18n/translations";
import { Button } from "./Button";
import { CleanupModal } from "./CleanupModal";
import { NewTaskModal } from "./NewTaskModal";
import { OnboardingModal } from "./OnboardingModal";
import { Select } from "./Select";
import { ThemeToggle } from "./ThemeToggle";
import { Tooltip } from "./Tooltip";
import { UpdateButton } from "./UpdateButton";
import { UsageLimitsBadge } from "./UsageLimitsBadge";

type HeaderProps = {
  /** Fired after a new task is successfully created via the "New Task" modal, so the page's
   *  session list can pick up the newly created session/worktree. */
  onSessionCreated?: () => void;
};

export function Header({ onSessionCreated }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { status: updateStatus, checking, updating, applyUpdate } = useUpdate();
  const {
    status: usageStatus,
    loading: usageLoading,
    error: usageError,
    refresh: refreshUsage,
  } = useUsageLimits();
  const { language, setLanguage, hasSeenOnboarding, markOnboardingSeen, loaded, t } = useLanguage();
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Opens once per install/machine — gated on `loaded` so this can't fire before the real
  // preferences value comes back (which would otherwise flash it open for returning users too).
  // `showOnboarding` has to be its own state (not derived straight from `hasSeenOnboarding`) so
  // the modal stays open once shown, rather than snapping shut the instant markOnboardingSeen's
  // own state update flips `hasSeenOnboarding` back to true.
  useEffect(() => {
    if (loaded && !hasSeenOnboarding) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowOnboarding(true);
      markOnboardingSeen();
    }
  }, [loaded, hasSeenOnboarding, markOnboardingSeen]);

  return (
    <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-row sm:flex-col sm:justify-center gap-3 p-4">
        <div className="flex items-center justify-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-900 dark:bg-gray-700">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 sm:text-lg">
              Claude CLI Local Session Manager (worktree based)
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t("header.subtitle")}</p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Button onClick={() => setShowNewTaskModal(true)} icon={<Plus className="h-4 w-4" />}>
            {t("header.newTask")}
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowCleanupModal(true)}
            icon={<Sparkles className="h-4 w-4" />}
          >
            {t("header.cleanup")}
          </Button>
          <Tooltip content={t("header.help")}>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowOnboarding(true)}
              aria-label={t("header.help")}
              icon={<HelpCircle className="h-4 w-4" />}
            />
          </Tooltip>
          <Select
            icon={<Globe className="h-3.5 w-3.5" />}
            value={language}
            onChange={(event) => setLanguage(event.target.value as Language)}
            aria-label={t("header.language")}
            className="w-auto"
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </Select>
          <UsageLimitsBadge
            status={usageStatus}
            loading={usageLoading}
            error={usageError}
            onRefresh={() => refreshUsage(true)}
          />
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <UpdateButton
            status={updateStatus}
            checking={checking}
            updating={updating}
            onUpdate={applyUpdate}
          />
        </div>
      </div>

      <NewTaskModal
        open={showNewTaskModal}
        onClose={() => setShowNewTaskModal(false)}
        onTaskCreated={onSessionCreated}
      />
      <CleanupModal open={showCleanupModal} onClose={() => setShowCleanupModal(false)} />
      <OnboardingModal open={showOnboarding} onClose={() => setShowOnboarding(false)} />
    </header>
  );
}
