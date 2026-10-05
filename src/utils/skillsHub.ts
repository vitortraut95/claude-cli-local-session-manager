import type { TranslationKey } from "../i18n/translations";
import type { SkillsHubSyncResult } from "../services/tasksApi";

/** One-line human summary of a skills-hub sync — shown under the management modal's "Update now".
 *  `warning` = worth flagging (offline, update skipped, name conflicts), though never fatal. */
export function describeSync(
  result: SkillsHubSyncResult,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
): { warning: boolean; text: string } {
  const parts: string[] = [];
  let warning = false;
  if (!result.fetched) {
    warning = true;
    parts.push(t("skillsHub.sync.fetchFailed"));
  } else if (result.pulledCommits > 0) {
    parts.push(t("skillsHub.sync.pulled", { count: result.pulledCommits }));
  } else if (result.pullSkippedReason) {
    warning = true;
    parts.push(
      t(
        result.pullSkippedReason === "dirty"
          ? "skillsHub.sync.skippedDirty"
          : result.pullSkippedReason === "diverged"
            ? "skillsHub.sync.skippedDiverged"
            : "skillsHub.sync.skippedFailed",
      ),
    );
  } else {
    parts.push(t("skillsHub.sync.upToDate"));
  }
  if (result.links.linked.length > 0) {
    parts.push(t("skillsHub.sync.linked", { names: result.links.linked.join(", ") }));
  }
  if (result.links.conflicts.length > 0) {
    warning = true;
    parts.push(t("skillsHub.sync.conflicts", { names: result.links.conflicts.join(", ") }));
  }
  return { warning, text: parts.join(" · ") };
}
