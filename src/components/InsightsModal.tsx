import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import * as sessionsApi from "../services/sessionsApi";
import type { Session, SessionRepoInsights } from "../types/session";
import { computeSessionInsights } from "../utils/sessionInsights";

type InsightsModalProps = {
  session: Session;
  open: boolean;
  onClose: () => void;
};

const SCOPE_LABEL: Record<"repo" | "session", string> = {
  repo: "Repo",
  session: "Session",
};

export function InsightsModal({ session, open, onClose }: InsightsModalProps) {
  const [repoInsights, setRepoInsights] = useState<SessionRepoInsights | null>(null);
  const [loadError, setLoadError] = useState(false);

  // Repo-level facts (CLAUDE.md presence, Explore-subagent topics) aren't in the /sessions list
  // payload, so they're fetched on demand here — guarded the same way as the other on-demand
  // modals (PromptPreviewModal/SubagentsModal) so reopening doesn't refetch every time.
  useEffect(() => {
    if (!open || repoInsights !== null || loadError) return;
    let cancelled = false;
    sessionsApi
      .fetchSessionRepoInsights(session.id)
      .then((data) => {
        if (!cancelled) setRepoInsights(data);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, repoInsights, loadError, session.id]);

  const ready = repoInsights !== null || loadError;
  const insights = ready ? computeSessionInsights(session, repoInsights) : [];

  return (
    <Modal open={open} title={`Insights — ${session.title}`} onClose={onClose} size="lg">
      {!ready ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Checking for ways to save tokens…
        </p>
      ) : (
        <>
          {loadError && (
            <p className="mb-3 text-xs text-amber-600 dark:text-amber-400">
              Couldn't check the repo for a CLAUDE.md or exploration patterns — showing
              session-level tips only.
            </p>
          )}
          {insights.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Nothing stands out — this session looks efficient.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {insights.map((insight, index) => (
                <li
                  key={index}
                  className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-300"
                >
                  <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    {SCOPE_LABEL[insight.scope]}
                  </span>
                  {insight.message}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Modal>
  );
}
