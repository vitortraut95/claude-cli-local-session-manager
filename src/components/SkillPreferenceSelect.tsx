import { Loader2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useToast } from "../hooks/useToast";
import * as preferencesApi from "../services/preferencesApi";
import * as skillsHubApi from "../services/skillsHubApi";
import type { SkillsHubStatus } from "../services/skillsHubApi";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { Select } from "./Select";

/** Preferences holding the name of an installed skill. */
export type SkillPreference = "taskTestSkill" | "taskRefinementSkill";

type SkillPreferenceSelectProps = {
  preference: SkillPreference;
  icon: ReactNode;
  /** Accessible name of the select. */
  label: string;
  skillsHub: SkillsHubStatus;
  /** Shows the chosen skill's description under the select (off in a compact settings row). */
  showDescription?: boolean;
};

/** A name `/<name>` takes — the server refuses anything else (e.g. a "(deprecated)" folder). */
const SKILL_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
/** Option value of a hub skill not installed yet: choosing it links it first. */
const INSTALL_PREFIX = "install:";

type SkillOption = {
  value: string;
  name: string;
  description: string;
  installed: boolean;
};
type SkillGroup = { catalog: string | null; options: SkillOption[] };

/**
 * Installed skills plus every hub skill that could be installed (a name already installed from
 * another catalog can't be, so it's left out), grouped by hub catalog (team) alphabetically —
 * skills outside a hub last — and alphabetically within.
 */
function groupByCatalog(skillsHub: SkillsHubStatus): SkillGroup[] {
  const groups = new Map<string | null, SkillOption[]>();
  const add = (catalog: string | null, option: SkillOption) =>
    groups.set(catalog, [...(groups.get(catalog) ?? []), option]);

  const installedNames = new Set(skillsHub.installedSkills.map((skill) => skill.name));
  for (const skill of skillsHub.installedSkills) {
    add(skill.catalog ?? null, {
      value: skill.name,
      name: skill.name,
      description: skill.description,
      installed: true,
    });
  }
  for (const catalog of skillsHub.catalogs) {
    for (const skill of catalog.skills) {
      if (installedNames.has(skill.name) || !SKILL_NAME_PATTERN.test(skill.name)) continue;
      add(catalog.name, {
        value: `${INSTALL_PREFIX}${catalog.name}/${skill.name}`,
        name: skill.name,
        description: skill.description,
        installed: false,
      });
    }
  }
  return [...groups.entries()]
    .map(([catalog, options]) => ({
      catalog,
      options: options.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) =>
      a.catalog === null ? 1 : b.catalog === null ? -1 : a.catalog.localeCompare(b.catalog),
    );
}

/**
 * Picks a skill for `preference`; loads and saves it on change itself, then fires
 * `notifyPreferencesChanged` so every other picker of it updates. Lists every hub catalog: a skill
 * not installed yet is added to the hub selection (linked into `~/.claude/skills`) before it's
 * saved. A saved skill no longer installed stays listed.
 */
export function SkillPreferenceSelect({
  preference,
  icon,
  label,
  skillsHub,
  showDescription = true,
}: SkillPreferenceSelectProps) {
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
          if (!cancelled) setValue(prefs[preference] ?? "");
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
  }, [preference]);

  /** Links `<catalog>/<name>` from the hub; throws when it didn't end up installed (a conflict). */
  const install = async (id: string) => {
    const name = id.slice(id.indexOf("/") + 1);
    const result = await skillsHubApi.setSkillsHubSelection({
      catalogs: skillsHub.selectedCatalogs,
      skills: [...skillsHub.selectedSkills, id],
    });
    skillsHubApi.notifySkillsHubChanged();
    const status = await skillsHubApi.fetchSkillsHubStatus();
    if (!status.installedSkills.some((skill) => skill.name === name)) {
      throw new Error(
        t("skillSelect.installFailed", { skill: name, conflicts: result.conflicts.join(", ") }),
      );
    }
    return name;
  };

  const change = async (next: string) => {
    const previous = value;
    setSaving(true);
    try {
      const skill = next.startsWith(INSTALL_PREFIX)
        ? await install(next.slice(INSTALL_PREFIX.length))
        : next;
      setValue(skill);
      await preferencesApi.updatePreferences({ [preference]: skill });
      preferencesApi.notifyPreferencesChanged();
      showToast(t("settings.saved"), "success");
    } catch (err) {
      setValue(previous);
      showToast(resolveApiErrorMessage(err, t, "settings.saveError"), "error");
    } finally {
      setSaving(false);
    }
  };

  const installedSkills = skillsHub.installedSkills;
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
            icon={icon}
            value={value ?? ""}
            disabled={value === null || saving}
            onChange={(event) => void change(event.target.value)}
            aria-label={label}
            className={missing ? "text-amber-700 dark:text-amber-400" : ""}
          >
            <option value="">{t("skillSelect.none")}</option>
            {missing && <option value={value}>{t("skillSelect.missing", { skill: value })}</option>}
            {groupByCatalog(skillsHub).map((group) => (
              <optgroup key={group.catalog ?? ""} label={group.catalog ?? t("skillSelect.other")}>
                {group.options.map((option) => {
                  const text = group.catalog ? `${group.catalog}/${option.name}` : option.name;
                  return (
                    <option key={option.value} value={option.value} title={option.description}>
                      {option.installed ? text : t("skillSelect.notInstalled", { skill: text })}
                    </option>
                  );
                })}
              </optgroup>
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
