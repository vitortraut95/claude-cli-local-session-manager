import { ArrowUpCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useToast } from "../hooks/useToast";
import * as systemApi from "../services/systemApi";
import type { ClaudeCliStatus } from "../services/systemApi";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { Tooltip } from "./Tooltip";

/** A navigation-footer row shown only while a newer Claude CLI exists; a click runs `claude update`. */
export function ClaudeCliUpdateButton() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [status, setStatus] = useState<ClaudeCliStatus | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    systemApi
      .fetchClaudeCliStatus()
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status?.updateAvailable) return null;

  const update = async () => {
    setUpdating(true);
    try {
      const next = await systemApi.updateClaudeCli();
      setStatus(next);
      showToast(
        t("claudeCli.updated", { version: next.version ?? status.latest ?? "" }),
        "success",
      );
    } catch (err) {
      showToast(
        `${resolveApiErrorMessage(err, t, "claudeCli.updateError")} ${t("claudeCli.runByHand", {
          command: status.updateCommand,
        })}`,
        "error",
      );
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Tooltip
      content={t("claudeCli.tooltip", {
        version: status.version ?? "",
        latest: status.latest ?? "",
        command: status.updateCommand,
      })}
    >
      <button
        type="button"
        onClick={() => void update()}
        disabled={updating}
        className="flex min-h-10 w-full items-center gap-2.5 rounded-lg border border-violet-300 bg-violet-50 px-2.5 text-left text-sm font-medium text-violet-800 transition-colors hover:bg-violet-100 disabled:cursor-default dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-300"
      >
        {updating ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        ) : (
          <ArrowUpCircle className="h-4 w-4 shrink-0" />
        )}
        <span className="min-w-0 flex-1 truncate">
          {updating
            ? t("claudeCli.updating")
            : t("claudeCli.available", { latest: status.latest ?? "" })}
        </span>
      </button>
    </Tooltip>
  );
}
