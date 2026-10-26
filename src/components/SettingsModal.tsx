import { FileCode2, FileDown, Loader2, Settings } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useSkillsHubStatus } from "../hooks/useSkillsHubStatus";
import type { Theme } from "../hooks/useTheme";
import { useToast } from "../hooks/useToast";
import * as preferencesApi from "../services/preferencesApi";
import * as skillsHubApi from "../services/skillsHubApi";
import type { UserPreferences } from "../services/preferencesApi";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { downloadPreferences } from "../utils/preferencesFile";
import { Button } from "./Button";
import { ImportPreferencesButton } from "./ImportPreferencesButton";
import { Modal } from "./Modal";
import { SettingsBigEditor, type BigEditorKey, type HubConfigDraft } from "./SettingsBigEditor";
import { SettingsList } from "./SettingsList";

type SettingsModalProps = {
  theme: Theme;
  onToggleTheme: () => void;
  onClose: () => void;
};

/**
 * One row per `userPreferences.json` key (except `language`, set from the header), with an editor
 * matched to the value's type. Saves call `notifyPreferencesChanged` so other copies reload.
 */
export function SettingsModal({ theme, onToggleTheme, onClose }: SettingsModalProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<BigEditorKey | null>(null);
  const [savingKey, setSavingKey] = useState<keyof UserPreferences | null>(null);
  const [openingFile, setOpeningFile] = useState(false);
  const { status: skillsHub } = useSkillsHubStatus(true);

  const reload = useCallback(async () => {
    try {
      setPrefs(await preferencesApi.fetchPreferences());
      setLoadError(null);
    } catch (err) {
      setLoadError(resolveApiErrorMessage(err, t, "settings.loadError"));
    }
  }, [t]);

  useEffect(() => {
    // Fetch-on-mount — the state updates only happen after the await inside `reload`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  const save = async (partial: Partial<UserPreferences>): Promise<boolean> => {
    const key = Object.keys(partial)[0] as keyof UserPreferences;
    setSavingKey(key);
    try {
      await preferencesApi.updatePreferences(partial);
      preferencesApi.notifyPreferencesChanged();
      await reload();
      showToast(t("settings.saved"), "success");
      return true;
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "settings.saveError"), "error");
      return false;
    } finally {
      setSavingKey(null);
    }
  };

  /** URL is saved first: changing it forgets the old clone path, and the path is validated against
   *  the new URL. URL "" = not used; path "" = auto-detect. The path is only sent when changed, so
   *  an untouched field never pins the auto-detected folder. */
  const saveHubConfig = async (value: HubConfigDraft): Promise<boolean> => {
    const repoUrl = value.repoUrl.trim();
    const path = value.path.trim();
    try {
      await skillsHubApi.setSkillsHubRepoUrl(repoUrl);
      const savedPath = (await preferencesApi.fetchPreferences()).skillsHub?.path ?? "";
      if (repoUrl !== "" && path !== savedPath) {
        await skillsHubApi.setSkillsHubPath(path === "" ? null : path);
      }
      showToast(t("settings.saved"), "success");
      return true;
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "settings.saveError"), "error");
      return false;
    } finally {
      preferencesApi.notifyPreferencesChanged();
      skillsHubApi.notifySkillsHubChanged();
      await reload();
    }
  };

  const openFile = async () => {
    setOpeningFile(true);
    try {
      await preferencesApi.openPreferencesInEditor();
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "settings.openFileError"), "error");
    } finally {
      setOpeningFile(false);
    }
  };

  return (
    <Modal
      open
      title={t("settings.title")}
      // Escape would otherwise close this modal too while a big editor is open on top of it.
      onClose={() => {
        if (!editing) onClose();
      }}
      size="xl"
      icon={<Settings className="h-5 w-5 text-gray-500 dark:text-gray-400" />}
    >
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">{t("settings.intro")}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void openFile()}
          disabled={openingFile}
          icon={
            openingFile ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileCode2 className="h-3.5 w-3.5" />
            )
          }
        >
          {t("settings.openFile")}
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => prefs && downloadPreferences(prefs)}
          disabled={!prefs}
          icon={<FileDown className="h-3.5 w-3.5" />}
        >
          {t("preferencesFile.export")}
        </Button>
        <ImportPreferencesButton onImported={() => void reload()} />
      </div>

      {loadError && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{loadError}</p>}
      {!prefs && !loadError && (
        <p className="mt-4 flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("settings.loading")}
        </p>
      )}

      {prefs && (
        <SettingsList
          prefs={prefs}
          skillsHub={skillsHub}
          savingKey={savingKey}
          save={save}
          onEdit={setEditing}
          theme={theme}
          onToggleTheme={onToggleTheme}
        />
      )}

      {prefs && editing && (
        <SettingsBigEditor
          editing={editing}
          prefs={prefs}
          skillsHub={skillsHub}
          save={save}
          saveHubConfig={saveHubConfig}
          onClose={() => setEditing(null)}
        />
      )}
    </Modal>
  );
}
