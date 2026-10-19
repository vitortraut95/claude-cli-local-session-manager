import { createContext, useCallback, useContext } from "react";
import { t as translateKey, type Language, type TranslationKey } from "../i18n/translations";

export type LanguageContextValue = {
  language: Language;
  setLanguage: (next: Language) => void;
  loaded: boolean;
};

export const LanguageContext = createContext<LanguageContextValue | null>(null);

/** Current language and its `t` translator, from LanguageProvider. */
export function useLanguage(): LanguageContextValue & {
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
} {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  // Must stay referentially stable (keyed on `language` only): components list `t` in effect
  // deps, and a new identity per render would re-fire those effects in a loop.
  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) =>
      translateKey(context.language, key, params),
    [context.language],
  );
  return { ...context, t };
}
