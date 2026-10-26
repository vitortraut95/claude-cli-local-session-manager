import { useLanguage } from "../hooks/useLanguage";
import type { EnvPreviews, UserPreferences } from "../services/preferencesApi";
import type { SkillsHubStatus } from "../services/skillsHubApi";
import { BigEditorModal } from "./BigEditorModal";
import { Input } from "./Input";
import { StringListEditor } from "./StringListEditor";
import { WorkspaceDirsEditor } from "./WorkspaceDirsEditor";
import { WorktreeSetupEditor } from "./WorktreeSetupEditor";

/** Keys edited in a big secondary modal rather than inline in their row. */
export type BigEditorKey =
  | "workspaceDirs"
  | "defaultPrompt"
  | "defaultSessionPrompt"
  | "branchTypes"
  | "recentProjectPaths"
  | "jenkinsBaseUrl"
  | "skillsHubRepoUrl"
  | "envPreviews"
  | "worktreeSetup";

export type HubConfigDraft = { repoUrl: string; path: string };

type SettingsBigEditorProps = {
  editing: BigEditorKey;
  prefs: UserPreferences;
  skillsHub: SkillsHubStatus | null;
  save: (partial: Partial<UserPreferences>) => Promise<boolean>;
  saveHubConfig: (value: HubConfigDraft) => Promise<boolean>;
  onClose: () => void;
};

const TEXTAREA_CLASS =
  "w-full rounded-lg border border-gray-300 bg-white p-3 font-mono text-xs text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100";

/** The envPreviews editor's JSON draft, parsed — null when it isn't valid JSON of the right shape. */
function parseEnvPreviews(raw: string): EnvPreviews | null {
  try {
    const parsed: unknown = JSON.parse(raw.trim() || "{}");
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    const valid = Object.values(parsed as Record<string, unknown>).every(
      (list) =>
        Array.isArray(list) &&
        list.every(
          (item: unknown) =>
            typeof item === "object" &&
            item !== null &&
            typeof (item as Record<string, unknown>).label === "string" &&
            typeof (item as Record<string, unknown>).url === "string",
        ),
    );
    return valid ? (parsed as EnvPreviews) : null;
  } catch {
    return null;
  }
}

