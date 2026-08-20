import { GitBranch, GitPullRequest, Loader2 } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useToast } from "../hooks/useToast";
import * as sessionsApi from "../services/sessionsApi";
import type { Session } from "../types/session";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { Button } from "./Button";
import { Modal } from "./Modal";

type OpenPrBaseChoiceModalProps = {
  session: Session;
  onClose: () => void;
};

/**
 * Shown instead of opening the PR link directly whenever `session.baseBranch` is set — i.e. the
 * session's worktree was branched off something other than the repo's own default (see
 * `Session.baseBranch`/`taskBaseBranches.ts`), so the plain compare link's implicit
 * default-branch comparison would show every commit already on that base as part of the "diff"
 * too. Offers the accurate compare link (explicit `<base>...<branch>`, see `getSessionPrUrl`)
 * alongside the option to fall back to the default anyway (e.g. the base branch was since merged
 * or deleted, or the default is genuinely what's wanted) — same two-real-choices layout as
 * `SessionSizeGateModal`, not a confirm/cancel pair.
 */
export function OpenPrBaseChoiceModal({ session, onClose }: OpenPrBaseChoiceModalProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [loadingChoice, setLoadingChoice] = useState<"base" | "default" | null>(null);

  const openWith = async (base: string | undefined, choice: "base" | "default") => {
    if (!session.gitBranch) return;
    setLoadingChoice(choice);
    try {
      const url = await sessionsApi.fetchPrUrl(session.id, session.gitBranch, base);
      window.open(url, "_blank", "noopener,noreferrer");
      onClose();
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "sessionCard.openPr.error"), "error");
    } finally {
      setLoadingChoice(null);
    }
  };

  const busy = loadingChoice !== null;
  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  return (
    <Modal open title={t("openPrBaseChoiceModal.title")} onClose={handleClose} size="md">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {t("openPrBaseChoiceModal.intro", { branch: session.baseBranch ?? "" })}
      </p>

      <div className="mt-4 rounded-lg border border-violet-200 p-3 dark:border-violet-900/60">
        <p className="flex items-center gap-1.5 text-sm font-medium text-violet-700 dark:text-violet-400">
          <GitBranch className="h-4 w-4 shrink-0" />
          {t("openPrBaseChoiceModal.useBase.title", { branch: session.baseBranch ?? "" })}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {t("openPrBaseChoiceModal.useBase.body")}
        </p>
        <div className="mt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void openWith(session.baseBranch ?? undefined, "base")}
            icon={
              loadingChoice === "base" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <GitPullRequest className="h-3.5 w-3.5" />
              )
            }
          >
            {t("openPrBaseChoiceModal.useBase.button", { branch: session.baseBranch ?? "" })}
          </Button>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-gray-200 p-3 dark:border-gray-800">
        <p className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
          <GitPullRequest className="h-4 w-4 shrink-0" />
          {t("openPrBaseChoiceModal.useDefault.title")}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {t("openPrBaseChoiceModal.useDefault.body")}
        </p>
        <div className="mt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void openWith(undefined, "default")}
            icon={
              loadingChoice === "default" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : undefined
            }
          >
            {t("openPrBaseChoiceModal.useDefault.button")}
          </Button>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button variant="outline" onClick={handleClose} disabled={busy}>
          {t("openPrBaseChoiceModal.cancel")}
        </Button>
      </div>
    </Modal>
  );
}
