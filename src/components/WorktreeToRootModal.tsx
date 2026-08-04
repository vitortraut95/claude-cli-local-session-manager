import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Code2,
  Copy,
  GitBranch,
  GitMerge,
  Loader2,
  XCircle,
} from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import { useToast } from "../hooks/useToast";
import * as sessionsApi from "../services/sessionsApi";
import type { RootStatus, Session, WorktreeToRootPreview } from "../types/session";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { Tooltip } from "./Tooltip";

type WorktreeToRootModalProps = {
  session: Session;
  onClose: () => void;
  /** Called once, right before `onClose`, after every step of a run has succeeded — the caller
   *  re-fetches the session list, since root's branch and (in "checkout" mode) this session's own
   *  `directoryMissing`/`isWorktree` can both have changed. */
  onComplete: () => void;
  /** Called only from the "checkout" mode success screen's "Delete this session" button — this
   *  session's transcript is unresumable from this point on (its cwd, the worktree, is gone), so
   *  the modal offers to clean up its now-dead card instead of leaving it to linger forever. The
   *  caller reuses whatever delete-confirmation flow it already has for the normal Delete button
   *  (SessionCard forwards its own `onDeleteRequest`) rather than this modal building a second one. */
  onOfferDeleteSession: () => void;
};

type Mode = "copy" | "checkout";
type Stage = "choice" | "preview" | "confirm" | "progress" | "done";
type StepKey = "reset-root" | "copy" | "remove-and-checkout";
type StepStatus = "pending" | "doing" | "done" | "error";
type Step = { key: StepKey; label: string; status: StepStatus; error?: string };

function buildSteps(mode: Mode): Step[] {
  const resetStep: Step = {
    key: "reset-root",
    label: "Discard uncommitted changes in the root folder",
    status: "pending",
  };
  return mode === "copy"
    ? [
        resetStep,
        {
          key: "copy",
          label: "Copy the worktree's files into the root folder",
          status: "pending",
        },
      ]
    : [
        resetStep,
        {
          key: "remove-and-checkout",
          label: "Remove the worktree and check out its branch in the root folder",
          status: "pending",
        },
      ];
}

/** Exported for reuse by `ResetRootConfirmModal` — the standalone "Reset root" quick action shows
 *  the same live dirty-files list this modal's own confirm stage does. */
