import { useCallback, useEffect, useState } from "react";
import { detectBrowserLanguage, type Language } from "../i18n/translations";
import * as tasksApi from "../services/tasksApi";

/**
 * Single shared fetch backing both the header's language switcher and the onboarding modal's
 * "seen once" gate. NewTaskModal keeps its own independent fetch/save for its own fields
 * (defaultPrompt/branchTypes/useWorktreeByDefault) — every write on either side goes through
 * `tasksApi.updatePreferences`, so neither side can clobber fields it doesn't own.
 */
export function usePreferences() {
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

  return { language, setLanguage, hasSeenOnboarding, markOnboardingSeen, loaded };
}
