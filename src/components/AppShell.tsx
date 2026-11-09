import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppView, type AppView } from "../hooks/useAppView";
import { useLanguage } from "../hooks/useLanguage";
import { useSessions } from "../hooks/useSessions";
import { ShellContext, type ShellActions } from "../hooks/useShell";
import { useSkillsHubStatus } from "../hooks/useSkillsHubStatus";
import { useTaskSignals } from "../hooks/useTaskSignals";
import { useTheme } from "../hooks/useTheme";
import { useToast } from "../hooks/useToast";
import { useUpdate } from "../hooks/useUpdate";
import { useUsageLimits } from "../hooks/useUsageLimits";
import { BoardPage } from "../pages/BoardPage";
import { GuidePage } from "../pages/GuidePage";
import { SessionsPage } from "../pages/SessionsPage";
import { TaskQueuePage } from "../pages/TaskQueuePage";
import * as preferencesApi from "../services/preferencesApi";
import * as sessionsApi from "../services/sessionsApi";
import * as systemApi from "../services/systemApi";
import { resolveApiErrorMessage, type ApiError } from "../utils/apiClient";
import { sessionGroup } from "../utils/sessionGroups";
import { AppNav } from "./AppNav";
import { AutomationModal } from "./AutomationModal";
import type { AutomationFocus } from "./AutomationModesEditor";
import { CleanupModal } from "./CleanupModal";
import { NewSessionModal } from "./NewSessionModal";
import { NewTaskModal } from "./NewTaskModal";
import { RefinementModal } from "./RefinementModal";
import { SettingsModal } from "./SettingsModal";
import { SetupModal } from "./SetupModal";
import { SkillsHubModal } from "./SkillsHubModal";
import { UpdateOverlay } from "./UpdateOverlay";
import { WelcomeTour } from "./WelcomeTour";
import { hasSeenTour, markTourSeen } from "../utils/tour";

type Panel =
  "newTask" | "newSession" | "refinement" | "cleanup" | "skills" | "settings" | "automation";

/** True while the focus is in a field, where single-key shortcuts must type instead. */
function typingInField(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return (
    element.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName) ||
    element.closest("[role='dialog']") !== null
  );
}

/**
 * The app: navigation on the left (a bottom bar on phones), the current page beside it, and the
 * panels any page can open (new task, new session, refinement, cleanup, skills, settings,
 * automations). Owns the preferences-driven state: initial setup, the Board's
 * beta switch, the terminal layout, auto-update and plan usage.
 */
