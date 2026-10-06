import { Plug } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { LEGACY_ENV_JENKINS_BASE_URL } from "../hooks/useTeamLinks";
import { useToast } from "../hooks/useToast";
import * as tasksApi from "../services/tasksApi";
import type { UserPreferences } from "../services/tasksApi";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { Input } from "./Input";
import { Modal } from "./Modal";

type TeamIntegrationsPromptModalProps = {
  /** The preferences that triggered the prompt — its never-set (null) fields get prefilled. */
  prefs: UserPreferences;
  onSaved: () => void;
  /** "Not now" — only for this page load; the prompt comes back on the next start until saved. */
  onSkip: () => void;
};

/**
 * Asked on app start while `jenkinsBaseUrl` or `skillsHub.repoUrl` was never saved (null) — see
 * Header. Both are company-specific, so they live only in the local userPreferences.json, never in
 * this public repo. Prefilled from what this machine already uses (the legacy
 * `VITE_JENKINS_BASE_URL` in `.env`, the `origin` of an existing hub clone), so someone who had it
 * working before only confirms. An empty field saves "" (explicitly not used) and stops the prompt.
 */
export function TeamIntegrationsPromptModal({
  prefs,
  onSaved,
  onSkip,
}: TeamIntegrationsPromptModalProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [jenkinsBaseUrl, setJenkinsBaseUrl] = useState(
    prefs.jenkinsBaseUrl ?? LEGACY_ENV_JENKINS_BASE_URL,
  );
  const [hubRepoUrl, setHubRepoUrl] = useState(prefs.skillsHub?.repoUrl ?? "");
  const [hubDetected, setHubDetected] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (prefs.skillsHub?.repoUrl != null) return;
    let cancelled = false;
    tasksApi
      .fetchDetectedHubRepoUrl()
      .then((detected) => {
        if (cancelled || !detected) return;
        // Only while the user hasn't typed something else already.
        setHubRepoUrl((current) => (current === "" ? detected : current));
        setHubDetected(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [prefs.skillsHub?.repoUrl]);

  const prefilled =
    (prefs.jenkinsBaseUrl == null && LEGACY_ENV_JENKINS_BASE_URL !== "") || hubDetected;

  const handleSave = async () => {
    setSaving(true);
    try {
      await tasksApi.updatePreferences({ jenkinsBaseUrl: jenkinsBaseUrl.trim() });
      await tasksApi.setSkillsHubRepoUrl(hubRepoUrl.trim());
      tasksApi.notifyPreferencesChanged();
      tasksApi.notifySkillsHubChanged();
      showToast(t("teamPrompt.saved"), "success");
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
      title={t("teamPrompt.title")}
      onClose={onSkip}
      onCancel={onSkip}
      onConfirm={() => void handleSave()}
      cancelLabel={t("teamPrompt.skip")}
      confirmLabel={t("teamPrompt.save")}
      isConfirmLoading={saving}
      size="lg"
      icon={<Plug className="h-5 w-5 text-gray-500 dark:text-gray-400" />}
    >
      <p className="text-sm text-gray-600 dark:text-gray-400">{t("teamPrompt.intro")}</p>
      {prefilled && (
        <p className="mt-2 text-xs text-green-700 dark:text-green-400">
          {t("teamPrompt.prefilled")}
        </p>
      )}
      <label className="mt-4 block">
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {t("teamPrompt.jenkins.label")}
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
          {t("teamPrompt.jenkins.hint")}
        </span>
      </label>
      <label className="mt-4 block">
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {t("teamPrompt.skillsHub.label")}
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
          {t("teamPrompt.skillsHub.hint")}
        </span>
      </label>
      <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        {t("workspaceDirsPrompt.laterHint")}
      </p>
    </Modal>
  );
}
