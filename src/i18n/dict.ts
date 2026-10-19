import type { Language } from "../services/preferencesApi";

export type Dict = Record<Language, string>;

export function dict(en: string, pt: string): Dict {
  return { en, pt };
}
