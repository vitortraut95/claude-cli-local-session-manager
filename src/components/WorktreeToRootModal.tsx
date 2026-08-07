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
import { useLanguage } from "../hooks/useLanguage";
import type { TranslationKey } from "../i18n/translations";
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

type TFn = (key: TranslationKey, params?: Record<string, string | number>) => string;

function buildSteps(mode: Mode, t: TFn): Step[] {
  const resetStep: Step = {
    key: "reset-root",
    label: t("worktreeToRootModal.steps.resetRoot"),
    status: "pending",
  };
  return mode === "copy"
    ? [
        resetStep,
        {
          key: "copy",
          label: t("worktreeToRootModal.steps.copy"),
          status: "pending",
        },
      ]
    : [
        resetStep,
        {
          key: "remove-and-checkout",
          label: t("worktreeToRootModal.steps.removeAndCheckout"),
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
  const { t } = useLanguage();
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
          <p className="text-xs text-gray-400 dark:text-gray-600">
            {t("worktreeToRootModal.fileListBox.none")}
          </p>
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
  const { t } = useLanguage();
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
      .then(() => showToast(t("worktreeToRootModal.toast.openingVSCode"), "success"))
      .catch((err) => {
        showToast(
          err instanceof Error ? err.message : t("worktreeToRootModal.toast.openVSCodeError"),
          "error",
        );
      })
      .finally(() => setOpeningRootInVSCode(false));
  }, [session.id, showToast, t]);

  const fetchPreview = useCallback(() => {
    setLoadingPreview(true);
    setPreviewError(null);
    sessionsApi
      .fetchWorktreeToRootPreview(session.id)
      .then(setPreview)
      .catch((err) => {
        setPreviewError(
          err instanceof Error ? err.message : t("worktreeToRootModal.preview.errorFallback"),
        );
      })
      .finally(() => setLoadingPreview(false));
  }, [session.id, t]);

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

  // Both ways out of the "done" stage (keep the card, or offer to delete it) — the parent's
  // session-list refresh is deferred to here rather than fired right when "checkout" mode
  // succeeds, so the "done" stage actually gets to render first (see handleExecute's comment).
  const finishDone = () => {
    onComplete();
    onClose();
  };

  const handleExecute = async () => {
    if (!mode) return;
    setExecuting(true);
    setSteps(buildSteps(mode, t));
    setStage("progress");

    const updateStep = (key: StepKey, status: StepStatus, error?: string) => {
      setSteps((current) => current.map((step) => (step.key === key ? { ...step, status, error } : step)));
    };

    const stashNote = (stashRef: string | null) =>
      stashRef ? ` ${t("worktreeToRootModal.toast.stashNote", { stashRef })}` : "";

    try {
      updateStep("reset-root", "doing");
      const { stashRef } = await sessionsApi.resetRootWorkingTree(session.id);
      updateStep("reset-root", "done");

      if (mode === "copy") {
        updateStep("copy", "doing");
        await sessionsApi.applyWorktreeCopyToRoot(session.id);
        updateStep("copy", "done");
        showToast(
          `${t("worktreeToRootModal.toast.copySuccess")}${stashNote(stashRef)}`,
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
          `${
            previousRootBranch
              ? t("worktreeToRootModal.toast.checkoutSuccessWithPrevious", {
                  previousBranch: previousRootBranch,
                  newBranch,
                })
              : t("worktreeToRootModal.toast.checkoutSuccessNoPrevious", { newBranch })
          }${stashNote(stashRef)}`,
          "success",
        );
        // Not onComplete()/onClose() here: onComplete() triggers the parent's session-list
        // refresh, which flips its `loading` state and unmounts the whole grid (this modal
        // included) for the duration of the refetch — done from here, the "done" stage below
        // would get torn down before the user ever saw it. Deferred to the "done" stage's own
        // exit handlers (both "keep the card" and "delete the session") instead.
        setStage("done");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t("worktreeToRootModal.toast.unexpectedFailure");
      setSteps((current) =>
        current.map((step) =>
          step.status === "doing" ? { ...step, status: "error", error: message } : step,
        ),
      );
      showToast(t("worktreeToRootModal.toast.failedPrefix", { message }), "error");
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
      title={t("worktreeToRootModal.title")}
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
                ? finishDone
                : undefined
      }
      cancelLabel={
        stage === "choice"
          ? t("worktreeToRootModal.cancel")
          : stage === "done"
            ? t("worktreeToRootModal.keepCard")
            : t("worktreeToRootModal.back")
      }
      onConfirm={
        stage === "preview"
          ? goToConfirm
          : stage === "confirm"
            ? handleExecute
            : stage === "done"
              ? () => {
                  onOfferDeleteSession();
                  finishDone();
                }
              : undefined
      }
      confirmLabel={
        stage === "confirm"
          ? t("worktreeToRootModal.confirmYesDoIt")
          : stage === "done"
            ? t("worktreeToRootModal.confirmDeleteSession")
            : t("worktreeToRootModal.confirmContinue")
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
            {t("worktreeToRootModal.choice.intro")}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => chooseMode("copy")}
              className="flex flex-col gap-2 rounded-lg border border-gray-200 p-4 text-left hover:border-gray-400 dark:border-gray-800 dark:hover:border-gray-600"
            >
              <span className="flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
                <Copy className="h-4 w-4 shrink-0" /> {t("worktreeToRootModal.choice.copyTitle")}
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t("worktreeToRootModal.choice.copyBody")}
              </span>
            </button>
            <button
              type="button"
              onClick={() => chooseMode("checkout")}
              className="flex flex-col gap-2 rounded-lg border border-gray-200 p-4 text-left hover:border-gray-400 dark:border-gray-800 dark:hover:border-gray-600"
            >
              <span className="flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
                <GitBranch className="h-4 w-4 shrink-0" /> {t("worktreeToRootModal.choice.checkoutTitle")}
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t("worktreeToRootModal.choice.checkoutBody")}
              </span>
            </button>
          </div>
        </div>
      )}

      {stage === "preview" && (
        <div className="flex flex-col gap-4">
          {loadingPreview && (
            <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("worktreeToRootModal.preview.loading")}
            </p>
          )}
          {previewError && <p className="text-sm text-red-600 dark:text-red-400">{previewError}</p>}
          {preview && !loadingPreview && (
            <>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-800 dark:bg-gray-800/50">
                <p>
                  {t("worktreeToRootModal.preview.rootFolderLabel")} (
                  <span className="font-mono break-all">{preview.repoRoot}</span>){" "}
                  {t("worktreeToRootModal.preview.currentlyOnBranch")}{" "}
                  <span className="font-mono font-medium">
                    {preview.rootBranch ?? t("worktreeToRootModal.preview.detachedHead")}
                  </span>
                  .
                </p>
                {mode === "checkout" && (
                  <p className="mt-1">
                    {t("worktreeToRootModal.preview.switchToPrefix")}{" "}
                    <span className="font-mono font-medium">
                      {preview.worktreeBranch ?? t("worktreeToRootModal.preview.unknownBranch")}
                    </span>{" "}
                    {t("worktreeToRootModal.preview.switchToSuffix")}
                  </p>
                )}
              </div>

              <FileListBox
                title={
                  preview.rootDirtyFiles.length === 0
                    ? t("worktreeToRootModal.preview.dirtyFilesNoneTitle")
                    : t("worktreeToRootModal.preview.dirtyFilesTitle")
                }
                files={preview.rootDirtyFiles}
                tone={preview.rootDirtyFiles.length > 0 ? "danger" : "neutral"}
                titleAction={
                  <Tooltip content={t("worktreeToRootModal.preview.openInVSCode")}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openRootInVSCode}
                      disabled={openingRootInVSCode}
                      aria-label={t("worktreeToRootModal.preview.openInVSCode")}
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
                  <FileListBox title={t("worktreeToRootModal.preview.addedTitle")} files={preview.fileDiff.added} />
                  <FileListBox
                    title={t("worktreeToRootModal.preview.modifiedTitle")}
                    files={preview.fileDiff.modified}
                  />
                  <FileListBox
                    title={t("worktreeToRootModal.preview.removedTitle")}
                    files={preview.fileDiff.removed}
                    tone="danger"
                  />
                </div>
              )}

              {mode === "checkout" && (
                <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {t("worktreeToRootModal.preview.checkoutWarning")}
                </p>
              )}

              {preview.rootHasActiveSession && (
                <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {t("worktreeToRootModal.preview.rootActiveWarning")}
                </p>
              )}
              {mode === "checkout" && preview.worktreeHasActiveSession && (
                <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {t("worktreeToRootModal.preview.worktreeActiveWarning")}
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
              {t("worktreeToRootModal.confirm.stashIntro")} <code>git stash apply</code>
              {t("worktreeToRootModal.confirm.stashIntroSuffix")}{" "}
              {mode === "checkout"
                ? t("worktreeToRootModal.confirm.checkoutWarning")
                : t("worktreeToRootModal.confirm.copyWarning")}
            </span>
          </p>
          {loadingConfirmStatus && (
            <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("worktreeToRootModal.confirm.doubleChecking")}
            </p>
          )}
          {!loadingConfirmStatus && confirmStatus && (
            <FileListBox
              title={
                confirmStatus.rootDirtyFiles.length === 0
                  ? t("worktreeToRootModal.confirm.dirtyNoneTitle")
                  : t("worktreeToRootModal.confirm.dirtyTitle")
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
            {t("worktreeToRootModal.done.message")}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t("worktreeToRootModal.done.explanation")}
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
