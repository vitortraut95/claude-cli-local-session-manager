import { createContext, useContext } from "react";
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
  return {
    ...context,
    t: (key: TranslationKey, params?: Record<string, string | number>) =>
      translateKey(context.language, key, params),
  };
}
