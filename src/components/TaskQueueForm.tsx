import { useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useToast } from "../hooks/useToast";
import type { ProjectFolderOption, QueueKind } from "../services/tasksApi";
import { type DraftEntry, NO_REPO_VALUE, parsePastedTasks } from "../utils/taskQueue";
import { Button } from "./Button";
import { Input } from "./Input";
import { SettingRow } from "./SettingRow";
import { Select } from "./Select";
import { TaskQueueKindPicker } from "./TaskQueueKind";
import { TaskQueuePrefixSelect } from "./TaskQueuePrefixSelect";

const TEXTAREA_CLASSNAME =
  "w-full rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900 placeholder:text-gray-400 " +
  "focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 " +
  "dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-gray-600 " +
  "dark:focus:ring-gray-100/10";

type TaskQueueFormProps = {
  projects: ProjectFolderOption[];
  branchTypes: string[];
  /** Keys already in the list: pasting one again is reported, not added. */
  listedKeys: Set<string>;
  onAdd: (entries: DraftEntry[]) => void;
};

/** Paste tickets and the setup they share; the kind is picked first, the rest shows up after. */
export function TaskQueueForm({ projects, branchTypes, listedKeys, onAdd }: TaskQueueFormProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [pasteText, setPasteText] = useState("");
  const [pasteRepo, setPasteRepo] = useState("");
  // No default on purpose: env/feature/fix/none changes what the pipeline does with the branch.
  const [pastePrefix, setPastePrefix] = useState<string | null>(null);
  // Chosen first: the other fields only show up once it is.
  const [pasteKind, setPasteKind] = useState<QueueKind | null>(null);
  // "" = each repo's default branch.
  const [pasteBase, setPasteBase] = useState("");
  const [pasteUseLocalBase, setPasteUseLocalBase] = useState(false);

  const handleAdd = () => {
    if (!pasteKind) return;
    const pasted = parsePastedTasks(pasteText);
    if (pasted.length === 0) {
      showToast(t("taskQueueModal.noneFound"), "error");
      return;
    }
    const fresh = pasted.filter((task) => !listedKeys.has(task.key));
    const repeated = pasted.filter((task) => listedKeys.has(task.key)).map((task) => task.key);
    onAdd(
      fresh.map((task) => ({
        ...task,
        kind: pasteKind,
        repos: pasteRepo && pasteRepo !== NO_REPO_VALUE ? [pasteRepo] : [],
        noRepo: pasteRepo === NO_REPO_VALUE,
        branchPrefix: pasteKind === "dev" ? pastePrefix : null,
        branch: null,
        baseBranch: pasteKind === "dev" ? pasteBase.trim() || null : null,
        useLocalBaseBranch: pasteKind === "dev" && pasteUseLocalBase,
        launchedAt: null,
        sessionId: null,
        error: null,
      })),
    );
    setPasteText("");
    if (fresh.length > 0) {
      showToast(t("taskQueueModal.added", { count: fresh.length }), "success");
    }
    if (repeated.length > 0) {
      showToast(t("taskQueueModal.alreadyListed", { keys: repeated.join(", ") }), "error");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <span className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">
          {t("taskQueueModal.kindLabel")}
        </span>
        <TaskQueueKindPicker value={pasteKind} onChange={setPasteKind} large />
      </div>
      {pasteKind === null ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t("taskQueueModal.chooseKindFirst")}
        </p>
      ) : (
        <>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              {t("taskQueueModal.pasteLabel")}
            </span>
            <textarea
              value={pasteText}
              onChange={(event) => setPasteText(event.target.value)}
              placeholder={t("taskQueueModal.pastePlaceholder")}
              rows={4}
              className={TEXTAREA_CLASSNAME}
              autoFocus
            />
          </label>
          <div className="flex flex-col gap-2.5">
            <SettingRow
              controlWidth="w-64"
              label={t("taskQueueModal.pasteRepo")}
              description={t("taskQueueModal.pasteRepo.hint")}
              control={
                <Select
                  value={pasteRepo}
                  onChange={(event) => setPasteRepo(event.target.value)}
                  aria-label={t("taskQueueModal.pasteRepo")}
                >
                  <option value="">{t("taskQueueModal.pasteRepoNone")}</option>
                  <option value={NO_REPO_VALUE}>{t("taskQueueModal.noRepoOption")}</option>
                  {projects.map((project) => (
                    <option key={project.path} value={project.path}>
                      {project.label}
                    </option>
                  ))}
                </Select>
              }
            />
            {pasteKind === "dev" && pasteRepo !== NO_REPO_VALUE && (
              <>
                <SettingRow
                  controlWidth="w-64"
                  label={t("taskQueueModal.pastePrefix")}
                  description={t("taskQueueModal.pastePrefix.hint")}
                  control={
                    <TaskQueuePrefixSelect
                      value={pastePrefix}
                      onChange={setPastePrefix}
                      branchTypes={branchTypes}
                    />
                  }
                />
                <SettingRow
                  controlWidth="w-64"
                  label={t("newTaskModal.baseBranchLabel")}
                  description={t("taskQueueModal.pasteBase.hint")}
                  control={
                    <Input
                      type="text"
                      value={pasteBase}
                      onChange={(event) => setPasteBase(event.target.value)}
                      placeholder={t("taskQueueModal.basePlaceholder")}
                      aria-label={t("newTaskModal.baseBranchLabel")}
                    />
                  }
                />
                {pasteBase.trim() && (
                  <label className="flex items-start gap-2 pl-[17rem] text-xs text-gray-500 dark:text-gray-400">
                    <input
                      type="checkbox"
                      checked={pasteUseLocalBase}
                      onChange={(event) => setPasteUseLocalBase(event.target.checked)}
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-gray-900 dark:accent-gray-100"
                    />
                    {t("newTaskModal.useLocalBaseBranchLabel")}
                  </label>
                )}
              </>
            )}
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={handleAdd} disabled={!pasteText.trim()}>
              {t("taskQueueModal.add")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
