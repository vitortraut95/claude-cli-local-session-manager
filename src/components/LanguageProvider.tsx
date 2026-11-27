import { useCallback, useEffect, useState, type ReactNode } from "react";
import { LanguageContext } from "../hooks/useLanguage";
import { DEFAULT_LANGUAGE, type Language } from "../i18n/translations";
import * as preferencesApi from "../services/preferencesApi";

/** Holds the app language, consumed via useLanguage(); fetches preferences once for the whole app. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    preferencesApi
      .fetchPreferences()
      .then((prefs) => {
        if (cancelled) return;
        setLanguageState(prefs.language ?? DEFAULT_LANGUAGE);
      })
      .catch(() => {
        // Keep the default language already in state.
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Screen readers pick the voice from the document's language.
  useEffect(() => {
    document.documentElement.lang = language === "pt" ? "pt-BR" : "en";
  }, [language]);

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
