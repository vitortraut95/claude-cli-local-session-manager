import { Moon, Sun } from "lucide-react";
import type { Theme } from "../hooks/useTheme";

type ThemeToggleProps = {
  theme: Theme;
  onToggle: () => void;
};

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
      onClick={onToggle}
      className="relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border border-gray-300 bg-gray-100 transition-colors dark:border-gray-700 dark:bg-gray-800"
    >
      <span
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full bg-white shadow transition-transform dark:bg-gray-950 ${
          isDark ? "translate-x-7" : "translate-x-1"
        }`}
      >
        {isDark ? (
          <Moon className="h-3.5 w-3.5 text-gray-300" />
        ) : (
          <Sun className="h-3.5 w-3.5 text-amber-500" />
        )}
      </span>
    </button>
  );
}
