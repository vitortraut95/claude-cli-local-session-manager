import { useCallback, useEffect, useState, type ReactNode } from "react";
import { LanguageContext } from "../hooks/useLanguage";
import { detectBrowserLanguage, type Language } from "../i18n/translations";
import * as preferencesApi from "../services/preferencesApi";

/** Holds the app language, consumed via useLanguage(); fetches preferences once for the whole app. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(detectBrowserLanguage());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    preferencesApi
      .fetchPreferences()
      .then((prefs) => {
        if (cancelled) return;
        setLanguageState(prefs.language ?? detectBrowserLanguage());
      })
      .catch(() => {
        // Keep the browser-detected language already in state.
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
    void preferencesApi.updatePreferences({ language: next });
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, loaded }}>
      {children}
    </LanguageContext.Provider>
  );
}
