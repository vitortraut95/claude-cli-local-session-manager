import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import type { Session } from "../../shared/session";
import { DEFAULT_BRANCHES } from "../utils/branches";
import { sessionDisplayTitle } from "../utils/sessionTitle";
import { Button } from "./Button";

export type DeleteOptions = {
  /** Also remove the session's worktree (worktree sessions only; deletes its branch too). */
  cleanupWorktree: boolean;
  /** Also delete the local branch (non-worktree sessions on a non-default branch). */
  cleanupBranch: boolean;
  branchName?: string;
};

/**
 * "Delete this session?" in place of the row or the panel's footer, with the cleanup choices
 * (remove the worktree, checked; delete the branch, unchecked). Esc or Cancel
 * puts the row back.
 */
export function InlineDeleteConfirm({
  session,
  onCancel,
  onConfirm,
}: {
  session: Session;
  onCancel: () => void;
  onConfirm: (options: DeleteOptions) => void;
}) {
  const { t } = useLanguage();
  const [cleanupWorktree, setCleanupWorktree] = useState(true);
  const [cleanupBranch, setCleanupBranch] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const branch = session.gitBranch;
  const offersBranch =
    !session.isWorktree && Boolean(branch) && !DEFAULT_BRANCHES.has(branch ?? "");

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  return (
    <div
      role="group"
      aria-label={t("sessions.delete.inline", { title: sessionDisplayTitle(session) })}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onCancel();
        }
      }}
      className="flex flex-wrap items-center gap-3 bg-red-50 px-4 py-3 dark:bg-red-950/30"
    >
      <Trash2 className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
      <div className="min-w-0 flex-[1_1_16rem]">
        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
          {t("sessions.delete.inline", { title: sessionDisplayTitle(session) })}
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {t("sessions.delete.inlineHint")}
        </p>
        {session.isWorktree && (
          <label className="mt-1.5 flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={cleanupWorktree}
              onChange={(event) => setCleanupWorktree(event.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-red-600"
            />
            {t("sessionsPage.deleteConfirm.cleanupWorktree")}
          </label>
        )}
        {offersBranch && (
          <label className="mt-1.5 flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={cleanupBranch}
              onChange={(event) => setCleanupBranch(event.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-red-600"
            />
            {t("sessionsPage.deleteConfirm.cleanupBranch", { branch: branch ?? "" })}
          </label>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button ref={cancelRef} variant="outline" size="sm" onClick={onCancel}>
          {t("sessionsPage.cancel")}
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() =>
            onConfirm({
              cleanupWorktree: session.isWorktree && cleanupWorktree,
              cleanupBranch: offersBranch && cleanupBranch,
              branchName: branch ?? undefined,
            })
          }
        >
          {t("sessionsPage.delete")}
        </Button>
      </div>
    </div>
  );
}
