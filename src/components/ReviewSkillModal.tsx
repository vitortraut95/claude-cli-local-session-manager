import { GitPullRequest } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useReviewSkill } from "../hooks/useReviewSkill";
import * as boardWatcherApi from "../services/boardWatcherApi";
import { Modal } from "./Modal";
import { SkillPreferenceSelect } from "./SkillPreferenceSelect";

/**
 * Asks for the code review skill when the code review automation is on without one chosen and
 * installed: the reviews it queues would fail to launch. Shown on every load until then; "Not
 * now" only skips it for this page load.
 */
export function ReviewSkillModal({ automationsOn }: { automationsOn: boolean }) {
  const { t } = useLanguage();
  const [codeReviewOn, setCodeReviewOn] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const { skillsHub, loaded, ready } = useReviewSkill(automationsOn);

  useEffect(() => {
    if (!automationsOn) return;
    let cancelled = false;
    boardWatcherApi
      .fetchAutomationSettings()
      .then((settings) => {
        if (!cancelled) {
          setCodeReviewOn(settings.configured && settings.enabled && settings.features.codeReview);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [automationsOn]);

  const open = automationsOn && codeReviewOn && loaded && !ready && !skipped;
  return (
    <Modal
      open={open}
      title={t("reviewSkillModal.title")}
      icon={<GitPullRequest className="h-5 w-5 text-gray-500 dark:text-gray-400" />}
      onClose={() => setSkipped(true)}
      onCancel={() => setSkipped(true)}
      cancelLabel={t("setup.skip")}
      size="md"
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">{t("reviewSkillModal.intro")}</p>
        {skillsHub?.installedSkills && (
          <SkillPreferenceSelect
            preference="taskReviewSkill"
            icon={<GitPullRequest className="h-3.5 w-3.5" />}
            label={t("taskReviewSkill.title")}
            skillsHub={skillsHub}
          />
        )}
      </div>
    </Modal>
  );
}
