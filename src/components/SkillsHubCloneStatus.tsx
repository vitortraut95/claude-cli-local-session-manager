import { AlertTriangle, FolderGit2, Loader2, RefreshCw, Settings } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import * as skillsHubApi from "../services/skillsHubApi";
import type { SkillsHubStatus } from "../services/skillsHubApi";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { describeSync } from "../utils/skillsHub";
import { Button } from "./Button";
import { SkillsOpenFolderMenu } from "./SkillsOpenFolderMenu";

/** The hub clone's folder and branch state, with "change path", "open folder" and "update now". */
export function SkillsHubCloneStatus({
  status,
  onChanged,
}: {
  status: SkillsHubStatus;
  onChanged: () => Promise<void>;
}) {
  const { t } = useLanguage();
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<{ warning: boolean; text: string } | null>(null);
  const [showPath, setShowPath] = useState(false);

  const syncNow = async () => {
    setSyncing(true);
    try {
      const result = await skillsHubApi.syncSkillsHub();
      setLastSync(describeSync(result, t));
      skillsHubApi.notifySkillsHubChanged();
      await onChanged();
    } catch (err) {
      setLastSync({ warning: true, text: resolveApiErrorMessage(err, t, "skillsHub.syncError") });
    } finally {
      setSyncing(false);
    }
  };

  const onDefaultBranch = status.branch !== null && status.branch === status.defaultBranch;

  return (
    <section className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-mono text-xs text-gray-900 dark:text-gray-100">
            <FolderGit2 className="h-4 w-4 shrink-0 text-gray-400" />
            <span className="break-all">{status.path}</span>
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t("skillsHub.manage.branch")}{" "}
            <span className="font-mono text-gray-800 dark:text-gray-200">
              {status.branch ?? t("skillsHub.manage.detached")}
            </span>
            {status.behind !== null && status.behind > 0 && (
              <> · {t("skillsHub.manage.behind", { count: status.behind })}</>
            )}
            {status.ahead !== null && status.ahead > 0 && (
              <> · {t("skillsHub.manage.ahead", { count: status.ahead })}</>
            )}
            {status.dirty && <> · {t("skillsHub.manage.dirty")}</>}
          </p>
          {!onDefaultBranch && status.defaultBranch && (
            <p className="mt-1 flex items-start gap-1 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              {t("skillsHub.manage.notDefaultBranch", { defaultBranch: status.defaultBranch })}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowPath((v) => !v)}>
            {t("skillsHub.manage.changePath")}
          </Button>
          <SkillsOpenFolderMenu hubPath={status.path ?? ""} userSkillsDir={status.userSkillsDir} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => void syncNow()}
            disabled={syncing}
            icon={
              syncing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )
            }
          >
            {t("skillsHub.manage.syncNow")}
          </Button>
        </div>
      </div>
      {showPath && (
        <p className="mt-3 flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300">
          <Settings className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {t("skillsHub.manage.changePathHint")}
        </p>
      )}
      {lastSync && (
        <p
          className={`mt-2 text-xs ${lastSync.warning ? "text-amber-700 dark:text-amber-400" : "text-green-700 dark:text-green-400"}`}
        >
          {lastSync.text}
        </p>
      )}
      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        {t("skillsHub.manage.syncHelp", { dir: status.userSkillsDir })}
      </p>
    </section>
  );
}
