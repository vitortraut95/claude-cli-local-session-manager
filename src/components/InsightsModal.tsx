import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { useLanguage } from "../hooks/useLanguage";
import * as sessionsApi from "../services/sessionsApi";
import type { Session, SessionRepoInsights } from "../types/session";
import { computeSessionInsights } from "../utils/sessionInsights";

type InsightsModalProps = {
  session: Session;
  open: boolean;
  onClose: () => void;
};

export function InsightsModal({ session, open, onClose }: InsightsModalProps) {
  const [repoInsights, setRepoInsights] = useState<SessionRepoInsights | null>(null);
  const [loadError, setLoadError] = useState(false);
  const { t } = useLanguage();

  const SCOPE_LABEL: Record<"repo" | "session", string> = {
    repo: t("insightsModal.scopeRepo"),
    session: t("insightsModal.scopeSession"),
  };

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
    <Modal
      open={open}
      title={t("insightsModal.title", { title: session.title })}
      onClose={onClose}
      size="lg"
    >
      {!ready ? (
        <p className="text-sm text-stone-500 dark:text-stone-400">{t("insightsModal.loading")}</p>
      ) : (
        <>
          {loadError && (
            <p className="mb-3 text-xs text-amber-600 dark:text-amber-400">
              {t("insightsModal.loadError")}
            </p>
          )}
          {insights.length === 0 ? (
            <p className="text-sm text-stone-500 dark:text-stone-400">{t("insightsModal.empty")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {insights.map((insight, index) => (
                <li
                  key={index}
                  className="rounded-lg border border-stone-100 bg-stone-50 p-3 text-sm text-stone-700 dark:border-stone-800 dark:bg-stone-800/50 dark:text-stone-300"
                >
                  <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-stone-400 dark:text-stone-500">
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
