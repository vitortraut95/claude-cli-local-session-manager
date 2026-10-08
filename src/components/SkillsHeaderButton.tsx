import { AlertTriangle, Loader2, Wand2 } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import type { SkillsHubStatus } from "../services/tasksApi";
import { Button } from "./Button";
import { Tooltip } from "./Tooltip";

type SkillsHeaderButtonProps = {
  status: SkillsHubStatus | null;
  /** The status load failed (or the backend has no such route) — a plain button, no count. */
  failed: boolean;
  onClick: () => void;
};

/**
 * Header entry point to the team skills (opens SkillsHubModal, which asks for the repo first when
 * it isn't set and otherwise manages the selection). Amber with a warning icon while the repo isn't
 * configured or its clone isn't on this machine; once installed, shows how many skills are linked.
 * A repo URL saved as "" (team doesn't use one) gets a plain button, no warning.
 */
export function SkillsHeaderButton({ status, failed, onClick }: SkillsHeaderButtonProps) {
  const { t } = useLanguage();

  const warning =
    status && !status.notUsed && (status.cloneUrl === null || !status.found)
      ? status.cloneUrl === null
        ? t("header.skills.notConfigured")
        : t("header.skills.notInstalled")
      : null;

  if (warning) {
    return (
      <Tooltip content={warning}>
        <Button
          variant="unstyled"
          className="gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/70"
          onClick={onClick}
          icon={<AlertTriangle className="h-4 w-4" />}
        >
          {t("header.skills")}
        </Button>
      </Tooltip>
    );
  }

  const linked = status?.found ? status.skills.filter((s) => s.state === "linked").length : null;
  const loading = status === null && !failed;

  return (
    <Tooltip
      content={linked !== null ? t("header.skills.active", { count: linked }) : t("header.skills")}
    >
      <Button
        variant="outline"
        onClick={onClick}
        icon={<Wand2 className="h-4 w-4 text-violet-500" />}
      >
        {t("header.skills")}
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
        {linked !== null && (
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
            {linked}
          </span>
        )}
      </Button>
    </Tooltip>
  );
}
