import { ChevronRight, ExternalLink } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import type { WatcherDecision } from "../services/boardWatcherApi";
import { formatUpdatedAt } from "../utils/formatDate";
import { DECISION_ACTION_KEYS, translateServerText } from "../utils/boardWatcher";
import { WatcherBadge } from "./WatcherBadge";

const LINK_KEYS = {
  pr: "board.decision.openPr",
  issue: "board.decision.openIssue",
} as const;

const DIAGNOSIS_KIND_KEYS = {
  infra: "board.decision.build.infra",
  code: "board.decision.build.code",
  unknown: "board.decision.build.unknown",
} as const;

/** One decision of the last look; opens to show why it's on the list, the failed build (with
 *  its diagnosis) and links to the PR and ticket. */
export function DecisionItem({ decision }: { decision: WatcherDecision }) {
  const { t, language } = useLanguage();
  const { context, build, links = [] } = decision;

  return (
    <li className="border-b border-gray-100 pb-2 last:border-b-0 dark:border-gray-800">
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-col gap-1 [&::-webkit-details-marker]:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <ChevronRight
              aria-hidden
              className="h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform group-open:rotate-90 motion-reduce:transition-none"
            />
            <span className="break-all font-mono text-xs font-medium text-gray-900 dark:text-gray-100">
              {decision.subject}
            </span>
            <WatcherBadge>{t(DECISION_ACTION_KEYS[decision.action])}</WatcherBadge>
          </div>
          <p className="pl-5 text-xs text-gray-600 dark:text-gray-400">
            {translateServerText(decision.reason, language)}
          </p>
        </summary>
        <div className="mt-2 flex flex-col gap-2 pl-5 text-xs text-gray-700 dark:text-gray-300">
          {context && (
            <p>
              {t(
                context.kind === "unapproved-deploying"
                  ? "board.decision.context.unapprovedDeploying"
                  : "board.decision.context.pushedAfterApproval",
                {
                  keys: context.keys.join(", "),
                  pushedAt: formatUpdatedAt(context.lastPushAt),
                },
              )}
            </p>
          )}
          {build && (
            <div className="flex flex-col gap-1 rounded-md bg-gray-50 p-2 dark:bg-gray-900">
              <p className="font-medium">
                {t("board.decision.build.failed", { name: build.name })}
                {build.diagnosis && ` · ${t(DIAGNOSIS_KIND_KEYS[build.diagnosis.kind])}`}
              </p>
              {build.diagnosis === undefined && <p>{t("board.decision.build.reading")}</p>}
              {build.diagnosis === null && <p>{t("board.decision.build.noLog")}</p>}
              {build.diagnosis && (
                <>
                  <p>
                    <span className="font-medium">{build.diagnosis.stage}</span>:{" "}
                    {build.diagnosis.cause}
                  </p>
                  <p>
                    <span className="font-medium">{t("board.decision.build.fix")}</span>{" "}
                    {build.diagnosis.fix}
                  </p>
                </>
              )}
            </div>
          )}
          {(links.length > 0 || build) && (
            <div className="flex flex-wrap gap-3">
              {build && (
                <a
                  href={build.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                >
                  {t("board.decision.openJenkins")}
                  <ExternalLink aria-hidden className="h-3 w-3" />
                </a>
              )}
              {links.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                >
                  {t(LINK_KEYS[link.kind])}
                  <ExternalLink aria-hidden className="h-3 w-3" />
                </a>
              ))}
            </div>
          )}
        </div>
      </details>
    </li>
  );
}
