import { AlertTriangle, FolderGit2, GitBranch, Loader2, RefreshCw, Settings } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import * as skillsHubApi from "../services/skillsHubApi";
import type { SkillsHubStatus } from "../services/skillsHubApi";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { describeSync, type SyncSummary } from "../utils/skillsHub";
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
  const [lastSync, setLastSync] = useState<SyncSummary | null>(null);
  const [showPath, setShowPath] = useState(false);

  const syncNow = async () => {
    setSyncing(true);
    try {
      const result = await skillsHubApi.syncSkillsHub();
      setLastSync(describeSync(result, t));
      skillsHubApi.notifySkillsHubChanged();
      await onChanged();
    } catch (err) {
      setLastSync({
        warning: true,
        text: resolveApiErrorMessage(err, t, "skillsHub.syncError"),
        notUpdated: null,
      });
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
      {!onDefaultBranch && status.defaultBranch && (
        <div
          role="status"
          className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
        >
          <p className="flex items-center gap-1.5 font-medium">
            <GitBranch className="h-3.5 w-3.5 shrink-0" />
            {t("skillsHub.manage.offDefault.title", {
              branch: status.branch ?? t("skillsHub.manage.detached"),
              defaultBranch: status.defaultBranch,
            })}
          </p>
          <p className="mt-1">
            {status.upstream
              ? t("skillsHub.manage.offDefault.body", {
                  upstream: status.upstream,
                  defaultBranch: status.defaultBranch,
                })
              : t("skillsHub.manage.offDefault.noUpstream", {
                  defaultBranch: status.defaultBranch,
                })}
          </p>
          <p className="mt-1">
            {t("skillsHub.manage.offDefault.hint", { defaultBranch: status.defaultBranch })}
          </p>
        </div>
      )}
      {showPath && (
        <p className="mt-3 flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300">
          <Settings className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {t("skillsHub.manage.changePathHint")}
        </p>
      )}
      {lastSync?.notUpdated && <NotUpdatedNotice notice={lastSync.notUpdated} />}
      {lastSync && lastSync.text.length > 0 && (
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

const MAX_FILES_SHOWN = 8;

/** Why the remote's commits weren't applied, the files in the way and how to unblock it. */
function NotUpdatedNotice({ notice }: { notice: NonNullable<SyncSummary["notUpdated"]> }) {
  const { t } = useLanguage();
  const shown = notice.files.slice(0, MAX_FILES_SHOWN);
  const hidden = notice.files.length - shown.length;
  return (
    <div
      role="alert"
      className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
    >
      <p className="flex items-center gap-1.5 font-medium">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        {t("skillsHub.sync.notUpdatedTitle")}
      </p>
      <p className="mt-1">{notice.reason}</p>
      {shown.length > 0 && (
        <ul className="mt-1 list-disc pl-5 font-mono break-all">
          {shown.map((file) => (
            <li key={file}>{file}</li>
          ))}
          {hidden > 0 && (
            <li className="list-none">{t("skillsHub.sync.moreFiles", { count: hidden })}</li>
          )}
        </ul>
      )}
      {notice.error && <p className="mt-1 font-mono break-all">{notice.error}</p>}
      <p className="mt-2">{notice.hint}</p>
    </div>
  );
}
