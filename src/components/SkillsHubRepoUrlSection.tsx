import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useToast } from "../hooks/useToast";
import * as preferencesApi from "../services/preferencesApi";
import * as skillsHubApi from "../services/skillsHubApi";
import type { SkillsHubStatus } from "../services/skillsHubApi";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { Button } from "./Button";
import { Input } from "./Input";

/** The hub's clone URL (`skillsHub.repoUrl`) — asked before anything else when unset, and offered
 *  for confirmation while it's only detected from an existing clone. */
export function SkillsHubRepoUrlSection({
  status,
  onDone,
}: {
  status: SkillsHubStatus;
  onDone: () => Promise<void>;
}) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [value, setValue] = useState(status.cloneUrl ?? "");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await skillsHubApi.setSkillsHubRepoUrl(value);
      skillsHubApi.notifySkillsHubChanged();
      preferencesApi.notifyPreferencesChanged();
      await onDone();
      showToast(t("skillsHub.repoUrl.saved"), "success");
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "skillsHub.repoUrl.saveError"), "error");
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="mb-5 text-sm text-gray-700 dark:text-gray-300">
      <h3 className="mb-1 font-medium text-gray-900 dark:text-gray-100">
        {t("skillsHub.repoUrl.title")}
      </h3>
      <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
        {status.repoUrlDetected ? t("skillsHub.repoUrl.detected") : t("skillsHub.repoUrl.body")}
      </p>
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            type="text"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="git@github.com:team/skills-repo.git"
            className="font-mono"
          />
        </div>
        <Button
          variant="outline"
          disabled={saving || !value.trim()}
          onClick={() => void save()}
          icon={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
        >
          {t("skillsHub.repoUrl.save")}
        </Button>
      </div>
    </section>
  );
}
