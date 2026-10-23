import { Check, Copy, Download, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useCopyFeedback } from "../hooks/useCopyFeedback";
import { useLanguage } from "../hooks/useLanguage";
import { useToast } from "../hooks/useToast";
import * as systemApi from "../services/systemApi";
import type { LimuxStatus } from "../services/systemApi";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { Button } from "./Button";

/**
 * Limux status under the "Where sessions open" setting, with a button that installs it (or
 * updates it to the newest release) under `~/.local`, no sudo. System libraries it still lacks
 * are listed with the apt command to copy.
 */
export function LimuxSetup() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { copiedKey, copy } = useCopyFeedback();
  const [status, setStatus] = useState<LimuxStatus | null>(null);
  const [installing, setInstalling] = useState(false);

  const reload = useCallback(async () => {
    setStatus(await systemApi.fetchLimuxStatus().catch(() => null));
  }, []);

  useEffect(() => {
    // Fetch-on-mount — the state update only happens after the await inside `reload`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  const install = async () => {
    setInstalling(true);
    try {
      const result = await systemApi.installLimux();
      setStatus(result);
      showToast(
        t(
          result.source === "bundled"
            ? "settings.limux.installedBundled"
            : "settings.limux.installed",
          { version: result.version ?? "" },
        ),
        "success",
      );
      if (result.running) showToast(t("settings.limux.restart"), "success");
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "settings.limux.installError"), "error");
    } finally {
      setInstalling(false);
    }
  };

  if (!status) return null;

  return (
    <div className="mt-2 space-y-2 text-xs">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {!status.installed ? (
          <span className="text-amber-600 dark:text-amber-400">
            {t("settings.limux.notInstalled")}
          </span>
        ) : (
          <span className="text-gray-700 dark:text-gray-300">
            {t("settings.limux.version", { version: status.version ?? "?" })}
            {status.managed && ` · ${t("settings.limux.managed")}`}
            {status.updateAvailable && (
              <span className="text-amber-600 dark:text-amber-400">
                {" · "}
                {t("settings.limux.updateAvailable", { version: status.latest })}
              </span>
            )}
          </span>
        )}
        {(!status.installed || status.updateAvailable) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void install()}
            disabled={installing}
            icon={
              installing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )
            }
          >
            {t(
              installing
                ? "settings.limux.installing"
                : status.installed
                  ? "settings.limux.update"
                  : "settings.limux.install",
            )}
          </Button>
        )}
      </div>
      {status.aptCommand && (
        <div className="space-y-1">
          <p className="text-amber-600 dark:text-amber-400">
            {t("settings.limux.missingLibs", { libs: status.missingLibs.join(", ") })}
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-gray-100 px-2 py-1 font-mono text-gray-800 dark:bg-gray-800 dark:text-gray-200">
              {status.aptCommand}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                status.aptCommand && void copy(status.aptCommand).catch(() => undefined)
              }
              icon={
                copiedKey === status.aptCommand ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )
              }
            >
              {t(copiedKey === status.aptCommand ? "settings.limux.copied" : "settings.limux.copy")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
