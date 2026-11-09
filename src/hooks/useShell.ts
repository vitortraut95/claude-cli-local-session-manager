import { createContext, useContext } from "react";
import type { AutomationFocus } from "../components/AutomationModesEditor";
import type { AppView } from "./useAppView";

/** What any page can ask of the app shell: move between pages and open the shared panels. */
export type ShellActions = {
  view: AppView;
  navigate: (view: AppView) => void;
  openNewTask: () => void;
  openNewSession: () => void;
  openRefinement: () => void;
  openCleanup: () => void;
  openSkills: () => void;
  openSettings: () => void;
  /** The automations' modes, hours and limits, with one automation's card highlighted. */
  openAutomation: (focus?: AutomationFocus) => void;
  /** Goes up each time the automation panel closes, so pages showing its settings re-read them. */
  automationRevision: number;
  /** The welcome tour, from its first step. */
  startTour: () => void;
  /** The Board's automations (beta) are on in the preferences. */
  automationsOn: boolean;
  /** Brings back the open tasks (or the Limux grid); see the sessions page header. */
  resumeOpen: () => Promise<void>;
  resumingOpen: boolean;
  gridLayout: boolean;
  /** The list should reload soon (a session was created or changed elsewhere). */
  sessionsChanged: () => void;
};

export const ShellContext = createContext<ShellActions | null>(null);

export function useShell(): ShellActions {
  const shell = useContext(ShellContext);
  if (!shell) throw new Error("useShell must be used inside <AppShell>");
  return shell;
}
