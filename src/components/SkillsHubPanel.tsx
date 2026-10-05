import { AlertTriangle, Sparkles } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import * as tasksApi from "../services/tasksApi";
import type { SkillsHubStatus } from "../services/tasksApi";
import { Button } from "./Button";

type SkillsHubPanelProps = {
  status: SkillsHubStatus | null;
  onManage: () => void;
};

/**
 * The New Task modal's one-glance view of the team skills (skills-hub). Never blocks
 * anything: without the hub it's an invite (dismissable — then just a small link), with it a
 * single status line saying what the "update skills" step will do. Renders nothing while the
 * status is unknown (still loading, or a backend without these routes).
 */
export function SkillsHubPanel({ status, onManage }: SkillsHubPanelProps) {
  const { t } = useLanguage();
  const [dismissing, setDismissing] = useState(false);

  if (!status) return null;

  if (!status.found) {
    if (status.inviteDismissed) {
      return (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          <Button variant="link" size="none" className="text-xs underline" onClick={onManage}>
            {t("skillsHub.panel.setupLink")}
          </Button>
        </p>
      );
    }
    const dismiss = async () => {
      setDismissing(true);
      try {
        await tasksApi.setSkillsHubFlags({ inviteDismissed: true });
        tasksApi.notifySkillsHubChanged();
      } catch {
        // Not worth an error toast — the invite just stays visible.
      } finally {
        setDismissing(false);
      }
    };
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-violet-200 bg-violet-50 p-3 text-xs dark:border-violet-900/60 dark:bg-violet-950/30">
        <Sparkles className="h-4 w-4 shrink-0 text-violet-500" />
        <p className="min-w-0 flex-1 text-violet-800 dark:text-violet-300">
          <span className="font-medium">{t("skillsHub.invite.title")}</span>{" "}
          {t("skillsHub.panel.inviteShort")}
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="ghost" size="sm" onClick={() => void dismiss()} disabled={dismissing}>
            {t("skillsHub.panel.notNow")}
          </Button>
          <Button size="sm" onClick={onManage}>
            {t("skillsHub.panel.setup")}
          </Button>
        </div>
      </div>
    );
  }

  if (status.selectedCatalogs.length === 0 && status.selectedSkills.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-violet-200 bg-violet-50 p-3 text-xs dark:border-violet-900/60 dark:bg-violet-950/30">
        <Sparkles className="h-4 w-4 shrink-0 text-violet-500" />
        <p className="min-w-0 flex-1 text-violet-800 dark:text-violet-300">
          {t("skillsHub.panel.chooseCatalogs")}
        </p>
        <Button size="sm" onClick={onManage}>
          {t("skillsHub.panel.choose")}
        </Button>
      </div>
    );
  }

  const linked = status.skills.filter((s) => s.state === "linked").length;
  const pending = status.skills.filter((s) => s.state === "missing" || s.state === "broken").length;
  const conflicts = status.skills.filter((s) => s.state === "conflict").length;
  const offDefault =
    status.branch !== null &&
    status.defaultBranch !== null &&
    status.branch !== status.defaultBranch;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 dark:border-gray-800 dark:text-gray-400">
      <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-500" />
      <span>
        {t("skillsHub.panel.summary", {
          count: linked,
          catalogs: [...new Set(status.skills.map((skill) => skill.catalog))].join(", "),
        })}
      </span>
      {pending > 0 && (
        <span className="text-blue-700 dark:text-blue-400">
          {t("skillsHub.panel.pending", { count: pending })}
        </span>
      )}
      {conflicts > 0 && (
        <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3" />
          {t("skillsHub.panel.conflicts", { count: conflicts })}
        </span>
      )}
      {offDefault && (
        <span className="text-amber-700 dark:text-amber-400">
          {t("skillsHub.panel.offDefault", { branch: status.branch ?? "" })}
        </span>
      )}
      {status.behind !== null && status.behind > 0 && (
        <span className="text-blue-700 dark:text-blue-400">
          {t("skillsHub.panel.behind", { count: status.behind })}
        </span>
      )}
      <Button variant="link" size="none" className="ml-auto text-xs underline" onClick={onManage}>
        {t("skillsHub.panel.manage")}
      </Button>
    </div>
  );
}
