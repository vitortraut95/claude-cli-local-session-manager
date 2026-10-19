import {
  AlertTriangle,
  Bot,
  FlaskConical,
  Globe,
  Import,
  MessageSquarePlus,
  Plus,
  Settings,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useSkillsHubStatus } from "../hooks/useSkillsHubStatus";
import { useTheme } from "../hooks/useTheme";
import { useUpdate } from "../hooks/useUpdate";
import { useUsageLimits } from "../hooks/useUsageLimits";
import { LANGUAGE_OPTIONS, type Language } from "../i18n/translations";
import { Button } from "./Button";
import { CleanupModal } from "./CleanupModal";
import { ImportSessionModal } from "./ImportSessionModal";
import { NewSessionModal } from "./NewSessionModal";
import { NewTaskModal } from "./NewTaskModal";
import { SettingsModal } from "./SettingsModal";
import { TestTaskModal } from "./TestTaskModal";
import { SkillsHeaderButton } from "./SkillsHeaderButton";
import { SkillsHubModal } from "./SkillsHubModal";
import { Select } from "./Select";
import { Tooltip } from "./Tooltip";
import { UpdateButton } from "./UpdateButton";
import { UpdateOverlay } from "./UpdateOverlay";
import { UsageLimitsBadge } from "./UsageLimitsBadge";
import { TeamIntegrationsPromptModal } from "./TeamIntegrationsPromptModal";
import { WorkspaceDirsPromptModal } from "./WorkspaceDirsPromptModal";
import * as tasksApi from "../services/tasksApi";

type HeaderProps = {
  /** Fired after a new task/session is created, so the session list can refresh. */
  onSessionCreated?: () => void;
  /** Fired after any Cleanup modal finding is successfully executed. */
  onSessionsChanged?: () => void;
  /** Fired with the new session's id after an exported session file is imported. */
  onSessionImported?: (sessionId: string) => void;
};

export function Header({ onSessionCreated, onSessionsChanged, onSessionImported }: HeaderProps) {
  // Must stay here (SettingsModal only mounts while open): this applies the stored theme on load.
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
  const { language, setLanguage, loaded, t } = useLanguage();
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSkillsModal, setShowSkillsModal] = useState(false);
  const [showTestTaskModal, setShowTestTaskModal] = useState(false);
  // `taskTestSkill` ("" = "Test task" button hidden) and where its terminal opens (display only —
  // the server picks the first workspace dir that exists, else the home dir).
  const [taskTestSkill, setTaskTestSkill] = useState("");
  const [testTaskFolderHint, setTestTaskFolderHint] = useState("~");
  // Also keeps the shared cached status warm for the New Task / New Session skills panels.
  const { status: skillsHub, failed: skillsHubFailed } = useSkillsHubStatus(true);
  // `workspaceDirs` never saved (null) → ask on every start until it is; "not now" only skips it
  // for this page load. Re-checked whenever the settings modal saves something.
  const [needsWorkspaceDirs, setNeedsWorkspaceDirs] = useState(false);
  const [workspacePromptSkipped, setWorkspacePromptSkipped] = useState(false);
  // Team integrations (Jenkins URL, skills hub repo): asked while either is null (never saved;
  // `undefined` = backend without the field). Holds the prefs for the prompt's prefill.
  const [teamPromptPrefs, setTeamPromptPrefs] = useState<tasksApi.UserPreferences | null>(null);
  const [teamPromptSkipped, setTeamPromptSkipped] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = () => {
      tasksApi
        .fetchPreferences()
        .then((prefs) => {
          if (cancelled) return;
          setNeedsWorkspaceDirs(prefs.workspaceDirs == null);
          setTaskTestSkill(prefs.taskTestSkill?.trim() ?? "");
          setTestTaskFolderHint(prefs.workspaceDirs?.[0] ?? "~");
          setTeamPromptPrefs(
            prefs.jenkinsBaseUrl === null || prefs.skillsHub?.repoUrl === null ? prefs : null,
          );
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

  // Never on top of another header modal.
  const showWorkspacePrompt =
    loaded &&
    needsWorkspaceDirs &&
    !workspacePromptSkipped &&
    !showSettings &&
    !showNewTaskModal &&
    !showNewSessionModal &&
    !showTestTaskModal &&
    !showSkillsModal;
  // Only after the workspace prompt is out of the way (saved or skipped) — never both at once.
  const showTeamPrompt =
    teamPromptPrefs !== null &&
    !teamPromptSkipped &&
    loaded &&
    !showWorkspacePrompt &&
    (!needsWorkspaceDirs || workspacePromptSkipped) &&
    !showSettings &&
    !showNewTaskModal &&
    !showNewSessionModal &&
    !showTestTaskModal &&
    !showSkillsModal;

  // Only known once the skills status loaded (and on a backend that sends the list).
  const testSkillMissing =
    taskTestSkill !== "" &&
    skillsHub?.installedSkills !== undefined &&
    !skillsHub.installedSkills.some((skill) => skill.name === taskTestSkill);

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
          <SkillsHeaderButton
            status={skillsHub}
            failed={skillsHubFailed}
            onClick={() => setShowSkillsModal(true)}
          />
          <Button onClick={() => setShowNewTaskModal(true)} icon={<Plus className="h-4 w-4" />}>
            {t("header.newTask")}
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowNewSessionModal(true)}
            icon={<MessageSquarePlus className="h-4 w-4" />}
          >
            {t("header.newSession")}
          </Button>
          {taskTestSkill !== "" && (
            <Tooltip
              content={
                testSkillMissing
                  ? t("header.testTask.notInstalled", { skill: taskTestSkill })
                  : t("header.testTask.tooltip", { skill: taskTestSkill })
              }
            >
              {testSkillMissing ? (
                <Button
                  variant="unstyled"
                  className="gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/70"
                  onClick={() => setShowSkillsModal(true)}
                  icon={<AlertTriangle className="h-4 w-4" />}
                >
                  {t("header.testTask")}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setShowTestTaskModal(true)}
                  icon={<FlaskConical className="h-4 w-4 text-teal-600 dark:text-teal-400" />}
                >
                  {t("header.testTask")}
                </Button>
              )}
            </Tooltip>
          )}
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
      <NewSessionModal
        open={showNewSessionModal}
        onClose={() => setShowNewSessionModal(false)}
        onSessionCreated={onSessionCreated}
      />
      {showTestTaskModal && taskTestSkill !== "" && (
        <TestTaskModal
          skill={taskTestSkill}
          folderHint={testTaskFolderHint}
          onClose={() => setShowTestTaskModal(false)}
          onSessionCreated={onSessionCreated}
        />
      )}
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
      {showSkillsModal && <SkillsHubModal onClose={() => setShowSkillsModal(false)} />}
      {showSettings && (
        <SettingsModal
          theme={theme}
          onToggleTheme={toggleTheme}
          onClose={() => setShowSettings(false)}
        />
      )}
      {showWorkspacePrompt && (
        <WorkspaceDirsPromptModal
          onSaved={() => setNeedsWorkspaceDirs(false)}
          onSkip={() => setWorkspacePromptSkipped(true)}
        />
      )}
      {showTeamPrompt && teamPromptPrefs && (
        <TeamIntegrationsPromptModal
          prefs={teamPromptPrefs}
          onSaved={() => setTeamPromptPrefs(null)}
          onSkip={() => setTeamPromptSkipped(true)}
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
