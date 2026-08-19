import { CheckCircle2, Circle, Loader2, Scissors, XCircle } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useToast } from "../hooks/useToast";
import type { TranslationKey } from "../i18n/translations";
import * as sessionsApi from "../services/sessionsApi";
import type { CompactionDraft } from "../services/sessionsApi";
import type { Session } from "../types/session";
import { Modal } from "./Modal";
import { resolveApiErrorMessage } from "../utils/apiClient";

type CompactContinueModalProps = {
  session: Session;
  onClose: () => void;
  /** Fired right after a successful launch, so the session list picks up the new pt2 session
   *  (and this one's "continued by" link) as soon as it exists. */
  onLaunched: () => void;
};

type StepStatus = "pending" | "doing" | "done" | "error";
type StepKey = "summary" | "launch";
type Step = { key: StepKey; label: string; status: StepStatus; error?: string };

const STEP_LABEL_KEYS: Record<StepKey, TranslationKey> = {
  summary: "compactContinueModal.step.summary",
  launch: "compactContinueModal.step.launch",
};
const STEP_ORDER: StepKey[] = ["summary", "launch"];

const TEXTAREA_CLASSNAME =
  "w-full rounded-lg border border-stone-300 bg-white p-3 text-sm text-stone-900 placeholder:text-stone-400 " +
  "focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 dark:border-stone-700 " +
  "dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:border-stone-600 " +
  "dark:focus:ring-stone-100/10";

/**
 * Mounted only while open (SessionCard conditionally renders it), unlike NewTaskModal's
 * always-mounted convention — there's no draft worth preserving across an accidental close here,
 * the whole point is a fresh summary of the session's *current* state each time.
 *
 * Two-phase confirm button, same `Modal` shell as everywhere else: phase 1 generates the draft
 * summary (a real, non-interactive turn against the session's own transcript — see server-side
 * getCompactionDraft) and pauses for review; phase 2 (only reachable once a draft exists) launches
 * the pt2 session seeded with the (possibly edited) text. Steps are shown from the first click,
 * same reasoning as NewTaskModal's own checklist: a failure is then attributable to one exact
 * step instead of one opaque error.
 */
export function CompactContinueModal({ session, onClose, onLaunched }: CompactContinueModalProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [steps, setSteps] = useState<Step[]>([]);
  const [draft, setDraft] = useState<CompactionDraft | null>(null);
  const [summaryText, setSummaryText] = useState("");
  const [busy, setBusy] = useState(false);

  const updateStep = (key: StepKey, status: StepStatus, error?: string) => {
    setSteps((current) => current.map((step) => (step.key === key ? { ...step, status, error } : step)));
  };

  const handleGenerate = async () => {
    setBusy(true);
    setSteps(STEP_ORDER.map((key) => ({ key, label: t(STEP_LABEL_KEYS[key]), status: "pending" })));
    try {
      updateStep("summary", "doing");
      const fetched = await sessionsApi.fetchCompactionDraft(session.id);
      setDraft(fetched);
      setSummaryText(fetched.summary);
      updateStep("summary", "done");
    } catch (err) {
      const message = resolveApiErrorMessage(err, t, "compactContinueModal.unexpectedFailure");
      updateStep("summary", "error", message);
      showToast(t("compactContinueModal.generateFailed", { message }), "error");
    } finally {
      setBusy(false);
    }
  };

  const handleLaunch = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      updateStep("launch", "doing");
      await sessionsApi.startCompactContinuation(session.id, summaryText);
      updateStep("launch", "done");
      showToast(t("compactContinueModal.launched"), "success");
      onLaunched();
      onClose();
    } catch (err) {
      const message = resolveApiErrorMessage(err, t, "compactContinueModal.unexpectedFailure");
      updateStep("launch", "error", message);
      showToast(t("compactContinueModal.launchFailed", { message }), "error");
    } finally {
      setBusy(false);
    }
  };

  const confirmLabel = draft
    ? t("compactContinueModal.launchButton")
    : t("compactContinueModal.generateButton");

  return (
    <Modal
      open
      title={t("compactContinueModal.title")}
      onClose={onClose}
      onCancel={onClose}
      cancelLabel={t("compactContinueModal.cancel")}
      onConfirm={draft ? () => void handleLaunch() : () => void handleGenerate()}
      confirmLabel={confirmLabel}
      isConfirmLoading={busy}
      isConfirmDisabled={busy || (draft !== null && summaryText.trim().length === 0)}
      icon={<Scissors className="mt-0.5 h-5 w-5 shrink-0 text-violet-500 dark:text-violet-400" />}
      size="lg"
    >
      <div className="flex flex-col gap-4">
        {!draft && (
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm text-stone-600 dark:border-stone-800 dark:bg-stone-800/50 dark:text-stone-400">
            <p className="mb-2 font-medium text-stone-700 dark:text-stone-300">
              {t("compactContinueModal.whatWillHappen")}
            </p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>{t("compactContinueModal.explain.summary")}</li>
              <li>{t("compactContinueModal.explain.review")}</li>
              <li>{t("compactContinueModal.explain.launch")}</li>
            </ol>
          </div>
        )}

        {draft && (
          <div className="flex flex-col gap-3">
            <div className="rounded-lg border border-stone-200 p-3 text-xs text-stone-500 dark:border-stone-800 dark:text-stone-400">
              <p>
                {t("compactContinueModal.continuingFrom")}{" "}
                <span className="font-medium text-stone-700 dark:text-stone-300">{draft.oldTitle}</span>
              </p>
              <p className="mt-0.5 font-mono">
                id: {draft.oldSessionId}
                {draft.gitBranch ? ` · branch: ${draft.gitBranch}` : ""}
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-500 dark:text-stone-400">
                {t("compactContinueModal.summaryLabel")}
              </label>
              <textarea
                value={summaryText}
                onChange={(event) => setSummaryText(event.target.value)}
                rows={10}
                disabled={busy}
                className={TEXTAREA_CLASSNAME}
              />
              <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
                {t("compactContinueModal.summaryHint")}
              </p>
            </div>
          </div>
        )}

        {steps.length > 0 && (
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 dark:border-stone-800 dark:bg-stone-800/50">
            <p className="mb-2 text-sm font-medium text-stone-700 dark:text-stone-300">
              {t("compactContinueModal.progressLabel")}
            </p>
            <ol className="space-y-2">
              {steps.map((step) => (
                <li key={step.key} className="flex items-start gap-2">
                  {step.status === "pending" && (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-stone-300 dark:text-stone-600" />
                  )}
                  {step.status === "doing" && (
                    <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-stone-500 dark:text-stone-400" />
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
                          ? "text-stone-400 dark:text-stone-500"
                          : "text-stone-700 dark:text-stone-300"
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
          </div>
        )}
      </div>
    </Modal>
  );
}
