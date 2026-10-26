import { GitBranch } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import type { NewTaskForm } from "../hooks/useNewTaskForm";
import { OTHER_PREFIX_VALUE } from "../utils/newTask";
import { Input } from "./Input";
import { Select } from "./Select";

/** The "New task" source branch, branch type and branch name fields. */
export function NewTaskBranchFields({ form }: { form: NewTaskForm }) {
  const { t } = useLanguage();
  const {
    baseBranch,
    setBaseBranch,
    setBaseBranchTouched,
    useLocalBaseBranch,
    setUseLocalBaseBranch,
    branchTypes,
    prefixChoice,
    setPrefixChoice,
    customPrefix,
    setCustomPrefix,
    branchSuffix,
    setBranchSuffixManual,
    branchName,
  } = form;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
          {t("newTaskModal.baseBranchLabel")}
        </label>
        <Input
          type="text"
          value={baseBranch}
          onChange={(event) => {
            setBaseBranch(event.target.value);
            setBaseBranchTouched(true);
          }}
          placeholder="master/main/other"
          name="newTaskBaseBranch"
        />
        <label className="mt-1 flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
          <input
            type="checkbox"
            checked={useLocalBaseBranch}
            onChange={(event) => setUseLocalBaseBranch(event.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-gray-900 dark:accent-gray-100"
          />
          {t("newTaskModal.useLocalBaseBranchLabel")}
        </label>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
          {t("newTaskModal.branchTypeLabel")}
        </label>
        <Select value={prefixChoice} onChange={(event) => setPrefixChoice(event.target.value)}>
          {branchTypes.map((prefix) => (
            <option key={prefix} value={prefix}>
              {prefix}
            </option>
          ))}
          <option value={OTHER_PREFIX_VALUE}>{t("newTaskModal.otherBranchType")}</option>
        </Select>
        {prefixChoice === OTHER_PREFIX_VALUE && (
          <Input
            type="text"
            value={customPrefix}
            onChange={(event) => setCustomPrefix(event.target.value)}
            placeholder={t("newTaskModal.customPrefixPlaceholder")}
            name="newTaskBranchType"
            className="mt-2"
          />
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
          {t("newTaskModal.branchNameLabel")}
        </label>
        <Input
          type="text"
          icon={<GitBranch className="h-4 w-4" />}
          value={branchSuffix}
          onChange={(event) => setBranchSuffixManual(event.target.value)}
          placeholder="PROJ-123"
          name="newTaskBranchName"
        />
        {branchName && (
          <p className="mt-1 flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
            {t("newTaskModal.branchPreview")}
            <span className="font-mono text-gray-600 dark:text-gray-300">{branchName}</span>
          </p>
        )}
      </div>
    </div>
  );
}
