import { useEffect, useState } from "react";
import * as preferencesApi from "../services/preferencesApi";
import { useSkillsHubStatus } from "./useSkillsHubStatus";

/**
 * The code review skill (`taskReviewSkill`) and whether it's chosen and installed: the code
 * review automation queues reviews that run it, so it can't be on without one. `skill` null =
 * still loading; `ready` stays false until both the preference and the installed skills loaded.
 */
export function useReviewSkill(enabled = true) {
  const { status: skillsHub } = useSkillsHubStatus(enabled);
  const [skill, setSkill] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = () => {
      preferencesApi
        .fetchPreferences()
        .then((prefs) => {
          if (!cancelled) setSkill(prefs.taskReviewSkill ?? "");
        })
        .catch(() => undefined);
    };
    load();
    window.addEventListener(preferencesApi.PREFERENCES_CHANGED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(preferencesApi.PREFERENCES_CHANGED_EVENT, load);
    };
  }, [enabled]);

  const loaded = skill !== null && Boolean(skillsHub?.installedSkills);
  const ready =
    loaded && Boolean(skill) && skillsHub?.installedSkills.some((s) => s.name === skill) === true;
  return { skillsHub, loaded, ready };
}
