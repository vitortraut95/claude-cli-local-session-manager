import { ExternalLink, Layers, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useToast } from "../hooks/useToast";
import * as tasksApi from "../services/tasksApi";
import type { Session, TaskRepoRef } from "../types/session";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { AnchoredMenu } from "./AnchoredMenu";
import { Tooltip } from "./Tooltip";

type TaskReposLineProps = {
  session: Session;
  onFilterByTask: (taskKey: string) => void;
  onAddRepo: () => void;
};

const CHIP_CLASSNAME =
  "inline-flex items-center gap-1 rounded-full border border-gray-300 px-1.5 py-px text-[11px] " +
  "text-gray-700 hover:bg-gray-100 disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 " +
  "dark:hover:bg-gray-800";

/**
 * The card's "Task: PROJ-123 · also in: cart" line (two or more other repos go in an "also in N
 * repos" menu). The key, and a repo with sessions, put the task key in the search box; a repo
 * without sessions opens its PR directly.
 */
export function TaskReposLine({ session, onFilterByTask, onAddRepo }: TaskReposLineProps) {
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

  /** A repo of the task: a chip on the line, or a row (with its branch) in the menu. */
  const renderRepo = (
    repo: TaskRepoRef,
    className: string,
    showBranch: boolean,
    close?: () => void,
  ) => {
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
          className={className}
          disabled={openingPrFor === id}
          onClick={() => {
            close?.();
            if (hasSessions) onFilterByTask(taskKey);
            else void openRepoPr(repo);
          }}
        >
          <span>
            {repo.project}
            {showBranch && (
              <span className="ml-1.5 font-mono text-gray-400 dark:text-gray-500">
                {repo.branch}
              </span>
            )}
          </span>
          {!hasSessions &&
            (openingPrFor === id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ExternalLink className="h-3 w-3" />
            ))}
        </button>
      </Tooltip>
    );
  };

  const keyTooltip = session.taskKeyInferred
    ? `${t("sessionCard.task.filter")}\n${t("sessionCard.task.inferred")}`
    : t("sessionCard.task.filter");

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
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
      {others.length === 1 && (
        <>
          <span>· {t("sessionCard.task.alsoIn")}</span>
          {others.map((repo) => renderRepo(repo, CHIP_CLASSNAME, false))}
        </>
      )}
      {others.length > 1 && (
        <AnchoredMenu
          buttonClassName={CHIP_CLASSNAME}
          label={t("sessionCard.task.alsoInCount", { count: others.length })}
        >
          {(close) =>
            others.map((repo) =>
              renderRepo(
                repo,
                "flex w-full items-center justify-between gap-3 rounded-md px-2 py-1 text-left text-gray-700 hover:bg-gray-100 disabled:opacity-60 dark:text-gray-300 dark:hover:bg-gray-800",
                true,
                close,
              ),
            )
          }
        </AnchoredMenu>
      )}
      <Tooltip content={t("taskModal.addRepoShortcut")}>
        <button
          type="button"
          onClick={onAddRepo}
          aria-label={t("taskModal.addRepoShortcut")}
          className={CHIP_CLASSNAME}
        >
          <Plus className="h-3 w-3" />
        </button>
      </Tooltip>
    </div>
  );
}
