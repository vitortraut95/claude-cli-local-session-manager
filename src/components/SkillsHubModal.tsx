import { FlaskConical, Loader2, Scale, Wand2 } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useSkillsHubStatus } from "../hooks/useSkillsHubStatus";
import type { SkillsHubStatus } from "../services/skillsHubApi";
import { Modal } from "./Modal";
import { SkillPreviewModal } from "./SkillPreviewModal";
import { SkillsCatalogPicker } from "./SkillsCatalogPicker";
import { SkillsHubCloneStatus } from "./SkillsHubCloneStatus";
import { SkillsHubInstallSection } from "./SkillsHubInstallSection";
import { SkillsHubRepoUrlSection } from "./SkillsHubRepoUrlSection";
import { SkillPreferenceSelect } from "./SkillPreferenceSelect";

type SkillsHubModalProps = {
  onClose: () => void;
};

/**
 * Sets up and manages the team skills hub: repo URL, clone, catalog selection, each skill's link
 * state, and updating.
 */
export function SkillsHubModal({ onClose }: SkillsHubModalProps) {
  const { t } = useLanguage();
  const { status, failed, reload } = useSkillsHubStatus(true);
  const [preview, setPreview] = useState<{ catalog: string; name: string } | null>(null);

  return (
    <Modal
      open
      title={t("skillsHub.modal.title")}
      // Escape would otherwise close this modal too while a skill preview is open on top of it.
      onClose={() => {
        if (!preview) onClose();
      }}
      size="xxxl"
      icon={<Wand2 className="h-5 w-5 text-violet-500" />}
    >
      {!status && !failed && (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("skillsHub.loading")}
        </p>
      )}
      {!status && failed && (
        <p className="text-sm text-red-600 dark:text-red-400">{t("skillsHub.loadError")}</p>
      )}
      {status && (status.cloneUrl === null || status.repoUrlDetected) && (
        <SkillsHubRepoUrlSection status={status} onDone={reload} />
      )}
      {status?.cloneUrl != null && !status.found && (
        <SkillsHubInstallSection status={status} onDone={reload} />
      )}
      {status?.found && (
        <ManageSection
          status={status}
          onChanged={reload}
          onPreview={(catalog, name) => setPreview({ catalog, name })}
        />
      )}
      {preview && (
        <SkillPreviewModal
          catalog={preview.catalog}
          name={preview.name}
          onClose={() => setPreview(null)}
        />
      )}
    </Modal>
  );
}

/** Hub cloned: its state, the catalog selection and the task test skill. */
function ManageSection({
  status,
  onChanged,
  onPreview,
}: {
  status: SkillsHubStatus;
  onChanged: () => Promise<void>;
  onPreview: (catalog: string, name: string) => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-5 text-sm text-gray-700 dark:text-gray-300">
      <p className="text-gray-600 dark:text-gray-400">
        {t("skillsHub.manage.intro", { dir: status.userSkillsDir })}
      </p>

      <SkillsHubCloneStatus status={status} onChanged={onChanged} />

      <SkillsCatalogPicker status={status} onChanged={onChanged} onPreview={onPreview} />

      {status.installedSkills && (
        <section className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
          <h3 className="mb-1 font-medium text-gray-900 dark:text-gray-100">
            {t("taskTestSkill.title")}
          </h3>
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
            {t("taskTestSkill.description")}
          </p>
          <SkillPreferenceSelect
            preference="taskTestSkill"
            icon={<FlaskConical className="h-3.5 w-3.5" />}
            label={t("taskTestSkill.title")}
            skillsHub={status}
          />
        </section>
      )}

      {status.installedSkills && (
        <section className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
          <h3 className="mb-1 font-medium text-gray-900 dark:text-gray-100">
            {t("taskRefinementSkill.title")}
          </h3>
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
            {t("taskRefinementSkill.description")}
          </p>
          <SkillPreferenceSelect
            preference="taskRefinementSkill"
            icon={<Scale className="h-3.5 w-3.5" />}
            label={t("taskRefinementSkill.title")}
            skillsHub={status}
          />
        </section>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400">
        {t("skillsHub.manage.newSessionsNote")}
      </p>
    </div>
  );
}
