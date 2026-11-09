import { useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { NicknameModal } from "../components/NicknameModal";
import { OpenPrBaseChoiceModal } from "../components/OpenPrBaseChoiceModal";
import { SessionBranchesModal } from "../components/SessionBranchesModal";
import { SessionTranscriptModal } from "../components/SessionTranscriptModal";
import { TaskHistoryModal } from "../components/TaskHistoryModal";
import { TaskModal } from "../components/TaskModal";
import * as cleanupApi from "../services/cleanupApi";
import type { TerminalLayout } from "../services/preferencesApi";
import * as sessionsApi from "../services/sessionsApi";
import type { Session, WorkStatus } from "../../shared/session";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { DEFAULT_BRANCHES } from "../utils/branches";
import { resolveSessionBranches } from "../utils/sessionBranches";
import type { PendingAction } from "./useSessions";
import { useLanguage } from "./useLanguage";
import { useTeamLinks } from "./useTeamLinks";
import { useToast } from "./useToast";

/** What the sessions page does for a session; shared by the card, the list row and the panel. */
export type SessionHandlers = {
  /** `layout` = where the user picked to open it; omitted = the `terminalLayout` preference. */
  onContinue: (session: Session, layout?: TerminalLayout) => void;
  onSetNickname: (session: Session, nickname: string) => void;
  onSetBranches: (session: Session, origin: string, destination: string) => void;
  /** Resolves true once saved. */
  onSetStatus: (session: Session, status: WorkStatus | null) => Promise<boolean>;
  onOpenInVSCode: (session: Session) => void;
  onOpenInCursor: (session: Session) => void;
  onOpenMissingWorktreeRootInVSCode: (session: Session) => void;
  onStartNewSessionAtMissingWorktreeRoot: (
    session: Session,
    layout?: TerminalLayout,
  ) => Promise<void>;
  onDeleteWorktree: (session: Session) => void;
  /** Something on disk changed (a worktree removed, a preview started): reload the list. */
  onWorktreeSyncComplete: (session: Session) => void;
  onFilterByTask: (taskKey: string) => void;
  onTaskChanged: () => void;
};

const DONE_WORKTREE_KEPT_KEYS = {
  "not-pushed": "sessionCard.doneWorktree.keptNotPushed",
  "uncommitted-changes": "sessionCard.doneWorktree.keptDirty",
  "active-session": "sessionCard.doneWorktree.keptActive",
} as const;

/** The one dialog a session can have open. `task.addRepo` opens it straight on the "add repo"
 *  form; `doneWorktree` is offered right after the session is marked done (the cleanup that
 *  removing its worktree means). */
export type SessionDialog =
  | { kind: "preview"; index?: number }
  | { kind: "nickname" }
  | { kind: "branches" }
  | { kind: "task"; addRepo: boolean }
  | { kind: "history" }
  | { kind: "openPrBase" }
  | { kind: "deleteWorktree" }
  | { kind: "doneWorktree"; finding: cleanupApi.CleanupFinding };

/**
 * A session's actions and the dialogs they open: the status change that offers removing a done
 * worktree, "open PR" (with the base-branch choice), and the task / history /
 * conversation / nickname / branches dialogs. `dialogs` must be rendered by the caller.
 */
export function useSessionActions(
  session: Session,
  handlers: SessionHandlers,
  pendingAction?: PendingAction,
) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const teamLinks = useTeamLinks();
  const [dialog, setDialog] = useState<SessionDialog | null>(null);
  const [removingDoneWorktree, setRemovingDoneWorktree] = useState(false);
  const [openingPrUrl, setOpeningPrUrl] = useState(false);
  const close = () => setDialog(null);
  const doneWorktreeFinding = dialog?.kind === "doneWorktree" ? dialog.finding : null;

  const { origin: originBranch, destination: taskBranch } = resolveSessionBranches(session);
  const canOpenPr = Boolean(taskBranch) && !session.directoryMissing && !session.isAppRepo;
  const canOpenTask = !session.directoryMissing && !session.isAppRepo;
  const showsBranches =
    session.gitBranch !== null && !session.directoryMissing && !session.isAppRepo;

  /** Marking a worktree session done offers to remove its worktree when that's safe now (merged,
   *  or every commit on origin); otherwise says why it stays. */
  const changeStatus = async (status: WorkStatus | null) => {
    const saved = await handlers.onSetStatus(session, status);
    if (!saved || status !== "done" || !session.isWorktree || session.directoryMissing) return;
    try {
      const result = await cleanupApi.fetchWorktreeCleanupForSession(session.id);
      if (result?.finding) {
        const finding = result.finding;
        // Never replaces a dialog the user opened meanwhile.
        setDialog((current) => current ?? { kind: "doneWorktree", finding });
      } else if (
        result?.reason === "not-pushed" ||
        result?.reason === "uncommitted-changes" ||
        result?.reason === "active-session"
      ) {
        showToast(t(DONE_WORKTREE_KEPT_KEYS[result.reason]), "error");
      }
    } catch {
      // Only an offer: the Cleanup window still lists it later.
    }
  };

  const removeDoneWorktree = async () => {
    if (!doneWorktreeFinding) return;
    setRemovingDoneWorktree(true);
    try {
      await cleanupApi.executeCleanupFinding(doneWorktreeFinding);
      showToast(t("sessionCard.doneWorktree.removed"), "success");
      close();
      handlers.onWorktreeSyncComplete(session);
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "cleanupModal.runError"), "error");
    } finally {
      setRemovingDoneWorktree(false);
    }
  };

  // The URL needs a server-side git call, so it's fetched on click. A non-default base branch
  // goes through OpenPrBaseChoiceModal, since the plain link diffs against the default branch.
  const openPr = async () => {
    if (!taskBranch) return;
    if (
      originBranch &&
      originBranch !== taskBranch &&
      originBranch !== session.defaultBranch &&
      !DEFAULT_BRANCHES.has(originBranch)
    ) {
      setDialog({ kind: "openPrBase" });
      return;
    }
    setOpeningPrUrl(true);
    try {
      const url = await sessionsApi.fetchPrUrl(session.id, taskBranch);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "sessionCard.openPr.error"), "error");
    } finally {
      setOpeningPrUrl(false);
    }
  };

  const dialogs = (
    <>
      {dialog?.kind === "preview" && (
        <SessionTranscriptModal session={session} initialIndex={dialog.index} onClose={close} />
      )}
      {dialog?.kind === "task" && (
        <TaskModal
          session={session}
          startAddingRepo={dialog.addRepo}
          onClose={close}
          onChanged={handlers.onTaskChanged}
          onSetNickname={(nickname) => handlers.onSetNickname(session, nickname)}
          onSetBranches={(origin, destination) =>
            handlers.onSetBranches(session, origin, destination)
          }
        />
      )}
      {dialog?.kind === "branches" && (
        <SessionBranchesModal
          session={session}
          onSave={(origin, destination) => {
            close();
            handlers.onSetBranches(session, origin, destination);
          }}
          onCancel={close}
        />
      )}
      {dialog?.kind === "nickname" && (
        <NicknameModal
          currentNickname={session.nickname ?? ""}
          onSave={(nickname) => {
            close();
            handlers.onSetNickname(session, nickname);
          }}
          onCancel={close}
        />
      )}
      {dialog?.kind === "openPrBase" && <OpenPrBaseChoiceModal session={session} onClose={close} />}
      {dialog?.kind === "history" && <TaskHistoryModal session={session} onClose={close} />}
      <ConfirmDialog
        open={doneWorktreeFinding !== null}
        title={t("sessionCard.doneWorktree.title")}
        message={t(
          doneWorktreeFinding?.kind === "remove-merged-worktree"
            ? "sessionCard.doneWorktree.mergedMessage"
            : "sessionCard.doneWorktree.message",
          { branch: doneWorktreeFinding?.branch ?? "?" },
        )}
        confirmLabel={t("sessionCard.doneWorktree.confirm")}
        cancelLabel={t("sessionCard.doneWorktree.keep")}
        isLoading={removingDoneWorktree}
        onConfirm={() => void removeDoneWorktree()}
        onCancel={close}
      />
      <ConfirmDialog
        open={dialog?.kind === "deleteWorktree"}
        title={t("sessionCard.deleteWorktreeConfirm.title")}
        message={t("sessionCard.deleteWorktreeConfirm.message")}
        confirmLabel={t("sessionCard.deleteButton")}
        cancelLabel={t("sessionCard.cancelButton")}
        onConfirm={() => {
          close();
          handlers.onDeleteWorktree(session);
        }}
        onCancel={close}
      />
    </>
  );

  return {
    open: setDialog,
    changeStatus,
    openPr,
    openingPrUrl,
    originBranch,
    taskBranch,
    canOpenPr,
    canOpenTask,
    showsBranches,
    gridLayout: teamLinks.gridLayout,
    busy: {
      deleting: pendingAction === "delete",
      continuing: pendingAction === "continue",
      nickname: pendingAction === "nickname",
      branches: pendingAction === "branches",
      status: pendingAction === "status",
      vscode: pendingAction === "vscode",
      cursor: pendingAction === "cursor",
      worktreeDelete: pendingAction === "worktree-delete",
      missingRootResume: pendingAction === "missing-root-resume",
    },
    dialogs,
  };
}
