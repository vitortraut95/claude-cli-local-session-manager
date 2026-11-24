import type { TranslationKey } from "../i18n/translations";
import type { SkillsHubSyncResult } from "../services/skillsHubApi";

export type SyncSummary = {
  /** Worth flagging (offline, update skipped, name conflicts), never fatal. */
  warning: boolean;
  text: string;
  /** Set when the remote had commits that weren't applied: why, and what to do about it. */
  notUpdated: { reason: string; files: string[]; error: string | null; hint: string } | null;
};

/** Summary of a skills-hub sync. */
export function describeSync(
  result: SkillsHubSyncResult,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
): SyncSummary {
  const parts: string[] = [];
  let warning = false;
  let notUpdated: SyncSummary["notUpdated"] = null;
  if (!result.fetched) {
    warning = true;
    parts.push(t("skillsHub.sync.fetchFailed"));
  }
  const { branch, defaultBranch, upstream } = result.status;
  // Off the default branch, "updated" must name the branch, or it reads as if the default moved.
  const offDefault = defaultBranch !== null && branch !== defaultBranch;
  const branchParams = {
    branch: branch ?? "HEAD",
    defaultBranch: defaultBranch ?? "",
    upstream: upstream ?? "",
  };
  if (offDefault) warning = true;
  if (result.pulledCommits > 0) {
    parts.push(
      offDefault
        ? t("skillsHub.sync.pulledOffDefault", { ...branchParams, count: result.pulledCommits })
        : t("skillsHub.sync.pulled", { count: result.pulledCommits }),
    );
  } else if (result.pullSkippedReason) {
    warning = true;
    const count = result.status.behind ?? 0;
    notUpdated =
      result.pullSkippedReason === "dirty"
        ? {
            reason: t("skillsHub.sync.skippedDirty", { count }),
            files: result.localChanges ?? [],
            error: null,
            hint: t("skillsHub.sync.skippedDirtyHint"),
          }
        : result.pullSkippedReason === "diverged"
          ? {
              reason: t("skillsHub.sync.skippedDiverged", {
                count,
                ahead: result.status.ahead ?? 0,
                branch: branchParams.branch,
              }),
              files: [],
              error: null,
              hint: t("skillsHub.sync.skippedDivergedHint"),
            }
          : {
              reason: t("skillsHub.sync.skippedFailed", { count }),
              files: [],
              error: result.pullError ?? null,
              hint: t("skillsHub.sync.skippedFailedHint"),
            };
  } else if (offDefault && !upstream) {
    parts.push(t("skillsHub.sync.noUpstreamOffDefault", branchParams));
  } else if (result.fetched) {
    parts.push(
      offDefault
        ? t("skillsHub.sync.upToDateOffDefault", branchParams)
        : t("skillsHub.sync.upToDate"),
    );
  }
  if (result.links.linked.length > 0) {
    parts.push(t("skillsHub.sync.linked", { names: result.links.linked.join(", ") }));
  }
  if (result.links.conflicts.length > 0) {
    warning = true;
    parts.push(t("skillsHub.sync.conflicts", { names: result.links.conflicts.join(", ") }));
  }
  return { warning, text: parts.join(" · "), notUpdated };
}
