import { Bot, Globe, Import, Plus, Settings, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useTheme } from "../hooks/useTheme";
import { useUpdate } from "../hooks/useUpdate";
import { useUsageLimits } from "../hooks/useUsageLimits";
import { LANGUAGE_OPTIONS, type Language } from "../i18n/translations";
import { Button } from "./Button";
import { CleanupModal } from "./CleanupModal";
import { ImportSessionModal } from "./ImportSessionModal";
import { NewTaskModal } from "./NewTaskModal";
import { OnboardingModal } from "./OnboardingModal";
import { SettingsModal } from "./SettingsModal";
import { Select } from "./Select";
import { Tooltip } from "./Tooltip";
import { UpdateButton } from "./UpdateButton";
import { UpdateOverlay } from "./UpdateOverlay";
import { UsageLimitsBadge } from "./UsageLimitsBadge";
import { WorkspaceDirsPromptModal } from "./WorkspaceDirsPromptModal";
import * as tasksApi from "../services/tasksApi";

type HeaderProps = {
  /** Fired after a new task is successfully created via the "New Task" modal, so the page's
   *  session list can pick up the newly created session/worktree. */
  onSessionCreated?: () => void;
  /** Fired after any Cleanup modal finding is successfully executed — only `prune-old-sessions`
   *  actually changes the session list, but refreshing unconditionally keeps this as simple as
   *  `onSessionCreated` above. */
  onSessionsChanged?: () => void;
  /** Fired with the new session's id after an exported session file is imported. */
  onSessionImported?: (sessionId: string) => void;
};

export function Header({ onSessionCreated, onSessionsChanged, onSessionImported }: HeaderProps) {
  // Stays up here (not inside SettingsModal, which only mounts while open) — this is what applies
  // the stored theme to <html> on load.
  const { theme, toggleTheme } = useTheme();
  const {
    status: updateStatus,
    checking,
    updating,
    applyUpdate,
    autoUpdating,
    autoUpdateError,
    dismissAutoUpdateError,
  } = useUpdate();
  const {
    status: usageStatus,
    loading: usageLoading,
    error: usageError,
    refresh: refreshUsage,
  } = useUsageLimits();
  const { language, setLanguage, hasSeenOnboarding, markOnboardingSeen, loaded, t } = useLanguage();
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // `workspaceDirs` never saved (null) → ask on every start until it is; "not now" only skips it
  // for this page load. Re-checked whenever the settings modal saves something.
  const [needsWorkspaceDirs, setNeedsWorkspaceDirs] = useState(false);
  const [workspacePromptSkipped, setWorkspacePromptSkipped] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = () => {
      tasksApi
        .fetchPreferences()
        .then((prefs) => {
          if (!cancelled) setNeedsWorkspaceDirs(prefs.workspaceDirs == null);
        })
        .catch(() => undefined);
    };
    check();
    window.addEventListener(tasksApi.PREFERENCES_CHANGED_EVENT, check);
    return () => {
      cancelled = true;
      window.removeEventListener(tasksApi.PREFERENCES_CHANGED_EVENT, check);
    };
  }, []);

  // After onboarding (a first-time user sees that first, then this) and never on top of another
  // header modal. `hasSeenOnboarding` turns true the moment onboarding opens (see below), and
  // `showOnboarding` holds it back until onboarding is closed.
  const showWorkspacePrompt =
    loaded &&
    hasSeenOnboarding &&
    needsWorkspaceDirs &&
    !workspacePromptSkipped &&
    !showOnboarding &&
    !showSettings &&
    !showNewTaskModal;

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
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-center gap-3 sm:justify-start">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-900 dark:bg-gray-700">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="font-semibold text-gray-900 dark:text-gray-100 sm:text-lg">
              Claude CLI Local Session Manager
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t("header.subtitle")}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={() => setShowNewTaskModal(true)} icon={<Plus className="h-4 w-4" />}>
            {t("header.newTask")}
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowImportModal(true)}
            icon={<Import className="h-4 w-4 text-teal-600 dark:text-teal-400" />}
          >
            {t("header.importSession")}
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowCleanupModal(true)}
            icon={<Sparkles className="h-4 w-4" />}
          >
            {t("header.cleanup")}
          </Button>
          <Select
            icon={<Globe className="h-3.5 w-3.5" />}
            value={language}
            onChange={(event) => setLanguage(event.target.value as Language)}
            aria-label={t("header.language")}
            className="w-auto"
          >
            {/* Short codes keep the header narrow; the full name shows on hover. */}
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.code} value={option.code} title={option.label}>
                {option.code.toUpperCase()}
              </option>
            ))}
          </Select>
          <UsageLimitsBadge
            status={usageStatus}
            loading={usageLoading}
            error={usageError}
            onRefresh={() => refreshUsage(true)}
          />
          <Tooltip content={t("header.settings")}>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowSettings(true)}
              aria-label={t("header.settings")}
              icon={<Settings className="h-4 w-4" />}
            />
          </Tooltip>
          <UpdateButton
            status={updateStatus}
            checking={checking}
            updating={updating}
            onUpdate={() => {
              void applyUpdate();
            }}
          />
        </div>
      </div>

      <NewTaskModal
        open={showNewTaskModal}
        onClose={() => setShowNewTaskModal(false)}
        onTaskCreated={onSessionCreated}
      />
      <CleanupModal
        open={showCleanupModal}
        onClose={() => setShowCleanupModal(false)}
        onFindingExecuted={onSessionsChanged}
      />
      {showImportModal && (
        <ImportSessionModal
          onClose={() => setShowImportModal(false)}
          onImported={(sessionId) => onSessionImported?.(sessionId)}
        />
      )}
      <OnboardingModal open={showOnboarding} onClose={() => setShowOnboarding(false)} />
      {showSettings && (
        <SettingsModal
          theme={theme}
          onToggleTheme={toggleTheme}
          onClose={() => setShowSettings(false)}
          onShowOnboarding={() => {
            setShowSettings(false);
            setShowOnboarding(true);
          }}
        />
      )}
      {showWorkspacePrompt && (
        <WorkspaceDirsPromptModal
          onSaved={() => setNeedsWorkspaceDirs(false)}
          onSkip={() => setWorkspacePromptSkipped(true)}
        />
      )}
      <UpdateOverlay
        updating={autoUpdating}
        error={autoUpdateError}
        onDismissError={dismissAutoUpdateError}
      />
    </header>
  );
}
