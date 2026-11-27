import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import {
  isBlockingIssue,
  newDependencies,
  withPicks,
  type SkillsHubIssue,
} from "../../shared/skillsHub";
import { useDependencyNote } from "../hooks/useDependencyNote";
import { useLanguage } from "../hooks/useLanguage";
import { useToast } from "../hooks/useToast";
import * as skillsHubApi from "../services/skillsHubApi";
import type { SkillsHubStatus, SkillsSelection } from "../services/skillsHubApi";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { Button } from "./Button";
import { SkillsChangeDialog, type SkillsChangeRequest } from "./SkillsChangeDialog";

/**
 * "Actions needed" on top of the skills modal: what's wrong with the skills you use and, when the
 * app can fix it, a button that first shows what it will link.
 */
export function SkillsHubIssues({
  status,
  onChanged,
}: {
  status: SkillsHubStatus;
  onChanged: () => Promise<void>;
}) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const dependencyNote = useDependencyNote(status.catalogs);
  const [dialog, setDialog] = useState<SkillsChangeRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const issues = status.issues ?? [];
  if (issues.length === 0) return null;

  const saved: SkillsSelection = {
    catalogs: status.selectedCatalogs,
    skills: status.selectedSkills,
  };

  const applySelection = async (selection: SkillsSelection) => {
    setBusy(true);
    try {
      const result = await skillsHubApi.setSkillsHubSelection(selection);
      skillsHubApi.notifySkillsHubChanged();
      await onChanged();
      showToast(
        t("skillsHub.catalogsApplied", {
          linked: result.linked.length,
          unlinked: result.unlinked.length,
        }),
        "success",
      );
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "skillsHub.catalogsApplyError"), "error");
    } finally {
      setBusy(false);
      setDialog(null);
    }
  };

  const askLink = (skills: string[]) =>
    setDialog({
      title: t("skillsHub.issues.linkTitle"),
      message: t("skillsHub.plan.message", { dir: status.userSkillsDir }),
      groups: [
        {
          label: t("skillsHub.plan.link"),
          tone: "add",
          items: skills.map((id) => ({ name: id, note: dependencyNote(saved, id) })),
        },
      ],
      confirmLabel: t("skillsHub.plan.confirm"),
      onConfirm: () => applySelection(saved),
    });

  const askInstall = (hubSkill: string) => {
    const next = withPicks(saved, [hubSkill]);
    const deps = newDependencies(status.catalogs, saved, next);
    const target = withPicks(next, deps);
    setDialog({
      title: t("skillsHub.issues.installTitle", { skill: hubSkill }),
      message: t("skillsHub.plan.message", { dir: status.userSkillsDir }),
      groups: [
        {
          label: t("skillsHub.plan.link"),
          tone: "add",
          items: [hubSkill, ...deps].map((id) => ({ name: id, note: dependencyNote(target, id) })),
        },
      ],
      confirmLabel: t("skillsHub.issues.install"),
      onConfirm: () => applySelection(target),
    });
  };

  const blocking = issues.some(isBlockingIssue);
  return (
    <section
      className={`rounded-lg border p-3 ${
        blocking
          ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
          : "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
      }`}
    >
      <h3
        className={`mb-2 flex items-center gap-1.5 font-medium ${
          blocking ? "text-red-800 dark:text-red-300" : "text-amber-800 dark:text-amber-300"
        }`}
      >
        <AlertTriangle className="h-4 w-4" />
        {t("skillsHub.issues.title", { count: issues.length })}
      </h3>
      <ul className="flex flex-col gap-2">
        {issues.map((issue, index) => (
          <li
            key={`${issue.kind}-${index}`}
            className="flex flex-wrap items-center justify-between gap-2 text-gray-800 dark:text-gray-200"
          >
            <span className="min-w-0 flex-1">{describe(issue)}</span>
            {issue.kind === "unlinked" && (
              <Button size="sm" onClick={() => askLink(issue.skills)}>
                {t("skillsHub.issues.linkNow")}
              </Button>
            )}
            {issue.kind === "preferenceSkillMissing" && issue.hubSkill && (
              <Button size="sm" onClick={() => askInstall(issue.hubSkill!)}>
                {t("skillsHub.issues.install")}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {dialog && (
        <SkillsChangeDialog request={dialog} busy={busy} onCancel={() => setDialog(null)} />
      )}
    </section>
  );

  function describe(issue: SkillsHubIssue): string {
    switch (issue.kind) {
      case "unlinked":
        return t("skillsHub.issues.unlinked", { names: issue.skills.join(", ") });
      case "unknownDependency":
        return t("skillsHub.issues.unknownDependency", {
          skill: issue.skill,
          dependency: issue.dependency,
        });
      case "dependencyConflict":
        return t("skillsHub.issues.dependencyConflict", {
          skill: issue.skill,
          dependency: issue.dependency,
          path: issue.conflictWith,
        });
      case "preferenceSkillMissing":
        return t(
          issue.hubSkill
            ? "skillsHub.issues.preferenceMissing"
            : "skillsHub.issues.preferenceMissingNoHub",
          { preference: t(`${issue.preference}.title`), skill: issue.skill },
        );
    }
  }
}