export function FileListBox({
  title,
  files,
  tone = "neutral",
  titleAction,
}: {
  title: string;
  files: string[];
  tone?: "neutral" | "danger";
  /** Rendered next to the title, e.g. the "code ." button that opens the folder these files
   *  belong to — lets the user actually look before something discards/overwrites them. */
  titleAction?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <p
          className={`text-xs font-medium ${
            tone === "danger" ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-400"
          }`}
        >
          {title} ({files.length})
        </p>
        {titleAction}
      </div>
      <div className="max-h-40 overflow-y-auto rounded-md border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-950">
        {files.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-600">None</p>
        ) : (
          <ul className="space-y-0.5 font-mono text-xs break-all text-gray-700 dark:text-gray-300">
            {files.map((file) => (
              <li key={file} title={file}>
                {file}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Mounted only while open (same convention as NicknameModal) so all of this
 * wizard's state resets fresh every time — there's no in-progress form input here worth preserving
 * across an accidental close.
 *
 * Four stages: pick a sub-flow ("choice") → see exactly what's about to happen ("preview",
 * fetched from the server) → one final unambiguous destructive confirm ("confirm", which
 * re-fetches the preview so the "here's what you're about to lose" copy can't be stale) →
 * step-by-step execution ("progress"). Each progress step is one real awaited HTTP request (see
 * sessionsApi's worktree-to-root functions) — no simulated/optimistic progress, matching
 * NewTaskModal's own convention: a failure stops the sequence right there, leaving later steps
 * visibly "pending" rather than faking completion.
 */
export function WorktreeToRootModal({
  session,
  onClose,
  onComplete,
  onOfferDeleteSession,
}: WorktreeToRootModalProps) {
  const { showToast } = useToast();
  const [stage, setStage] = useState<Stage>("choice");
  const [mode, setMode] = useState<Mode | null>(null);
  const [preview, setPreview] = useState<WorktreeToRootPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  // Separate from `preview` — the final confirm step only needs root's branch/dirty-files, not
  // the (comparatively expensive) full file diff, so it re-checks via the lighter root-status
  // endpoint instead of re-running fetchWorktreeToRootPreview a second time.
  const [confirmStatus, setConfirmStatus] = useState<RootStatus | null>(null);
  const [loadingConfirmStatus, setLoadingConfirmStatus] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [executing, setExecuting] = useState(false);
  const [openingRootInVSCode, setOpeningRootInVSCode] = useState(false);

  const openRootInVSCode = useCallback(() => {
    setOpeningRootInVSCode(true);
    sessionsApi
      .openWorktreeRootInVSCode(session.id)
      .then(() => showToast("Opening the root folder in VS Code…", "success"))
      .catch((err) => {
        showToast(err instanceof Error ? err.message : "Could not open VS Code.", "error");
      })
      .finally(() => setOpeningRootInVSCode(false));
  }, [session.id, showToast]);

  const fetchPreview = useCallback(() => {
    setLoadingPreview(true);
    setPreviewError(null);
    sessionsApi
      .fetchWorktreeToRootPreview(session.id)
      .then(setPreview)
      .catch((err) => {
        setPreviewError(
          err instanceof Error ? err.message : "Could not read the worktree/root folders.",
        );
      })
      .finally(() => setLoadingPreview(false));
  }, [session.id]);

  const chooseMode = (chosen: Mode) => {
    setMode(chosen);
    setStage("preview");
    fetchPreview();
  };

  const goToConfirm = () => {
    setStage("confirm");
    setLoadingConfirmStatus(true);
    sessionsApi
      .fetchRootStatus(session.id)
      .then(setConfirmStatus)
      .catch(() => setConfirmStatus(null))
      .finally(() => setLoadingConfirmStatus(false));
  };

  const handleClose = () => {
    // Steps are already firing server-side once "progress" starts — closing mid-run wouldn't
    // stop them, it would just hide the one place that shows how far they got.
    if (executing) return;
    onClose();
  };

  const handleExecute = async () => {
    if (!mode) return;
    setExecuting(true);
    setSteps(buildSteps(mode));
    setStage("progress");

    const updateStep = (key: StepKey, status: StepStatus, error?: string) => {
      setSteps((current) => current.map((step) => (step.key === key ? { ...step, status, error } : step)));
    };

    const stashNote = (stashRef: string | null) =>
      stashRef ? ` Root's previous state is saved — recover it with "git stash apply ${stashRef}".` : "";

    try {
      updateStep("reset-root", "doing");
      const { stashRef } = await sessionsApi.resetRootWorkingTree(session.id);
      updateStep("reset-root", "done");

      if (mode === "copy") {
        updateStep("copy", "doing");
        await sessionsApi.applyWorktreeCopyToRoot(session.id);
        updateStep("copy", "done");
        showToast(
          `Copied the worktree's files into the root folder.${stashNote(stashRef)}`,
          "success",
        );
        onComplete();
        onClose();
      } else {
        updateStep("remove-and-checkout", "doing");
        const { previousRootBranch, newBranch } =
          await sessionsApi.removeWorktreeAndCheckoutRoot(session.id);
        updateStep("remove-and-checkout", "done");
        showToast(
          `Worktree removed — root switched${previousRootBranch ? ` from "${previousRootBranch}"` : ""} ` +
            `to "${newBranch}".${stashNote(stashRef)}`,
          "success",
        );
        onComplete();
        // Not onClose() here: this session's transcript just became permanently unresumable (its
        // cwd, the worktree, is gone) — the "done" stage below offers to delete its now-dead card
        // instead of leaving the modal's success silently imply everything's still normal.
        setStage("done");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected failure.";
      setSteps((current) =>
        current.map((step) =>
          step.status === "doing" ? { ...step, status: "error", error: message } : step,
        ),
      );
      showToast(`Failed: ${message}`, "error");
    } finally {
      setExecuting(false);
    }
  };

  const blockedByActiveSession =
    !!preview &&
    (preview.rootHasActiveSession || (mode === "checkout" && preview.worktreeHasActiveSession));

  return (
    <Modal
      open
      title="Worktree → root"
      onClose={handleClose}
      size="lg"
      icon={
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950/50">
          <GitMerge className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
      }
      onCancel={
        stage === "choice"
          ? handleClose
          : stage === "preview"
            ? () => setStage("choice")
            : stage === "confirm"
              ? () => setStage("preview")
              : stage === "done"
                ? handleClose
                : undefined
      }
      cancelLabel={stage === "choice" ? "Cancel" : stage === "done" ? "Keep the card" : "Back"}
      onConfirm={
        stage === "preview"
          ? goToConfirm
          : stage === "confirm"
            ? handleExecute
            : stage === "done"
              ? () => {
                  onOfferDeleteSession();
                  onClose();
                }
              : undefined
      }
      confirmLabel={
        stage === "confirm" ? "Yes, do it" : stage === "done" ? "Delete this session" : "Continue"
      }
      confirmVariant={stage === "confirm" || stage === "done" ? "danger" : "primary"}
      isConfirmDisabled={
        stage === "preview" && (loadingPreview || previewError !== null || blockedByActiveSession)
      }
      isConfirmLoading={executing || loadingPreview || loadingConfirmStatus}
    >
      {stage === "choice" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Both options start by discarding any uncommitted changes currently in the root
            folder — pick which one, then you'll see exactly what will happen before confirming
            anything.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => chooseMode("copy")}
              className="flex flex-col gap-2 rounded-lg border border-gray-200 p-4 text-left hover:border-gray-400 dark:border-gray-800 dark:hover:border-gray-600"
            >
              <span className="flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
                <Copy className="h-4 w-4 shrink-0" /> Copy files only
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Copies the worktree's current files into the root folder. The worktree is left
                exactly as it is — nothing there is deleted or checked out. Root's branch doesn't
                change either; it just ends up with the worktree's files as uncommitted changes.
                No commits, no history — meant as a disposable preview you'll likely discard
                afterward.
              </span>
            </button>
            <button
              type="button"
              onClick={() => chooseMode("checkout")}
              className="flex flex-col gap-2 rounded-lg border border-gray-200 p-4 text-left hover:border-gray-400 dark:border-gray-800 dark:hover:border-gray-600"
            >
              <span className="flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
                <GitBranch className="h-4 w-4 shrink-0" /> Remove worktree &amp; checkout branch
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Deletes the worktree's folder and checks its branch out directly in the root
                folder instead — a real git checkout with full history preserved. The branch
                itself is never deleted. This session's transcript can no longer be resumed
                afterward, since it's tied to the worktree folder that just got removed.
              </span>
            </button>
          </div>
        </div>
      )}

      {stage === "preview" && (
        <div className="flex flex-col gap-4">
          {loadingPreview && (
            <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Reading the worktree and root folder…
            </p>
          )}
          {previewError && <p className="text-sm text-red-600 dark:text-red-400">{previewError}</p>}
          {preview && !loadingPreview && (
            <>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-800 dark:bg-gray-800/50">
                <p>
                  Root folder (<span className="font-mono break-all">{preview.repoRoot}</span>) is
                  currently on branch{" "}
                  <span className="font-mono font-medium">
                    {preview.rootBranch ?? "(detached HEAD)"}
                  </span>
                  .
                </p>
                {mode === "checkout" && (
                  <p className="mt-1">
                    It will be switched to{" "}
                    <span className="font-mono font-medium">
                      {preview.worktreeBranch ?? "(unknown)"}
                    </span>{" "}
                    — the worktree's own branch.
                  </p>
                )}
              </div>

              <FileListBox
                title={
                  preview.rootDirtyFiles.length === 0
                    ? "Uncommitted files in root (none — nothing will be lost there)"
                    : "Uncommitted files in root that will be discarded"
                }
                files={preview.rootDirtyFiles}
                tone={preview.rootDirtyFiles.length > 0 ? "danger" : "neutral"}
                titleAction={
                  <Tooltip content="Open the root folder in VS Code">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openRootInVSCode}
                      disabled={openingRootInVSCode}
                      aria-label="Open root folder in VS Code"
                      icon={
                        openingRootInVSCode ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Code2 className="h-3.5 w-3.5" />
                        )
                      }
                    >
                      code .
                    </Button>
                  </Tooltip>
                }
              />

              {mode === "copy" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <FileListBox title="Added to root" files={preview.fileDiff.added} />
                  <FileListBox title="Modified in root" files={preview.fileDiff.modified} />
                  <FileListBox
                    title="Removed from root"
                    files={preview.fileDiff.removed}
                    tone="danger"
                  />
                </div>
              )}

              {mode === "checkout" && (
                <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  The worktree's folder will be deleted (its branch and commits are kept). This
                  session's transcript is tied to that exact folder, so it won't be resumable from
                  this app afterward — the code itself isn't lost, it's just in the root folder now.
                </p>
              )}

              {preview.rootHasActiveSession && (
                <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />A session is currently
                  active in the root folder — close its terminal before continuing.
                </p>
              )}
              {mode === "checkout" && preview.worktreeHasActiveSession && (
                <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />A session is still active in
                  this worktree — close its terminal before removing it.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {stage === "confirm" && (
        <div className="flex flex-col gap-3">
          <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {/* One child span, not bare text/<code> siblings — see ResetRootConfirmModal's same
                fix: mixed siblings inside a flex <p> each become their own flex item instead of
                flowing as one paragraph. */}
            <span>
              Root's current uncommitted changes will be stashed first (recoverable afterward via{" "}
              <code>git stash apply</code>), then cleared from the working tree.{" "}
              {mode === "checkout"
                ? "After that, the worktree's folder will be permanently deleted (its branch and commits are kept) and root will switch to that branch."
                : "The worktree itself is never touched by any of this."}
            </span>
          </p>
          {loadingConfirmStatus && (
            <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Double-checking the root folder hasn't
              changed since you opened this…
            </p>
          )}
          {!loadingConfirmStatus && confirmStatus && (
            <FileListBox
              title={
                confirmStatus.rootDirtyFiles.length === 0
                  ? "Uncommitted files in root right now (none)"
                  : "Uncommitted files in root right now — about to be stashed"
              }
              files={confirmStatus.rootDirtyFiles}
              tone={confirmStatus.rootDirtyFiles.length > 0 ? "danger" : "neutral"}
            />
          )}
        </div>
      )}

      {stage === "done" && (
        <div className="flex flex-col gap-3">
          <p className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-400">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            Done — the root folder is now on the worktree's branch, with full history preserved.
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            This session's transcript was tied to the worktree folder that just got removed, so it
            can't be resumed from this app anymore — the code itself is safe, it's just in the root
            folder now. Delete this now-dead card, or keep it around as a record.
          </p>
        </div>
      )}

      {stage === "progress" && (
        <ol className="space-y-2">
          {steps.map((step) => (
            <li key={step.key} className="flex items-start gap-2">
              {step.status === "pending" && (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />
              )}
              {step.status === "doing" && (
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-gray-500 dark:text-gray-400" />
              )}
              {step.status === "done" && (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-500" />
              )}
              {step.status === "error" && (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-500" />
              )}
              <div>
                <p
                  className={`text-sm ${
                    step.status === "pending"
                      ? "text-gray-400 dark:text-gray-500"
                      : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {step.label}
                </p>
                {step.status === "error" && step.error && (
                  <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{step.error}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
