import { useCallback, useEffect, useState, type ReactNode } from "react";
import { LanguageContext } from "../hooks/useLanguage";
import { detectBrowserLanguage, type Language } from "../i18n/translations";
import * as tasksApi from "../services/tasksApi";

/** Mirrors ToastProvider's shape: state lives here, consumed everywhere via useLanguage(). Fetches
 *  preferences once for the whole app (not per-component) — writes go through
 *  tasksApi.updatePreferences so NewTaskModal's own preference saves (different fields) can't
 *  clobber these, or vice versa. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(detectBrowserLanguage());
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    tasksApi
      .fetchPreferences()
      .then((prefs) => {
        if (cancelled) return;
        setLanguageState(prefs.language ?? detectBrowserLanguage());
        setHasSeenOnboarding(prefs.hasSeenOnboarding);
      })
      .catch(() => {
        // Keep the browser-detected language and "not seen" default already in state.
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    void tasksApi.updatePreferences({ language: next });
  }, []);

  const markOnboardingSeen = useCallback(() => {
    setHasSeenOnboarding(true);
    void tasksApi.updatePreferences({ hasSeenOnboarding: true });
  }, []);

  return (
    <LanguageContext.Provider
      value={{ language, setLanguage, hasSeenOnboarding, markOnboardingSeen, loaded }}
    >
      {children}
    </LanguageContext.Provider>
  );
}
