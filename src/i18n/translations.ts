import type { Language } from "../services/preferencesApi";
import type { Dict } from "./dict";
import { common } from "./locales/common";
import { apiErrors } from "./locales/apiErrors";
import { sessions } from "./locales/sessions";
import { newTask } from "./locales/newTask";
import { tasks } from "./locales/tasks";
import { worktrees } from "./locales/worktrees";
import { transfer } from "./locales/transfer";
import { skillsHub } from "./locales/skillsHub";
import { settings } from "./locales/settings";
import { taskQueue } from "./locales/taskQueue";
import { workStatus } from "./locales/workStatus";
import { history } from "./locales/history";

export type { Language };

export const LANGUAGE_OPTIONS: { code: Language; label: string }[] = [
  { code: "en", label: "English" },
  { code: "pt", label: "Português" },
];

/** Maps the browser's language to a supported one (English if unrecognized) — used while
 *  `UserPreferences.language` is null. */
export function detectBrowserLanguage(): Language {
  const candidates = navigator.languages ?? [navigator.language];
  for (const raw of candidates) {
    const prefix = raw.slice(0, 2).toLowerCase();
    if (prefix === "pt" || prefix === "en") return prefix;
  }
  return "en";
}

/** Every user-visible string in the app, per language. */
export const translations = {
  ...common,
  ...apiErrors,
  ...sessions,
  ...newTask,
  ...tasks,
  ...worktrees,
  ...transfer,
  ...skillsHub,
  ...settings,
  ...taskQueue,
  ...workStatus,
  ...history,
} satisfies Record<string, Dict>;

export type TranslationKey = keyof typeof translations;

/** `params` fills `{name}` placeholders — plain substitution, no plural rules (use separate
 *  keys for singular/plural). */
export function t(
  language: Language,
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  const template = translations[key][language];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => String(params[name] ?? ""));
}
