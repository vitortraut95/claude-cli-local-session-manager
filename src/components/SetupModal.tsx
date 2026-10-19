import { Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useToast } from "../hooks/useToast";
import * as preferencesApi from "../services/preferencesApi";
import * as skillsHubApi from "../services/skillsHubApi";
import type { UserPreferences } from "../services/preferencesApi";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { ImportPreferencesButton } from "./ImportPreferencesButton";
import { Input } from "./Input";
import { Modal } from "./Modal";
import { WorkspaceDirsEditor } from "./WorkspaceDirsEditor";

type SetupModalProps = {
  /** The preferences that triggered the setup — used to prefill. */
  prefs: UserPreferences;
  onSaved: () => void;
  /** "Not now" — only for this page load; it comes back on the next load until saved. */
  onSkip: () => void;
};

/** Shown on every load while `workspaceDirs`, `jenkinsBaseUrl` or `skillsHub.repoUrl` was never
 *  saved (null). Empty Jenkins/hub fields save "" (not used). */
export function SetupModal({ prefs, onSaved, onSkip }: SetupModalProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [dirs, setDirs] = useState<string[]>(prefs.workspaceDirs ?? []);
  const [jenkinsBaseUrl, setJenkinsBaseUrl] = useState(prefs.jenkinsBaseUrl ?? "");
  const [hubRepoUrl, setHubRepoUrl] = useState(prefs.skillsHub?.repoUrl ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (prefs.skillsHub?.repoUrl != null) return;
    let cancelled = false;
    skillsHubApi
      .fetchDetectedHubRepoUrl()
      .then((detected) => {
        if (cancelled || !detected) return;
        // Only while the user hasn't typed something else already.
        setHubRepoUrl((current) => (current === "" ? detected : current));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [prefs.skillsHub?.repoUrl]);

  const handleImported = async () => {
    const imported = await preferencesApi.fetchPreferences().catch(() => null);
    if (!imported) return;
    if (imported.workspaceDirs) setDirs(imported.workspaceDirs);
    setJenkinsBaseUrl(imported.jenkinsBaseUrl ?? "");
    setHubRepoUrl(imported.skillsHub?.repoUrl ?? "");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await preferencesApi.updatePreferences({
        workspaceDirs: dirs,
        jenkinsBaseUrl: jenkinsBaseUrl.trim(),
      });
      await skillsHubApi.setSkillsHubRepoUrl(hubRepoUrl.trim());
      preferencesApi.notifyPreferencesChanged();
      skillsHubApi.notifySkillsHubChanged();
      showToast(t("setup.saved"), "success");
      onSaved();
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "settings.saveError"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={t("setup.title")}
      onClose={onSkip}
      onCancel={onSkip}
      onConfirm={() => void handleSave()}
      cancelLabel={t("setup.skip")}
      confirmLabel={t("setup.save")}
      isConfirmLoading={saving}
      isConfirmDisabled={dirs.length === 0}
      size="lg"
      icon={<Settings2 className="h-5 w-5 text-gray-500 dark:text-gray-400" />}
    >
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">{t("setup.intro")}</p>
        <ImportPreferencesButton onImported={() => void handleImported()} />
      </div>

      <h3 className="mt-5 text-sm font-medium text-gray-900 dark:text-gray-100">
        {t("setup.workspaceDirs.label")}
      </h3>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {t("setup.workspaceDirs.hint")}
      </p>
      <div className="mt-2">
        <WorkspaceDirsEditor value={dirs} onChange={setDirs} preselectRecommended />
      </div>

      <label className="mt-5 block">
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {t("setup.jenkins.label")}
        </span>
        <div className="mt-1">
          <Input
            type="url"
            value={jenkinsBaseUrl}
            onChange={(event) => setJenkinsBaseUrl(event.target.value)}
            placeholder="https://jenkins.example.com"
            className="font-mono"
          />
        </div>
        <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
          {t("setup.jenkins.hint")}
        </span>
      </label>

      <label className="mt-4 block">
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {t("setup.skillsHub.label")}
        </span>
        <div className="mt-1">
          <Input
            type="text"
            value={hubRepoUrl}
            onChange={(event) => setHubRepoUrl(event.target.value)}
            placeholder="git@github.com:team/skills-repo.git"
            className="font-mono"
          />
        </div>
        <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
          {t("setup.skillsHub.hint")}
        </span>
      </label>

      <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">{t("setup.laterHint")}</p>
    </Modal>
  );
}
