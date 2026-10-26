import { useLanguage } from "../hooks/useLanguage";
import type { Theme } from "../hooks/useTheme";
import type { UserPreferences } from "../services/preferencesApi";
import type { SkillsHubStatus } from "../services/skillsHubApi";
import { LimuxSetup } from "./LimuxSetup";
import { Select } from "./Select";
import type { BigEditorKey } from "./SettingsBigEditor";
import { EditButton, NumberField, PreferenceRow, Toggle } from "./SettingsControls";
import { TaskTestSkillSelect } from "./TaskTestSkillSelect";
import { ThemeToggle } from "./ThemeToggle";

type SettingsListProps = {
  prefs: UserPreferences;
  skillsHub: SkillsHubStatus | null;
  savingKey: keyof UserPreferences | null;
  save: (partial: Partial<UserPreferences>) => Promise<boolean>;
  onEdit: (key: BigEditorKey) => void;
  theme: Theme;
  onToggleTheme: () => void;
};

/** The settings rows: small values edited inline, big ones open their editor through `onEdit`. */
export function SettingsList({
  prefs,
  skillsHub,
  savingKey,
  save,
  onEdit,
  theme,
  onToggleTheme,
}: SettingsListProps) {
  const { t } = useLanguage();

  const listPreview = (items: string[]) =>
    items.length > 0 ? items.join(", ") : t("settings.preview.emptyList");

  return (
    <ul className="mt-4 divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
      <PreferenceRow
        title={t("settings.workspaceDirs.title")}
        description={t("settings.workspaceDirs.description")}
        keyName="workspaceDirs"
        preview={
          prefs.workspaceDirs == null ? (
            <span className="text-amber-600 dark:text-amber-400">
              {t("settings.preview.notSet")}
            </span>
          ) : (
            listPreview(prefs.workspaceDirs)
          )
        }
        control={<EditButton onClick={() => onEdit("workspaceDirs")} />}
      />
      <PreferenceRow
        title={t("settings.skillsHub.title")}
        description={t("settings.skillsHub.description", {
          dir: skillsHub?.userSkillsDir ?? "~/.claude/skills",
        })}
        keyName="skillsHub"
        preview={
          skillsHub === null ? undefined : skillsHub.notUsed ? (
            t("settings.preview.notUsed")
          ) : skillsHub.cloneUrl === null ? (
            <span className="text-amber-600 dark:text-amber-400">
              {t("settings.skillsHub.noRepo")}
            </span>
          ) : (
            <>
              {skillsHub.cloneUrl}
              {" · "}
              {!skillsHub.found ? (
                <span className="text-amber-600 dark:text-amber-400">
                  {t("settings.skillsHub.notInstalled")}
                </span>
              ) : (
                `${skillsHub.path ?? ""} · ${
                  skillsHub.selectedCatalogs.length > 0
                    ? skillsHub.selectedCatalogs.join(", ")
                    : t("settings.skillsHub.noCatalogs")
                }`
              )}
            </>
          )
        }
        control={<EditButton onClick={() => onEdit("skillsHubRepoUrl")} />}
      />
      {prefs.skillsHub && skillsHub?.notUsed !== true && (
        <PreferenceRow
          title={t("settings.skillsHubAutoUpdate.title")}
          description={t("settings.skillsHubAutoUpdate.description")}
          keyName="skillsHub"
          control={
            <Toggle
              checked={prefs.skillsHub.autoUpdateOnStart ?? true}
              busy={savingKey === "skillsHub"}
              onChange={(checked) =>
                prefs.skillsHub &&
                void save({ skillsHub: { ...prefs.skillsHub, autoUpdateOnStart: checked } })
              }
            />
          }
        />
      )}
      {prefs.terminalLayout !== undefined && (
        <PreferenceRow
          title={t("settings.terminalLayout.title")}
          description={t("settings.terminalLayout.description")}
          keyName="terminalLayout"
          extra={<LimuxSetup />}
          control={
            <Select
              value={prefs.terminalLayout}
              disabled={savingKey === "terminalLayout"}
              onChange={(event) =>
                void save({ terminalLayout: event.target.value as "tabs" | "limux-grid" })
              }
              className="w-48"
            >
              <option value="tabs">{t("settings.terminalLayout.tabs")}</option>
              <option value="limux-grid">{t("settings.terminalLayout.grid")}</option>
            </Select>
          }
        />
      )}
      {skillsHub?.installedSkills && (
        <PreferenceRow
          title={t("taskTestSkill.title")}
          description={t("taskTestSkill.description")}
          keyName="taskTestSkill"
          control={
            <TaskTestSkillSelect
              installedSkills={skillsHub.installedSkills}
              showDescription={false}
            />
          }
        />
      )}
      {prefs.jenkinsBaseUrl !== undefined && (
        <PreferenceRow
          title={t("settings.jenkinsBaseUrl.title")}
          description={t("settings.jenkinsBaseUrl.description")}
          keyName="jenkinsBaseUrl"
          preview={
            prefs.jenkinsBaseUrl === null ? (
              <span className="text-amber-600 dark:text-amber-400">
                {t("settings.preview.notSet")}
              </span>
            ) : (
              prefs.jenkinsBaseUrl || t("settings.preview.notUsed")
            )
          }
          control={<EditButton onClick={() => onEdit("jenkinsBaseUrl")} />}
        />
      )}
      {prefs.envPreviews !== undefined && (
        <PreferenceRow
          title={t("settings.envPreviews.title")}
          description={t("settings.envPreviews.description")}
          keyName="envPreviews"
          preview={
            Object.keys(prefs.envPreviews).length > 0
              ? t("settings.envPreviews.preview", {
                  count: Object.keys(prefs.envPreviews).length,
                  projects: Object.keys(prefs.envPreviews).join(", "),
                })
              : t("settings.preview.emptyList")
          }
          control={<EditButton onClick={() => onEdit("envPreviews")} />}
        />
      )}
      {prefs.worktreeSetup !== undefined && (
        <PreferenceRow
          title={t("settings.worktreeSetup.title")}
          description={t("settings.worktreeSetup.description")}
          keyName="worktreeSetup"
          preview={
            Object.keys(prefs.worktreeSetup).length > 0
              ? t("settings.envPreviews.preview", {
                  count: Object.keys(prefs.worktreeSetup).length,
                  projects: Object.keys(prefs.worktreeSetup).join(", "),
                })
              : t("settings.preview.emptyList")
          }
          control={<EditButton onClick={() => onEdit("worktreeSetup")} />}
        />
      )}
      <PreferenceRow
        title={t("settings.defaultPrompt.title")}
        description={t("settings.defaultPrompt.description")}
        keyName="defaultPrompt"
        preview={
          prefs.defaultPrompt.trim()
            ? t("settings.preview.text", {
                firstLine: prefs.defaultPrompt.trim().split("\n")[0] ?? "",
                lines: prefs.defaultPrompt.split("\n").length,
              })
            : t("settings.preview.emptyText")
        }
        control={<EditButton onClick={() => onEdit("defaultPrompt")} />}
      />
      <PreferenceRow
        title={t("settings.defaultSessionPrompt.title")}
        description={t("settings.defaultSessionPrompt.description")}
        keyName="defaultSessionPrompt"
        preview={
          prefs.defaultSessionPrompt?.trim()
            ? t("settings.preview.text", {
                firstLine: prefs.defaultSessionPrompt.trim().split("\n")[0] ?? "",
                lines: prefs.defaultSessionPrompt.split("\n").length,
              })
            : t("settings.preview.emptyText")
        }
        control={<EditButton onClick={() => onEdit("defaultSessionPrompt")} />}
      />
      <PreferenceRow
        title={t("settings.branchTypes.title")}
        description={t("settings.branchTypes.description")}
        keyName="branchTypes"
        preview={listPreview(prefs.branchTypes)}
        control={<EditButton onClick={() => onEdit("branchTypes")} />}
      />
      <PreferenceRow
        title={t("settings.recentProjectPaths.title")}
        description={t("settings.recentProjectPaths.description")}
        keyName="recentProjectPaths"
        preview={listPreview(prefs.recentProjectPaths)}
        control={<EditButton onClick={() => onEdit("recentProjectPaths")} />}
      />
      <PreferenceRow
        title={t("settings.useWorktreeByDefault.title")}
        description={t("settings.useWorktreeByDefault.description")}
        keyName="useWorktreeByDefault"
        control={
          <Toggle
            checked={prefs.useWorktreeByDefault}
            busy={savingKey === "useWorktreeByDefault"}
            onChange={(checked) => void save({ useWorktreeByDefault: checked })}
          />
        }
      />
      <PreferenceRow
        title={t("settings.useAutoPermissionModeByDefault.title")}
        description={t("settings.useAutoPermissionModeByDefault.description")}
        keyName="useAutoPermissionModeByDefault"
        control={
          <Toggle
            checked={prefs.useAutoPermissionModeByDefault}
            busy={savingKey === "useAutoPermissionModeByDefault"}
            onChange={(checked) => void save({ useAutoPermissionModeByDefault: checked })}
          />
        }
      />
      <PreferenceRow
        title={t("settings.keepRecentSessionsPerProject.title")}
        description={t("settings.keepRecentSessionsPerProject.description")}
        keyName="keepRecentSessionsPerProject"
        control={
          <NumberField
            value={prefs.keepRecentSessionsPerProject}
            busy={savingKey === "keepRecentSessionsPerProject"}
            onCommit={(next) => void save({ keepRecentSessionsPerProject: next })}
          />
        }
      />
      <ThemeRow theme={theme} onToggle={onToggleTheme} />
    </ul>
  );
}

function ThemeRow({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const { t } = useLanguage();
  return (
    <li className="flex items-center gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium text-gray-900 dark:text-gray-100">
          {t("settings.theme.title")}
          <code className="text-[10px] font-normal text-gray-400 dark:text-gray-500">theme</code>
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t("settings.theme.description")}
        </p>
      </div>
      <div className="shrink-0">
        <ThemeToggle theme={theme} onToggle={onToggle} />
      </div>
    </li>
  );
}
