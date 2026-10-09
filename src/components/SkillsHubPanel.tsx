import { AlertTriangle, Wand2 } from "lucide-react";
import type { ReactNode } from "react";
import { useLanguage } from "../hooks/useLanguage";
import type { SkillsHubStatus } from "../services/tasksApi";
import { Button } from "./Button";

type SkillsHubPanelProps = {
  status: SkillsHubStatus | null;
  /** The status load failed (or the backend has no such route) — the panel stays hidden. */
  failed: boolean;
  onManage: () => void;
};

/** Every state shares this box (same border, padding and minimum height — room for a small
 *  button), so switching from the loading placeholder to the real content never changes the
 *  modal's height. */
function PanelShell({ tone, children }: { tone: "invite" | "neutral"; children: ReactNode }) {
  const toneClasses =
    tone === "invite"
      ? "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300"
      : "border-gray-200 text-gray-600 dark:border-gray-800 dark:text-gray-400";
  return (
    <div
      className={`flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-sm ${toneClasses}`}
    >
      <Wand2 className="h-4 w-4 shrink-0 text-violet-500" />
      {children}
    </div>
  );
}

/**
 * The New Task modal's one-glance view of the team skills hub. Never blocks
 * anything: without the hub it's a "Set up" invite (always shown, not dismissable — a repo URL
 * saved as "" is how someone opts out), with it a single status line plus "Manage". While the
 * status is still loading it holds the same space with a placeholder; it renders nothing only when
 * the hub is opted out or the status can't be loaded.
 */
export function SkillsHubPanel({ status, failed, onManage }: SkillsHubPanelProps) {
  const { t } = useLanguage();

  if (!status) {
    if (failed) return null;
    return (
      <PanelShell tone="neutral">
        <span className="sr-only">{t("skillsHub.loading")}</span>
        <span
          aria-hidden
          className="h-3 w-56 max-w-full animate-pulse rounded bg-gray-200 dark:bg-gray-800"
        />
        <span
          aria-hidden
          className="ml-auto h-3 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-800"
        />
      </PanelShell>
    );
  }
  if (status.notUsed) return null;

  if (!status.found) {
    return (
      <PanelShell tone="invite">
        <p className="min-w-0 flex-1">
          <span className="font-medium">{t("skillsHub.invite.title")}</span>{" "}
          {t("skillsHub.panel.inviteShort", { dir: status.userSkillsDir })}
        </p>
        <Button size="sm" onClick={onManage}>
          {t("skillsHub.panel.setup")}
        </Button>
      </PanelShell>
    );
  }

  if (status.selectedCatalogs.length === 0 && status.selectedSkills.length === 0) {
    return (
      <PanelShell tone="invite">
        <p className="min-w-0 flex-1">{t("skillsHub.panel.chooseCatalogs")}</p>
        <Button size="sm" onClick={onManage}>
          {t("skillsHub.panel.choose")}
        </Button>
      </PanelShell>
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
    <PanelShell tone="neutral">
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
          <AlertTriangle className="h-3.5 w-3.5" />
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
      <Button variant="outline" size="sm" className="ml-auto" onClick={onManage}>
        {t("skillsHub.panel.manage")}
      </Button>
    </PanelShell>
  );
}
