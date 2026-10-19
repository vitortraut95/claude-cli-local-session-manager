import { FileUp, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useToast } from "../hooks/useToast";
import * as tasksApi from "../services/tasksApi";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { readJsonFile } from "../utils/preferencesFile";
import { Button } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";

type ImportPreferencesButtonProps = {
  onImported: () => void;
};

/** Picks a `userPreferences.json` and, after confirming, replaces every setting with it. */
export function ImportPreferencesButton({ onImported }: ImportPreferencesButtonProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<unknown>(null);
  const [importing, setImporting] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPending(await readJsonFile(file));
    } catch {
      showToast(t("preferencesFile.invalid"), "error");
    }
  };

  const handleConfirm = async () => {
    setImporting(true);
    try {
      await tasksApi.importPreferences(pending);
      tasksApi.notifyPreferencesChanged();
      tasksApi.notifySkillsHubChanged();
      showToast(t("preferencesFile.imported"), "success");
      setPending(null);
      onImported();
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "preferencesFile.importError"), "error");
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={importing}
        icon={
          importing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileUp className="h-3.5 w-3.5" />
          )
        }
      >
        {t("preferencesFile.import")}
      </Button>
      <ConfirmDialog
        open={pending !== null}
        title={t("preferencesFile.confirmTitle")}
        message={t("preferencesFile.confirmMessage")}
        confirmLabel={t("preferencesFile.confirm")}
        cancelLabel={t("preferencesFile.cancel")}
        isLoading={importing}
        onConfirm={() => void handleConfirm()}
        onCancel={() => setPending(null)}
      />
    </>
  );
}
