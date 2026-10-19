import { useCallback, useEffect, useState } from "react";
import * as preferencesApi from "../services/preferencesApi";

export type Theme = "light" | "dark";

/** First-paint cache of `UserPreferences.theme`, so the page doesn't flash before prefs load. */
const STORAGE_KEY = "theme";

function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readCachedTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

/** Theme stored in `userPreferences.json` (so it's exported/imported with everything else). */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => readCachedTheme() ?? getSystemTheme());

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Cache only.
    }
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      preferencesApi
        .fetchPreferences()
        .then((prefs) => {
          if (cancelled) return;
          if (prefs.theme === "light" || prefs.theme === "dark") {
            setTheme(prefs.theme);
            return;
          }
          // Not saved yet (older file, or a backend without the field): keep the browser's choice
          // from before the theme moved into the preferences.
          const cached = readCachedTheme();
          if (cached && prefs.theme === null) {
            void preferencesApi.updatePreferences({ theme: cached }).catch(() => undefined);
          }
        })
        .catch(() => undefined);
    };
    load();
    window.addEventListener(preferencesApi.PREFERENCES_CHANGED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(preferencesApi.PREFERENCES_CHANGED_EVENT, load);
    };
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    void preferencesApi.updatePreferences({ theme: next }).catch(() => undefined);
  }, [theme]);

  return { theme, toggleTheme };
}
