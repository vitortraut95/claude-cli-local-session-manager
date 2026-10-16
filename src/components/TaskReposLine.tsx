import { ExternalLink, Layers, Loader2 } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useToast } from "../hooks/useToast";
import * as tasksApi from "../services/tasksApi";
import type { Session, TaskRepoRef } from "../types/session";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { Tooltip } from "./Tooltip";

type TaskReposLineProps = {
  session: Session;
  onFilterByTask: (taskKey: string) => void;
};

const CHIP_CLASSNAME =
  "inline-flex items-center gap-1 rounded-full border border-gray-300 px-1.5 py-px text-[11px] " +
  "text-gray-700 hover:bg-gray-100 disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 " +
  "dark:hover:bg-gray-800";

/**
 * The card's "Task: PROJ-123 · also in: cart, checkout" line — the other repos/branches of the
 * same multi-repo task (`Session.taskRepos`, see server `taskRepos.ts`). The key filters the list
 * down to that task; a repo with sessions of its own is reached the same way, while one with no
 * session yet (linked to the task, e.g. to work on it via `/add-dir`) opens its PR directly.
 */
export function TaskReposLine({ session, onFilterByTask }: TaskReposLineProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [openingPrFor, setOpeningPrFor] = useState<string | null>(null);
  const taskKey = session.taskKey;
  if (!taskKey) return null;

  const others = (session.taskRepos ?? []).filter(
    (repo) => !(repo.repoRoot === session.repoRoot && repo.branch === session.gitBranch),
  );

  const openRepoPr = async (repo: TaskRepoRef) => {
    const id = `${repo.repoRoot}\0${repo.branch}`;
    setOpeningPrFor(id);
    try {
      const url = await tasksApi.fetchTaskRepoPrUrl(
        taskKey,
        repo.repoRoot,
        repo.branch,
        repo.baseBranch ?? "",
      );
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "sessionCard.task.openPrError"), "error");
    } finally {
      setOpeningPrFor(null);
    }
  };

  const keyTooltip = session.taskKeyInferred
    ? `${t("sessionCard.task.filter")}\n${t("sessionCard.task.inferred")}`
    : t("sessionCard.task.filter");

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
      <Layers className="h-3.5 w-3.5 shrink-0" />
      <span>{t("sessionCard.task.label")}</span>
      <Tooltip content={<span className="whitespace-pre-line">{keyTooltip}</span>}>
        <button
          type="button"
          onClick={() => onFilterByTask(taskKey)}
          className={`font-medium text-gray-800 underline-offset-2 hover:underline dark:text-gray-200 ${
            session.taskKeyInferred ? "decoration-dashed" : ""
          }`}
        >
          {taskKey}
        </button>
      </Tooltip>
      {others.length > 0 && (
        <>
          <span>· {t("sessionCard.task.alsoIn")}</span>
          {others.map((repo) => {
            const id = `${repo.repoRoot}\0${repo.branch}`;
            const hasSessions = repo.sessionIds.length > 0;
            const tooltip = hasSessions
              ? t(
                  repo.sessionIds.length === 1
                    ? "sessionCard.task.repoSessions.one"
                    : "sessionCard.task.repoSessions.many",
                  { branch: repo.branch, count: repo.sessionIds.length },
                )
              : t("sessionCard.task.repoNoSession", { branch: repo.branch });
            return (
              <Tooltip key={id} content={tooltip}>
                <button
                  type="button"
                  className={CHIP_CLASSNAME}
                  disabled={openingPrFor === id}
                  onClick={() => (hasSessions ? onFilterByTask(taskKey) : void openRepoPr(repo))}
                >
                  {repo.project}
                  {!hasSessions &&
                    (openingPrFor === id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <ExternalLink className="h-3 w-3" />
                    ))}
                </button>
              </Tooltip>
            );
          })}
        </>
      )}
    </div>
  );
}
