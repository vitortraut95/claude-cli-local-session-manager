import { AlertTriangle, Check, Copy, Download, ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";
import { useCopyFeedback } from "../hooks/useCopyFeedback";
import { useLanguage } from "../hooks/useLanguage";
import { useToast } from "../hooks/useToast";
import * as skillsHubApi from "../services/skillsHubApi";
import type { SkillsHubStatus } from "../services/skillsHubApi";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { Button } from "./Button";
import { Input } from "./Input";
import { Select } from "./Select";

/** Hub not cloned yet: clone it into a workspace folder, clone by hand, or point to an existing clone. */
export function SkillsHubInstallSection({
  status,
  onDone,
}: {
  status: SkillsHubStatus;
  onDone: () => Promise<void>;
}) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [parentDir, setParentDir] = useState(status.cloneParentDirs[0] ?? "~");
  const [cloning, setCloning] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const target = `${parentDir.replace(/\/+$/, "")}/${status.cloneFolderName ?? "skills-hub"}`;

  const clone = async () => {
    setCloning(true);
    setCloneError(null);
    try {
      await skillsHubApi.cloneSkillsHub(parentDir);
      skillsHubApi.notifySkillsHubChanged();
      showToast(t("skillsHub.cloned"), "success");
      await onDone();
    } catch (err) {
      setCloneError(resolveApiErrorMessage(err, t, "skillsHub.cloneError"));
    } finally {
      setCloning(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 text-sm text-gray-700 dark:text-gray-300">
      <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 dark:border-violet-900/60 dark:bg-violet-950/30">
        <p className="font-medium text-violet-900 dark:text-violet-200">
          {t("skillsHub.invite.title")}
        </p>
        <p className="mt-1 text-violet-800 dark:text-violet-300">
          {t("skillsHub.invite.body", { dir: status.userSkillsDir })}
        </p>
        <p className="mt-1 text-xs text-violet-700 dark:text-violet-400">
          {t("skillsHub.invite.optional")}
        </p>
      </div>

      {status.configuredPathInvalid && (
        <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {t("skillsHub.configuredPathInvalid")}
        </p>
      )}

      <section>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">
          1. {t("skillsHub.install.cloneTitle")}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {status.cloneParentDirs.length > 1 ? (
            <div className="min-w-60 flex-1">
              <Select value={parentDir} onChange={(event) => setParentDir(event.target.value)}>
                {status.cloneParentDirs.map((dir) => (
                  <option key={dir} value={dir}>
                    {dir}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          <Button
            onClick={() => void clone()}
            disabled={cloning}
            icon={
              cloning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )
            }
          >
            {t("skillsHub.install.cloneButton", { target })}
          </Button>
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {t("skillsHub.install.sshNote")}
        </p>
        {cloneError && (
          <p className="mt-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400">
            {cloneError}
          </p>
        )}
      </section>

      <section>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">
          2. {t("skillsHub.install.manualTitle")}
        </h3>
        <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
          {t("skillsHub.install.manualBody")}
        </p>
        <CopyableCommand command={`git clone ${status.cloneUrl ?? ""} ${target}`} />
        {status.webUrl && (
          <a
            href={status.webUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs text-gray-600 underline hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <ExternalLink className="h-3 w-3" />
            {t("skillsHub.install.openRepo")}
          </a>
        )}
      </section>

      <section>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">
          {t("skillsHub.install.existingTitle")}
        </h3>
        <PathOverride onDone={onDone} />
      </section>
    </div>
  );
}

function CopyableCommand({ command }: { command: string }) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { copiedKey, copy } = useCopyFeedback();
  return (
    <div className="flex items-center gap-2 rounded-md bg-gray-900 px-3 py-2 font-mono text-xs text-gray-100 dark:bg-black">
      <code className="min-w-0 flex-1 break-all">{command}</code>
      <Button
        variant="unstyled"
        size="icon"
        className="text-gray-300 hover:bg-gray-700"
        aria-label={t("skillsHub.copy")}
        onClick={() => {
          copy(command).catch(() => showToast(t("skillsHub.copyFailed"), "error"));
        }}
        icon={
          copiedKey === command ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )
        }
      />
    </div>
  );
}

function PathOverride({ onDone, initial }: { onDone: () => Promise<void>; initial?: string }) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [value, setValue] = useState(initial ?? "");
  const [saving, setSaving] = useState(false);
  const save = async (path: string | null) => {
    setSaving(true);
    try {
      await skillsHubApi.setSkillsHubPath(path);
      skillsHubApi.notifySkillsHubChanged();
      await onDone();
      showToast(t("skillsHub.pathSaved"), "success");
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "skillsHub.pathSaveError"), "error");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="flex gap-2">
      <div className="flex-1">
        <Input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="~/git/skills-hub"
          className="font-mono"
        />
      </div>
      <Button
        variant="outline"
        disabled={saving || !value.trim()}
        onClick={() => void save(value)}
        icon={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
      >
        {t("skillsHub.usePath")}
      </Button>
      {initial && (
        <Button variant="ghost" disabled={saving} onClick={() => void save(null)}>
          {t("skillsHub.autoDetect")}
        </Button>
      )}
    </div>
  );
}
