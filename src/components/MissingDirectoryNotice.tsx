import { Code2, Loader2, Play, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import type { TerminalLayout } from "../services/preferencesApi";
import type { Session } from "../../shared/session";
import { Button } from "./Button";
import { LaunchLayoutButton } from "./LaunchLayoutButton";
import { Tooltip } from "./Tooltip";

type MissingDirectoryNoticeProps = {
  session: Session;
  isOpeningVSCode: boolean;
  isResumingAtMissingWorktreeRoot: boolean;
  onOpenMissingWorktreeRootInVSCode: (session: Session) => void;
  onStartNewSessionAtMissingWorktreeRoot: (
    session: Session,
    layout?: TerminalLayout,
  ) => Promise<void>;
};

/** Session card banner for a deleted folder; a removed worktree also offers its repo root. */
export function MissingDirectoryNotice({
  session,
  isOpeningVSCode,
  isResumingAtMissingWorktreeRoot,
  onOpenMissingWorktreeRootInVSCode,
  onStartNewSessionAtMissingWorktreeRoot,
}: MissingDirectoryNoticeProps) {
  const { t } = useLanguage();
  const [resumingAtRoot, setResumingAtRoot] = useState(false);

  return (
    <div className="flex flex-col gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
      <div
        className="flex items-center gap-1.5"
        title={
          session.workingDirectory
            ? t("sessionCard.directoryMissing.tooltipWithPath", {
                path: session.workingDirectory,
              })
            : t("sessionCard.directoryMissing.tooltipNoPath")
        }
      >
        <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
        {t("sessionCard.directoryMissing.title")}
      </div>

      {session.missingWorktreeRepoRoot && (
        <div className="flex flex-col gap-1.5 pl-0.5 font-normal text-gray-600 dark:text-gray-400">
          <span className="break-all">
            {t("sessionCard.directoryMissing.removedWorktree")}{" "}
            <span className="font-mono">{session.missingWorktreeRepoRoot}</span>
          </span>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenMissingWorktreeRootInVSCode(session)}
              disabled={isOpeningVSCode}
              aria-label={t("sessionCard.directoryMissing.openRootAriaLabel")}
              icon={
                isOpeningVSCode ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Code2 className="h-3.5 w-3.5" />
                )
              }
            >
              {t("sessionCard.codeButton")}
            </Button>
            <Tooltip content={t("sessionCard.directoryMissing.newSessionTooltip")}>
              <span className="inline-flex">
                <LaunchLayoutButton
                  variant="outline"
                  size="sm"
                  label={t("sessionCard.newSessionAtRootButton")}
                  icon={<Play className="h-3.5 w-3.5" />}
                  busy={resumingAtRoot || isResumingAtMissingWorktreeRoot}
                  onLaunch={async (layout) => {
                    setResumingAtRoot(true);
                    try {
                      await onStartNewSessionAtMissingWorktreeRoot(session, layout);
                    } finally {
                      setResumingAtRoot(false);
                    }
                  }}
                />
              </span>
            </Tooltip>
          </div>
        </div>
      )}
    </div>
  );
}
