import { GitFork, Loader2, TriangleAlert } from "lucide-react";
import { useState } from "react";
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
  const [worktreeName, setWorktreeName] = useState(target.gitBranch ?? "");
  const [branch, setBranch] = useState(target.gitBranch ?? "");
  const trimmedName = worktreeName.trim();
  const trimmedBranch = branch.trim();
  const isBusy = isCreatingWorktree || isSwitching;
  const isSelfConflict = sibling.id === target.id;
  const siblingLabel = sibling.nickname ?? sibling.title;

  return (
    <Modal
      open
      title={isSelfConflict ? "This session is already open elsewhere" : "Another session is active here"}
      onClose={onCancel}
      size="md"
    >
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {isSelfConflict ? (
          "This exact session is already open in another terminal. Resuming it again here would start a second Claude process against the same transcript at once."
        ) : (
          <>
            <span className="font-medium text-gray-700 dark:text-gray-300">{siblingLabel}</span> is
            currently active in this project's folder. Resuming here too would put two Claude
            processes in the same working tree at once.
          </>
        )}{" "}
        Pick one of the options below instead.
      </p>

      <div className="mt-4 rounded-lg border border-gray-200 p-3 dark:border-gray-800">
        <p className="flex items-center gap-1.5 text-sm font-medium text-gray-800 dark:text-gray-200">
          <GitFork className="h-4 w-4 shrink-0 text-violet-500 dark:text-violet-400" />
          Create a worktree (recommended)
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Starts a fresh <code>claude</code> conversation in a separate checkout of this project —
          {isSelfConflict ? " the terminal that already has this session open" : " the active session above"}{" "}
          keeps running untouched. It won't resume this specific transcript (the CLI can't do that
          from a different folder), just a new one alongside it.
        </p>
        <div className="mt-2 flex gap-2">
          <Input
            type="text"
            value={worktreeName}
            onChange={(event) => setWorktreeName(event.target.value)}
            disabled={isBusy}
            placeholder="Worktree name, e.g. my-task"
            className="flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={isBusy || !trimmedName}
            onClick={() => onCreateWorktree(trimmedName)}
            icon={isCreatingWorktree && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          >
            Create
          </Button>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-red-200 p-3 dark:border-red-900/60">
        <p className="flex items-center gap-1.5 text-sm font-medium text-red-700 dark:text-red-400">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          {isSelfConflict ? "Stop the other terminal & continue here" : "Stop the other session & continue here"}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {isSelfConflict ? (
            "Ends this session's other terminal process"
          ) : (
            <>
              Ends <span className="font-medium">{siblingLabel}</span>'s terminal process
            </>
          )}
          , checks out the branch below in this shared folder, then resumes this session there.
          Anything that terminal hadn't saved or committed yet can be lost — only do this if you're
          sure it's safe to interrupt.
        </p>
        <div className="mt-2 flex gap-2">
          <Input
            type="text"
            value={branch}
            onChange={(event) => setBranch(event.target.value)}
            disabled={isBusy}
            placeholder="Branch to check out"
            className="flex-1"
          />
          <Button
            variant="danger"
            size="sm"
            disabled={isBusy || !trimmedBranch}
            onClick={() => onStopAndCheckout(trimmedBranch)}
            icon={isSwitching && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          >
            Stop & continue
          </Button>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button variant="outline" onClick={onCancel} disabled={isBusy}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
