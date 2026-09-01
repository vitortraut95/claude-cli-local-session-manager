import { createContext, useCallback, useContext } from "react";
import { t as translateKey, type Language, type TranslationKey } from "../i18n/translations";

export type LanguageContextValue = {
  language: Language;
  setLanguage: (next: Language) => void;
  hasSeenOnboarding: boolean;
  markOnboardingSeen: () => void;
  loaded: boolean;
};

export const LanguageContext = createContext<LanguageContextValue | null>(null);

/** Single app-wide source of the current language (see LanguageProvider) — every component that
 *  renders translated text calls this for `t`, not just Header/OnboardingModal, since the
 *  language choice has to reach the whole tree (SessionCard, every modal, filters, toasts). */
export function useLanguage(): LanguageContextValue & {
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
} {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  // Stable across renders unless `language` itself changes — several components pass `t` into a
  // useEffect/useCallback dependency array (for error-fallback strings). A plain inline arrow
  // function would get a new identity every render, making any effect that depends on it re-fire
  // (and re-fetch) on every render — an infinite loop if the effect itself triggers a re-render
  // (e.g. CleanupModal's fetch-on-open effect setting `loading`/`findings`). Keyed only on
  // `context.language`, not the whole `context` object, so switching some unrelated field
  // (hasSeenOnboarding) doesn't also invalidate every `t` reference across the app.
  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) =>
      translateKey(context.language, key, params),
    [context.language],
  );
  return { ...context, t };
}
