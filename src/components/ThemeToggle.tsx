import { Moon, Sun } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import type { Theme } from "../hooks/useTheme";

type ThemeToggleProps = {
  theme: Theme;
  onToggle: () => void;
};

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const { t } = useLanguage();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? t("themeToggle.switchToLight") : t("themeToggle.switchToDark")}
      onClick={onToggle}
      className="relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border border-stone-300 bg-stone-100 transition-colors dark:border-stone-700 dark:bg-stone-800"
    >
      <span
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full bg-white shadow transition-transform dark:bg-stone-950 ${
          isDark ? "translate-x-7" : "translate-x-1"
        }`}
      >
        {isDark ? (
          <Moon className="h-3.5 w-3.5 text-stone-300" />
        ) : (
          <Sun className="h-3.5 w-3.5 text-amber-500" />
        )}
      </span>
    </button>
  );
}
