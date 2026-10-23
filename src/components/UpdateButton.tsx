import { Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import type { TranslationKey } from "../i18n/translations";
import type { UpdateStatus } from "../services/systemApi";
import { Button } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";
import { Tooltip } from "./Tooltip";

type UpdateButtonProps = {
  status: UpdateStatus | null;
  checking: boolean;
  updating: boolean;
  /** `force` = the user confirmed discarding local changes. */
  onUpdate: (force: boolean) => void;
};

function describeStatus(
  status: UpdateStatus | null,
  checking: boolean,
  updating: boolean,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
) {
  if (checking) return t("updateButton.checking");
  if (updating) return t("updateButton.updating");
  if (!status) return t("updateButton.checkError");

  const branch = status.tracking;
  const summary = !status.updateAvailable
    ? t("updateButton.upToDate")
    : status.behind === 1
      ? t("updateButton.updateAvailable.one", { branch })
      : t("updateButton.updateAvailable.many", { count: status.behind, branch });
  return status.hasLocalChanges ? `${t("updateButton.localChanges")} ${summary}` : summary;
}

/** Amber with local changes: no auto-update then, and a click first confirms discarding them. */
export function UpdateButton({ status, checking, updating, onUpdate }: UpdateButtonProps) {
  const { t } = useLanguage();
  const [confirming, setConfirming] = useState(false);
  const isBusy = checking || updating;
  const updateAvailable = !!status?.updateAvailable;
  const disabled = isBusy || !updateAvailable;
  const changedFiles = status?.changedFiles ?? [];
  const changedFileCount = status?.changedFileCount ?? changedFiles.length;

  return (
    <>
      <Tooltip content={describeStatus(status, checking, updating, t)}>
        <span className="relative inline-flex">
          <Button
            variant="unstyled"
            onClick={() => (status?.hasLocalChanges ? setConfirming(true) : onUpdate(false))}
            disabled={disabled}
            className={`border ${
              status?.hasLocalChanges
                ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-400 dark:hover:bg-amber-950"
                : updateAvailable
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-400 dark:hover:bg-emerald-950"
                  : "border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-600"
            }`}
            icon={
              isBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )
            }
          >
            {t("updateButton.label")}
          </Button>
          {updateAvailable && !isBusy && (
            <span
              className={`absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-gray-900 ${
                status?.hasLocalChanges ? "bg-amber-500" : "bg-emerald-500"
              }`}
            />
          )}
        </span>
      </Tooltip>
      {status && (
        <ConfirmDialog
          open={confirming}
          title={t("updateButton.confirm.title")}
          message={t("updateButton.confirm.message", { branch: status.tracking })}
          confirmLabel={t("updateButton.confirm.confirm")}
          onConfirm={() => {
            setConfirming(false);
            onUpdate(true);
          }}
          onCancel={() => setConfirming(false)}
        >
          <div className="mt-3 space-y-2 text-xs text-gray-700 dark:text-gray-300">
            {status.ahead > 0 && (
              <p>
                {t("updateButton.confirm.commits", {
                  count: status.ahead,
                  branch: status.tracking,
                })}
              </p>
            )}
            {changedFileCount > 0 && (
              <div>
                <p>{t("updateButton.confirm.files", { count: changedFileCount })}</p>
                <pre className="mt-1 max-h-48 overflow-auto rounded bg-gray-100 p-2 font-mono dark:bg-gray-800">
                  {changedFiles.join("\n")}
                  {changedFileCount > changedFiles.length &&
                    `\n${t("updateButton.confirm.more", { count: changedFileCount - changedFiles.length })}`}
                </pre>
              </div>
            )}
          </div>
        </ConfirmDialog>
      )}
    </>
  );
}
