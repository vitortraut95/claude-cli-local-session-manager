import { GitFork } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";

type WorktreeFilterProps = {
  value: boolean;
  onChange: (value: boolean) => void;
};

/** Violet accent matches the worktree badge/icon used on SessionCard, so the two read as the
 *  same concept wherever they show up. */
export function WorktreeFilter({ value, onChange }: WorktreeFilterProps) {
  const { t } = useLanguage();
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-pressed={value}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
        value
          ? "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-400"
          : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
      }`}
    >
      <GitFork className="h-4 w-4" />
      {t("worktreeFilter.label")}
    </button>
  );
}
