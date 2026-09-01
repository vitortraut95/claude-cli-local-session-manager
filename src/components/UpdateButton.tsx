import { Loader2, RefreshCw } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import type { TranslationKey } from "../i18n/translations";
import type { UpdateStatus } from "../services/systemApi";
import { Button } from "./Button";
import { Tooltip } from "./Tooltip";

type UpdateButtonProps = {
  status: UpdateStatus | null;
  checking: boolean;
  updating: boolean;
  onUpdate: () => void;
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
  if (!status.updateAvailable) return t("updateButton.upToDate");

  const branch = status.tracking ?? status.branch;
  return status.behind === 1
    ? t("updateButton.updateAvailable.one", { branch })
    : t("updateButton.updateAvailable.many", { count: status.behind, branch });
}

export function UpdateButton({ status, checking, updating, onUpdate }: UpdateButtonProps) {
  const { t } = useLanguage();
  const isBusy = checking || updating;
  const updateAvailable = !!status?.updateAvailable;
  const disabled = isBusy || !updateAvailable;

  return (
    <Tooltip content={describeStatus(status, checking, updating, t)}>
      <span className="relative inline-flex">
        <Button
          variant="unstyled"
          onClick={onUpdate}
          disabled={disabled}
          className={`border ${
            updateAvailable
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
          <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-gray-900" />
        )}
      </span>
    </Tooltip>
  );
}
