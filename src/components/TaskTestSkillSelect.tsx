import { FlaskConical, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useToast } from "../hooks/useToast";
import * as preferencesApi from "../services/preferencesApi";
import type { InstalledSkill } from "../services/skillsHubApi";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { Select } from "./Select";

type TaskTestSkillSelectProps = {
  /** `SkillsHubStatus.installedSkills` — everything in `~/.claude/skills`, hub or not. */
  installedSkills: InstalledSkill[];
  /** Shows the chosen skill's description under the select (off in a compact settings row). */
  showDescription?: boolean;
};

/**
 * Picks `taskTestSkill`; loads and saves it on change itself, then fires
 * `notifyPreferencesChanged` so the header updates. A saved skill no longer installed stays listed.
 */
export function TaskTestSkillSelect({
  installedSkills,
  showDescription = true,
}: TaskTestSkillSelectProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [value, setValue] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      preferencesApi
        .fetchPreferences()
        .then((prefs) => {
          if (!cancelled) setValue(prefs.taskTestSkill ?? "");
        })
        .catch(() => {
          if (!cancelled) setValue("");
        });
    };
    load();
    window.addEventListener(preferencesApi.PREFERENCES_CHANGED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(preferencesApi.PREFERENCES_CHANGED_EVENT, load);
    };
  }, []);

  const change = async (next: string) => {
    const previous = value;
    setValue(next);
    setSaving(true);
    try {
      await preferencesApi.updatePreferences({ taskTestSkill: next });
      preferencesApi.notifyPreferencesChanged();
      showToast(t("settings.saved"), "success");
    } catch (err) {
      setValue(previous);
      showToast(resolveApiErrorMessage(err, t, "settings.saveError"), "error");
    } finally {
      setSaving(false);
    }
  };

  const missing = value !== null && value !== "" && !installedSkills.some((s) => s.name === value);
  const selected = installedSkills.find((skill) => skill.name === value);

  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-2">
        {(value === null || saving) && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
        )}
        <div className="w-72 max-w-full">
          <Select
            icon={<FlaskConical className="h-3.5 w-3.5" />}
            value={value ?? ""}
            disabled={value === null || saving}
            onChange={(event) => void change(event.target.value)}
            aria-label={t("taskTestSkill.title")}
            className={missing ? "text-amber-700 dark:text-amber-400" : ""}
          >
            <option value="">{t("taskTestSkill.none")}</option>
            {missing && (
              <option value={value}>{t("taskTestSkill.missing", { skill: value })}</option>
            )}
            {installedSkills.map((skill) => (
              <option key={skill.name} value={skill.name} title={skill.description}>
                {skill.name}
              </option>
            ))}
          </Select>
        </div>
      </span>
      {showDescription && selected?.description && (
        <p className="line-clamp-2 max-w-xl text-xs text-gray-500 dark:text-gray-400">
          {selected.description}
        </p>
      )}
    </div>
  );
}
