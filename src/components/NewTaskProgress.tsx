import { useLanguage } from "../hooks/useLanguage";
import type { NewTaskForm } from "../hooks/useNewTaskForm";
import { StepList } from "./StepList";

/** The live step checklist of a create attempt or, while idle, what creating will do. */
export function NewTaskProgress({ form }: { form: NewTaskForm }) {
  const { t } = useLanguage();
  const { steps, trimmedFolder, trimmedBase, trimmedBranch, useLocalBaseBranch, useWorktree } =
    form;

  if (steps.length > 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/50">
        <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          {t("newTaskModal.progressLabel")}
        </p>
        <StepList steps={steps} />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-400">
      <p className="mb-2 font-medium text-gray-700 dark:text-gray-300">
        {t("newTaskModal.whatWillHappen")}
      </p>
      <ol className="list-decimal space-y-1 pl-5">
        <li>
          {t("newTaskModal.explain.repo.pre")}{" "}
          <span className="font-mono text-gray-800 dark:text-gray-200">
            {trimmedFolder || t("newTaskModal.explain.folderPlaceholder")}
          </span>{" "}
          {t("newTaskModal.explain.repo.post")}
        </li>
        <li>
          {t(
            useLocalBaseBranch
              ? "newTaskModal.explain.base.pre.local"
              : "newTaskModal.explain.base.pre.remote",
          )}{" "}
          <span className="font-mono text-gray-800 dark:text-gray-200">
            {trimmedBase || t("newTaskModal.explain.basePlaceholder")}
          </span>{" "}
          {t(
            useLocalBaseBranch
              ? "newTaskModal.explain.base.post.local"
              : "newTaskModal.explain.base.post.remote",
          )}
        </li>
        <li>
          {t("newTaskModal.explain.branch.pre")}{" "}
          <span className="font-mono text-gray-800 dark:text-gray-200">
            {trimmedBranch || t("newTaskModal.explain.branchPlaceholder")}
          </span>{" "}
          {t("newTaskModal.explain.branch.post")}
        </li>
        <li>
          {useWorktree
            ? t("newTaskModal.explain.worktree.create")
            : t("newTaskModal.explain.worktree.skip")}
        </li>
        <li>
          {t("newTaskModal.explain.launch.pre")}{" "}
          {useWorktree
            ? t("newTaskModal.explain.launch.insideWorktree")
            : t("newTaskModal.explain.launch.inProjectFolder")}{" "}
          {t("newTaskModal.explain.launch.and")} <code>claude</code>{" "}
          {t("newTaskModal.explain.launch.post")}
        </li>
      </ol>
    </div>
  );
}
