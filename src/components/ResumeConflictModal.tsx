import { GitFork, Loader2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import type { Session } from "../types/session";
import { Button } from "./Button";
import { Input } from "./Input";
import { Modal } from "./Modal";

type ResumeConflictModalProps = {
  target: Session;
  sibling: Session;
  isCreatingWorktree: boolean;
  isSwitching: boolean;
  onCreateWorktree: (name: string) => void;
  onStopAndCheckout: (branch: string) => void;
  onCancel: () => void;
};

/**
 * Shown instead of resuming directly once `resumeSession` (useSessions.ts) freshly confirms a
 * conflict — either a different session active in the same directory, or (when `sibling.id ===
 * target.id`) this exact session already open in another terminal. Mounted only while open, same
 * re-init-on-open pattern as NicknameModal.
 */
export function ResumeConflictModal({
  target,
  sibling,
  isCreatingWorktree,
  isSwitching,
  onCreateWorktree,
  onStopAndCheckout,
  onCancel,
}: ResumeConflictModalProps) {
  const { t } = useLanguage();
  // The CLI's own `--worktree <name>` flag (see createSessionWorktree in sessionService.ts) uses
  // `name` to build both a directory name and a `worktree-<name>` branch name — a raw branch name
  // like "feature/PROJ-123" isn't a valid worktree name (the CLI silently mangles the "/" into a
  // "+" instead, e.g. producing a confusing "worktree-feature+PROJ-123" branch) — sanitize the
  // same way taskService.ts's own createTaskWorktree already does for its own worktree dir names.
  const [worktreeName, setWorktreeName] = useState(
    (target.gitBranch ?? "").replace(/[^A-Za-z0-9_-]/g, "-"),
  );
  const [branch, setBranch] = useState(target.gitBranch ?? "");
  const trimmedName = worktreeName.trim();
  const trimmedBranch = branch.trim();
  const isBusy = isCreatingWorktree || isSwitching;
  const isSelfConflict = sibling.id === target.id;
  const siblingLabel = sibling.nickname ?? sibling.title;

  return (
    <Modal
      open
      title={
        isSelfConflict
          ? t("resumeConflictModal.title.selfConflict")
          : t("resumeConflictModal.title.otherConflict")
      }
      onClose={onCancel}
      size="md"
    >
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {isSelfConflict ? (
          t("resumeConflictModal.intro.selfConflict")
        ) : (
          <>
            <span className="font-medium text-gray-700 dark:text-gray-300">{siblingLabel}</span>{" "}
            {t("resumeConflictModal.intro.otherConflictSuffix")}
          </>
        )}{" "}
        {t("resumeConflictModal.intro.pickOption")}
      </p>

      <div className="mt-4 rounded-lg border border-gray-200 p-3 dark:border-gray-800">
        <p className="flex items-center gap-1.5 text-sm font-medium text-gray-800 dark:text-gray-200">
          <GitFork className="h-4 w-4 shrink-0 text-violet-500 dark:text-violet-400" />
          {t("resumeConflictModal.worktree.title")}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {t("resumeConflictModal.worktree.bodyPrefix")} <code>claude</code>{" "}
          {t("resumeConflictModal.worktree.bodyMiddle")}{" "}
          {isSelfConflict
            ? t("resumeConflictModal.worktree.selfTerminalLabel")
            : t("resumeConflictModal.worktree.otherSessionLabel")}{" "}
          {t("resumeConflictModal.worktree.bodySuffix")}
        </p>
        <div className="mt-2 flex gap-2">
          <Input
            type="text"
            value={worktreeName}
            onChange={(event) => setWorktreeName(event.target.value)}
            disabled={isBusy}
            placeholder={t("resumeConflictModal.worktree.namePlaceholder")}
            className="flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={isBusy || !trimmedName}
            onClick={() => onCreateWorktree(trimmedName)}
            icon={isCreatingWorktree && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          >
            {t("resumeConflictModal.worktree.createButton")}
          </Button>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-red-200 p-3 dark:border-red-900/60">
        <p className="flex items-center gap-1.5 text-sm font-medium text-red-700 dark:text-red-400">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          {isSelfConflict
            ? t("resumeConflictModal.stop.titleSelf")
            : t("resumeConflictModal.stop.titleOther")}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {isSelfConflict ? (
            t("resumeConflictModal.stop.bodySelf")
          ) : (
            <>
              {t("resumeConflictModal.stop.bodyOtherPrefix")}{" "}
              <span className="font-medium">{siblingLabel}</span>
              {t("resumeConflictModal.stop.bodyOtherSuffix")}
            </>
          )}
          {t("resumeConflictModal.stop.bodyCommon")}
        </p>
        <div className="mt-2 flex gap-2">
          <Input
            type="text"
            value={branch}
            onChange={(event) => setBranch(event.target.value)}
            disabled={isBusy}
            placeholder={t("resumeConflictModal.stop.branchPlaceholder")}
            className="flex-1"
          />
          <Button
            variant="danger"
            size="sm"
            disabled={isBusy || !trimmedBranch}
            onClick={() => onStopAndCheckout(trimmedBranch)}
            icon={isSwitching && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          >
            {t("resumeConflictModal.stop.confirmButton")}
          </Button>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button variant="outline" onClick={onCancel} disabled={isBusy}>
          {t("resumeConflictModal.cancel")}
        </Button>
      </div>
    </Modal>
  );
}