export function AppShell() {
  // Applies the stored theme on load.
  const { theme, toggleTheme } = useTheme();
  const { t, loaded } = useLanguage();
  const { showToast } = useToast();
  const [view, setView] = useAppView();
  const signals = useTaskSignals();
  const sessions = useSessions(signals.problems);
  const {
    status: updateStatus,
    checking,
    updating,
    applyUpdate,
    autoUpdating,
    autoUpdateError,
    dismissAutoUpdateError,
  } = useUpdate();
  const usage = useUsageLimits();
  // Also keeps the shared cached status warm for the New Task / New Session skills panels.
  const skillsHub = useSkillsHubStatus(true);

  // New task / new session / refinement stay mounted (toggled via `open`) so closing them by
  // accident keeps what was typed; the rest mount only while open.
  const [panel, setPanel] = useState<Panel | null>(null);
  const [automationFocus, setAutomationFocus] = useState<AutomationFocus | undefined>();
  const [automationsOn, setAutomationsOn] = useState(false);
  const [gridLayout, setGridLayout] = useState(false);
  const [resumingOpen, setResumingOpen] = useState(false);
  // Initial setup: asked on every load while any of its fields was never saved (null); "not now"
  // only skips it for this page load. Re-checked whenever preferences change.
  const [setupPrefs, setSetupPrefs] = useState<preferencesApi.UserPreferences | null>(null);
  const [setupSkipped, setSetupSkipped] = useState(false);
  const [tourOpen, setTourOpen] = useState(() => !hasSeenTour());
  const [tourStep, setTourStep] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const check = () => {
      preferencesApi
        .fetchPreferences()
        .then((prefs) => {
          if (cancelled) return;
          setGridLayout(prefs.terminalLayout === "limux-grid");
          setAutomationsOn(prefs.boardAutomations ?? false);
          setSetupPrefs(
            prefs.workspaceDirs == null || prefs.skillsHub?.repoUrl === null
              ? prefs
              : null,
          );
        })
        .catch(() => undefined);
    };
    check();
    window.addEventListener(preferencesApi.PREFERENCES_CHANGED_EVENT, check);
    return () => {
      cancelled = true;
      window.removeEventListener(preferencesApi.PREFERENCES_CHANGED_EVENT, check);
    };
  }, []);

  const { refreshSoon } = sessions;

  const resumeOpen = useCallback(async () => {
    setResumingOpen(true);
    try {
      const { resumed, skippedForLimit, failed } = gridLayout
        ? await systemApi.openTerminalGrid()
        : await sessionsApi.resumeOpenTasks();
      if (resumed.length > 0) {
        showToast(t("useSessions.resumeOpen.done", { count: resumed.length }), "success");
        refreshSoon();
      }
      if (skippedForLimit > 0) {
        showToast(t("useSessions.resumeOpen.limit", { count: skippedForLimit }), "error");
      }
      if (failed.length > 0) {
        const message = failed[0]?.message ?? "";
        showToast(t("useSessions.resumeOpen.failed", { count: failed.length, message }), "error");
      }
      if (resumed.length === 0 && skippedForLimit === 0 && failed.length === 0) {
        showToast(
          t(gridLayout ? "header.grid.nothingToResume" : "useSessions.resumeOpen.none"),
          "success",
        );
      }
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "header.grid.error"), "error");
      // Where its install button is.
      if ((err as ApiError).code === "LIMUX_NOT_INSTALLED") setPanel("settings");
    } finally {
      setResumingOpen(false);
    }
  }, [gridLayout, refreshSoon, showToast, t]);

  const [automationRevision, setAutomationRevision] = useState(0);

  const navigate = useCallback(
    (next: AppView) => {
      setView(next);
    },
    [setView],
  );

  const shell: ShellActions = useMemo(
    () => ({
      view,
      navigate,
      openNewTask: () => setPanel("newTask"),
      openNewSession: () => setPanel("newSession"),
      openRefinement: () => setPanel("refinement"),
      openCleanup: () => setPanel("cleanup"),
      openSkills: () => setPanel("skills"),
      openSettings: () => setPanel("settings"),
      openAutomation: (focus?: AutomationFocus) => {
        setAutomationFocus(focus);
        setPanel("automation");
      },
      automationRevision,
      startTour: () => {
        setTourStep(0);
        setTourOpen(true);
      },
      automationsOn,
      resumeOpen,
      resumingOpen,
      gridLayout,
      sessionsChanged: refreshSoon,
    }),
    [
      view,
      navigate,
      automationRevision,
      automationsOn,
      resumeOpen,
      resumingOpen,
      gridLayout,
      refreshSoon,
    ],
  );

  // N: new task, from anywhere outside a field or a dialog.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (typingInField(event.target) || panel !== null) return;
      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        setPanel("newTask");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [panel]);

  const closePanel = () => {
    if (panel === "automation") setAutomationRevision((revision) => revision + 1);
    setPanel(null);
  };
  const reloadSignals = signals.reload;
  const onQueueChanged = useCallback(() => {
    reloadSignals();
    refreshSoon();
  }, [reloadSignals, refreshSoon]);

  // Never on top of another panel.
  const showSetup = loaded && setupPrefs !== null && !setupSkipped && panel === null;
  // The setup comes first; the tour waits for it.
  const showTour = tourOpen && loaded && !showSetup && panel === null;

  const allSessions = sessions.allSessions;
  const notDoneCount = allSessions.filter((session) => session.status !== "done").length;
  const attentionCount = allSessions.filter(
    (session) => sessionGroup(session, signals.problems) === "attention",
  ).length;

  return (
    <ShellContext.Provider value={shell}>
      <div className="min-h-dvh bg-gray-50 lg:flex dark:bg-gray-950">
        <AppNav
          view={view}
          onNavigate={navigate}
          sessionCount={notDoneCount}
          attentionCount={attentionCount}
          queueCount={signals.pendingQueueCount}
          automationsOn={automationsOn}
          skills={{ status: skillsHub.status, failed: skillsHub.failed }}
          usage={{
            status: usage.status,
            loading: usage.loading,
            error: usage.error,
            refresh: () => void usage.refresh(true),
          }}
          update={{
            status: updateStatus,
            checking,
            updating,
            apply: (force) => void applyUpdate({ force }),
          }}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenCleanup={() => setPanel("cleanup")}
          onOpenRefinement={() => setPanel("refinement")}
          onOpenSkills={() => setPanel("skills")}
          onOpenSettings={() => setPanel("settings")}
        />
        <div className="min-w-0 flex-1 pb-16 lg:pb-0">
          {view === "sessions" && <SessionsPage sessions={sessions} problems={signals.problems} />}
          {view === "board" && <BoardPage />}
          {/* Kept mounted once opened, so unsaved queue edits survive a visit to another page. */}
          <QueueSlot active={view === "queue"} onChanged={onQueueChanged} />
          {view === "guide" && <GuidePage />}
        </div>
      </div>

      <NewTaskModal open={panel === "newTask"} onClose={closePanel} onTaskCreated={refreshSoon} />
      <NewSessionModal
        open={panel === "newSession"}
        onClose={closePanel}
        onSessionCreated={refreshSoon}
      />
      <RefinementModal
        open={panel === "refinement"}
        onClose={closePanel}
        onSessionCreated={() => {
          refreshSoon();
          navigate("sessions");
        }}
      />
      <CleanupModal
        open={panel === "cleanup"}
        onClose={closePanel}
        onFindingExecuted={refreshSoon}
      />
      {panel === "automation" && <AutomationModal focus={automationFocus} onClose={closePanel} />}
      {panel === "skills" && <SkillsHubModal onClose={closePanel} />}
      {panel === "settings" && (
        <SettingsModal theme={theme} onToggleTheme={toggleTheme} onClose={closePanel} />
      )}
      {showSetup && setupPrefs && (
        <SetupModal
          prefs={setupPrefs}
          onSaved={() => setSetupPrefs(null)}
          onSkip={() => setSetupSkipped(true)}
        />
      )}
      {showTour && (
        <WelcomeTour
          index={tourStep}
          onIndexChange={setTourStep}
          onNavigate={navigate}
          onClose={() => {
            markTourSeen();
            setTourOpen(false);
          }}
        />
      )}
      <UpdateOverlay
        updating={autoUpdating}
        error={autoUpdateError}
        onDismissError={dismissAutoUpdateError}
      />
    </ShellContext.Provider>
  );
}

/** Mounts the queue page the first time it's shown and keeps it (hidden) afterwards. */
function QueueSlot({ active, onChanged }: { active: boolean; onChanged: () => void }) {
  const [visited, setVisited] = useState(active);
  if (active && !visited) setVisited(true);
  if (!visited) return null;
  return (
    <div hidden={!active}>
      <TaskQueuePage active={active} onChanged={onChanged} />
    </div>
  );
}
