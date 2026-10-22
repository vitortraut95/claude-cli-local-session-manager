import { ExternalLink, Globe, Loader2, Play, Square, Trash2 } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useToast } from "../hooks/useToast";
import * as systemApi from "../services/systemApi";
import type { SessionPreview } from "../types/session";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { AnchoredMenu } from "./AnchoredMenu";
import { ConfirmDialog } from "./ConfirmDialog";
import { Tooltip } from "./Tooltip";

type PreviewLinksProps = {
  previews: SessionPreview[];
  /** Fired after a preview was stopped, started or removed, so the list reloads. */
  onChanged: () => void;
};

type Confirming = { preview: SessionPreview; action: "stop" | "remove" };

const BUTTON =
  "border-l px-1 py-0.5 text-gray-500 disabled:opacity-50 dark:text-gray-400 border-gray-200 dark:border-gray-700";

function hostAndPort(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

/**
 * The card's local URLs, behind one "N local URLs" button: a menu with one link per preview server
 * serving the session's folder or its task's worktrees. A worktree's container can be stopped
 * (frees its memory, stays listed) and started again, or removed — which otherwise only happens
 * when the task is marked done.
 */
export function PreviewLinks({ previews, onChanged }: PreviewLinksProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const [busy, setBusy] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);
  if (previews.length === 0) return null;

  const runningCount = previews.filter((preview) => preview.running !== false).length;

  const handleConfirm = async () => {
    if (!confirming) return;
    const { preview, action } = confirming;
    setBusy(true);
    try {
      if (action === "stop") await systemApi.stopPreview(preview.id);
      else await systemApi.removePreview(preview.id);
      showToast(
        t(action === "stop" ? "preview.stopped" : "preview.removed", { name: preview.name }),
        "success",
      );
      onChanged();
    } catch (err) {
      showToast(
        resolveApiErrorMessage(
          err,
          t,
          action === "stop" ? "preview.stopError" : "preview.removeError",
        ),
        "error",
      );
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  const handleStart = async (preview: SessionPreview) => {
    setStartingId(preview.id);
    try {
      await systemApi.startPreview(preview.id);
      showToast(t("preview.started", { name: preview.name }), "success");
      onChanged();
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "preview.startError"), "error");
    } finally {
      setStartingId(null);
    }
  };

  const removeButton = (preview: SessionPreview) =>
    preview.inWorktree &&
    preview.kind === "docker" && (
      <Tooltip content={t("preview.remove", { name: preview.name })}>
        <button
          type="button"
          onClick={() => setConfirming({ preview, action: "remove" })}
          aria-label={t("preview.remove", { name: preview.name })}
          className={`${BUTTON} hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400`}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </Tooltip>
    );

  return (
    <div className="flex min-w-0 items-center text-xs">
      <AnchoredMenu
        buttonClassName="gap-1.5 rounded-md border border-gray-200 px-2 py-0.5 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        label={
          <>
            <Globe className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
            {t("preview.menu", { count: previews.length })}
            {runningCount < previews.length && (
              <span className="text-gray-400 dark:text-gray-500">
                {t("preview.menuRunning", { count: runningCount })}
              </span>
            )}
          </>
        }
      >
        {() =>
          previews.map((preview) =>
            preview.running === false ? (
              <span
                key={preview.id}
                className="flex items-center overflow-hidden rounded-md border border-dashed border-gray-300 dark:border-gray-700"
              >
                <Tooltip
                  content={t("preview.stoppedState", { name: preview.name, url: preview.url })}
                >
                  <span className="px-1.5 py-0.5 font-mono text-gray-400 line-through dark:text-gray-500">
                    {hostAndPort(preview.url)}
                  </span>
                </Tooltip>
                <Tooltip content={t("preview.start", { name: preview.name })}>
                  <button
                    type="button"
                    onClick={() => void handleStart(preview)}
                    disabled={startingId !== null}
                    aria-label={t("preview.start", { name: preview.name })}
                    className={`${BUTTON} hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-950/40 dark:hover:text-green-400`}
                  >
                    {startingId === preview.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                  </button>
                </Tooltip>
                {removeButton(preview)}
              </span>
            ) : (
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
                    {hostAndPort(preview.url)}
                    <ExternalLink className="h-3 w-3 text-gray-400" />
                  </a>
                </Tooltip>
                {preview.inWorktree && (
                  <Tooltip content={t("preview.stop", { name: preview.name })}>
                    <button
                      type="button"
                      onClick={() => setConfirming({ preview, action: "stop" })}
                      aria-label={t("preview.stop", { name: preview.name })}
                      className={`${BUTTON} hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/40 dark:hover:text-amber-400`}
                    >
                      <Square className="h-3 w-3" />
                    </button>
                  </Tooltip>
                )}
                {removeButton(preview)}
              </span>
            ),
          )
        }
      </AnchoredMenu>
      <ConfirmDialog
        open={confirming !== null}
        title={t(
          confirming?.action === "remove"
            ? "preview.removeConfirmTitle"
            : "preview.stopConfirmTitle",
        )}
        message={t(
          confirming?.action === "remove"
            ? "preview.removeConfirmMessage"
            : "preview.stopConfirmMessage",
          { name: confirming?.preview.name ?? "", url: confirming?.preview.url ?? "" },
        )}
        confirmLabel={t(
          confirming?.action === "remove" ? "preview.removeConfirm" : "preview.stopConfirm",
        )}
        isLoading={busy}
        onConfirm={() => void handleConfirm()}
        onCancel={() => setConfirming(null)}
      />
    </div>
  );
}
