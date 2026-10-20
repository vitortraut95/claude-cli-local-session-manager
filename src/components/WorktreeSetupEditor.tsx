import { useLanguage } from "../hooks/useLanguage";
import { useProjectFolders } from "../hooks/useProjectFolders";
import type { WorktreeSetup } from "../services/preferencesApi";

type WorktreeSetupEditorProps = {
  value: WorktreeSetup;
  onChange: (value: WorktreeSetup) => void;
};

const OPTIONS = ["linkNodeModules", "copyEnvFiles"] as const;

/** Settings → "Worktree setup": per known repo, what a new task worktree gets from the main
 *  checkout. Keyed by folder name (like `envPreviews`), so a shared preferences file fits
 *  everyone's clones. */
export function WorktreeSetupEditor({ value, onChange }: WorktreeSetupEditorProps) {
  const { t } = useLanguage();
  const { projects, loadingProjects } = useProjectFolders(true);

  // Known repos, plus any configured one not found on this machine (still editable).
  const names = [
    ...new Set([
      ...projects.map((p) => p.path.split("/").filter(Boolean).pop() ?? p.path),
      ...Object.keys(value),
    ]),
  ].sort((a, b) => a.localeCompare(b));

  const toggle = (name: string, option: (typeof OPTIONS)[number], checked: boolean) => {
    const current = value[name] ?? { linkNodeModules: false, copyEnvFiles: false };
    const next = { ...current, [option]: checked };
    const rest = { ...value };
    delete rest[name];
    onChange(next.linkNodeModules || next.copyEnvFiles ? { ...rest, [name]: next } : rest);
  };

  if (loadingProjects && names.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {t("newTaskModal.loadingProjects")}
      </p>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
          <th className="py-2 pr-4 font-medium">{t("settings.worktreeSetup.repo")}</th>
          <th className="py-2 pr-4 font-medium">{t("settings.worktreeSetup.linkNodeModules")}</th>
          <th className="py-2 font-medium">{t("settings.worktreeSetup.copyEnvFiles")}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
        {names.map((name) => (
          <tr key={name}>
            <td className="py-2 pr-4 font-mono text-xs text-gray-800 dark:text-gray-200">{name}</td>
            {OPTIONS.map((option) => (
              <td key={option} className="py-2 pr-4">
                <input
                  type="checkbox"
                  checked={value[name]?.[option] ?? false}
                  onChange={(event) => toggle(name, option, event.target.checked)}
                  aria-label={`${name}: ${t(
                    option === "linkNodeModules"
                      ? "settings.worktreeSetup.linkNodeModules"
                      : "settings.worktreeSetup.copyEnvFiles",
                  )}`}
                  className="h-4 w-4 accent-gray-900 dark:accent-gray-100"
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