/** The big editor for one settings key; closes itself only when the save succeeds. */
export function SettingsBigEditor({
  editing,
  prefs,
  skillsHub,
  save,
  saveHubConfig,
  onClose,
}: SettingsBigEditorProps) {
  const { t } = useLanguage();

  switch (editing) {
    case "workspaceDirs":
      return (
        <BigEditorModal
          title={t("settings.workspaceDirs.title")}
          description={t("settings.workspaceDirs.description")}
          initial={prefs.workspaceDirs ?? []}
          onCancel={onClose}
          onSave={async (value) => {
            if (await save({ workspaceDirs: value })) onClose();
          }}
          render={(value, setValue) => <WorkspaceDirsEditor value={value} onChange={setValue} />}
        />
      );
    case "jenkinsBaseUrl":
      return (
        <BigEditorModal
          title={t("settings.jenkinsBaseUrl.title")}
          description={t("settings.jenkinsBaseUrl.description")}
          initial={prefs.jenkinsBaseUrl ?? ""}
          onCancel={onClose}
          onSave={async (value) => {
            if (await save({ jenkinsBaseUrl: value.trim() })) onClose();
          }}
          render={(value, setValue) => (
            <Input
              type="url"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="https://jenkins.example.com"
              className="font-mono"
              autoFocus
            />
          )}
        />
      );
    case "envPreviews":
      return (
        <BigEditorModal
          title={t("settings.envPreviews.title")}
          description={t("settings.envPreviews.description")}
          initial={JSON.stringify(prefs.envPreviews ?? {}, null, 2)}
          canSave={(value) => parseEnvPreviews(value) !== null}
          onCancel={onClose}
          onSave={async (value) => {
            const parsed = parseEnvPreviews(value);
            if (parsed && (await save({ envPreviews: parsed }))) onClose();
          }}
          render={(value, setValue) => (
            <>
              <textarea
                value={value}
                onChange={(event) => setValue(event.target.value)}
                autoFocus
                rows={24}
                spellCheck={false}
                className={TEXTAREA_CLASS}
              />
              {parseEnvPreviews(value) === null && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                  {t("settings.envPreviews.invalid")}
                </p>
              )}
            </>
          )}
        />
      );
    case "worktreeSetup":
      return (
        <BigEditorModal
          title={t("settings.worktreeSetup.title")}
          description={t("settings.worktreeSetup.description")}
          initial={prefs.worktreeSetup ?? {}}
          onCancel={onClose}
          onSave={async (value) => {
            if (await save({ worktreeSetup: value })) onClose();
          }}
          render={(value, setValue) => <WorktreeSetupEditor value={value} onChange={setValue} />}
        />
      );
    case "skillsHubRepoUrl":
      return (
        <BigEditorModal
          title={t("settings.skillsHub.repoUrlTitle")}
          description={t("settings.skillsHub.repoUrlDescription")}
          initial={{
            repoUrl: prefs.skillsHub?.repoUrl ?? skillsHub?.cloneUrl ?? "",
            path: prefs.skillsHub?.path ?? "",
          }}
          onCancel={onClose}
          onSave={async (value) => {
            if (await saveHubConfig(value)) onClose();
          }}
          render={(value, setValue) => (
            <HubConfigFields
              value={value}
              onChange={setValue}
              detectedPath={skillsHub?.path ?? null}
              savedPath={prefs.skillsHub?.path ?? null}
            />
          )}
        />
      );
    case "defaultPrompt":
      return (
        <BigEditorModal
          title={t("settings.defaultPrompt.title")}
          description={t("settings.defaultPrompt.description")}
          initial={prefs.defaultPrompt}
          onCancel={onClose}
          onSave={async (value) => {
            if (await save({ defaultPrompt: value })) onClose();
          }}
          render={(value, setValue) => (
            <textarea
              value={value}
              onChange={(event) => setValue(event.target.value)}
              autoFocus
              rows={24}
              className={TEXTAREA_CLASS}
            />
          )}
        />
      );
    case "defaultSessionPrompt":
      return (
        <BigEditorModal
          title={t("settings.defaultSessionPrompt.title")}
          description={t("settings.defaultSessionPrompt.description")}
          initial={prefs.defaultSessionPrompt ?? ""}
          onCancel={onClose}
          onSave={async (value) => {
            if (await save({ defaultSessionPrompt: value })) onClose();
          }}
          render={(value, setValue) => (
            <textarea
              value={value}
              onChange={(event) => setValue(event.target.value)}
              autoFocus
              rows={24}
              className={TEXTAREA_CLASS}
            />
          )}
        />
      );
    case "branchTypes":
      return (
        <BigEditorModal
          title={t("settings.branchTypes.title")}
          description={t("settings.branchTypes.description")}
          initial={prefs.branchTypes}
          canSave={(value) => value.length > 0}
          onCancel={onClose}
          onSave={async (value) => {
            if (await save({ branchTypes: value })) onClose();
          }}
          render={(value, setValue) => (
            <StringListEditor
              value={value}
              onChange={setValue}
              placeholder={t("settings.branchTypes.placeholder")}
              firstItemHint={t("settings.branchTypes.firstIsDefault")}
            />
          )}
        />
      );
    case "recentProjectPaths":
      return (
        <BigEditorModal
          title={t("settings.recentProjectPaths.title")}
          description={t("settings.recentProjectPaths.description")}
          initial={prefs.recentProjectPaths}
          onCancel={onClose}
          onSave={async (value) => {
            if (await save({ recentProjectPaths: value })) onClose();
          }}
          render={(value, setValue) => (
            <StringListEditor
              value={value}
              onChange={setValue}
              placeholder={t("settings.recentProjectPaths.placeholder")}
              mono
            />
          )}
        />
      );
  }
}

/** Skills hub repo URL + optional clone path; the path is disabled while the URL is empty. */
function HubConfigFields({
  value,
  onChange,
  detectedPath,
  savedPath,
}: {
  value: HubConfigDraft;
  onChange: (value: HubConfigDraft) => void;
  detectedPath: string | null;
  savedPath: string | null;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-4">
      <label className="block">
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {t("settings.skillsHub.repoUrlLabel")}
        </span>
        <div className="mt-1">
          <Input
            type="text"
            value={value.repoUrl}
            onChange={(event) => onChange({ ...value, repoUrl: event.target.value })}
            placeholder="git@github.com:team/skills-repo.git"
            className="font-mono"
            autoFocus
          />
        </div>
      </label>
      <label className="block">
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {t("settings.skillsHub.pathLabel")}
        </span>
        <div className="mt-1">
          <Input
            type="text"
            value={value.path}
            onChange={(event) => onChange({ ...value, path: event.target.value })}
            placeholder={detectedPath ?? "~/git/skills-repo"}
            className="font-mono"
            disabled={value.repoUrl.trim() === ""}
          />
        </div>
        <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
          {detectedPath && !savedPath
            ? t("settings.skillsHub.pathDetected", { path: detectedPath })
            : t("settings.skillsHub.pathHint")}
        </span>
      </label>
    </div>
  );
}
