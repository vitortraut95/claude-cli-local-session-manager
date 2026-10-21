import { ExternalLink, Globe, Square } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useToast } from "../hooks/useToast";
import * as systemApi from "../services/systemApi";
import type { SessionPreview } from "../types/session";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { ConfirmDialog } from "./ConfirmDialog";
import { Tooltip } from "./Tooltip";

type PreviewLinksProps = {
  previews: SessionPreview[];
  /** Fired after a preview was stopped, so the list drops it. */
  onStopped: () => void;
};

/** The card's local URLs: one link per preview server serving the session's folder or its task's
 *  worktrees, with a stop button on a worktree's (they hold memory until the task is done). */
export function PreviewLinks({ previews, onStopped }: PreviewLinksProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [stopping, setStopping] = useState<SessionPreview | null>(null);
  const [busy, setBusy] = useState(false);

  if (previews.length === 0) return null;

  const handleStop = async () => {
    if (!stopping) return;
    setBusy(true);
    try {
      await systemApi.stopPreview(stopping.id);
      showToast(t("preview.stopped", { name: stopping.name }), "success");
      onStopped();
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "preview.stopError"), "error");
    } finally {
      setBusy(false);
      setStopping(null);
    }
  };

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
      <Globe className="h-3.5 w-3.5 shrink-0 text-gray-500 dark:text-gray-400" />
      {previews.map((preview) => (
        <span
          key={preview.id}
          className="flex items-center overflow-hidden rounded-md border border-gray-200 dark:border-gray-700"
        >
          <Tooltip content={t("preview.open", { name: preview.name })}>
            <a
              href={preview.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 px-1.5 py-0.5 font-mono text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {preview.url.replace(/^https?:\/\//, "")}
              <ExternalLink className="h-3 w-3 text-gray-400" />
            </a>
          </Tooltip>
          {preview.inWorktree && (
            <Tooltip content={t("preview.stop", { name: preview.name })}>
              <button
                type="button"
                onClick={() => setStopping(preview)}
                aria-label={t("preview.stop", { name: preview.name })}
                className="border-l border-gray-200 px-1 py-0.5 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
              >
                <Square className="h-3 w-3" />
              </button>
            </Tooltip>
          )}
        </span>
      ))}
      <ConfirmDialog
        open={stopping !== null}
        title={t("preview.stopConfirmTitle")}
        message={t("preview.stopConfirmMessage", {
          name: stopping?.name ?? "",
          url: stopping?.url ?? "",
        })}
        confirmLabel={t("preview.stopConfirm")}
        isLoading={busy}
        onConfirm={() => void handleStop()}
        onCancel={() => setStopping(null)}
      />
    </div>
  );
}
