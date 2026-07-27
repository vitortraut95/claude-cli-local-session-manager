import type { Session, SessionRepoInsights } from "../types/session";
import { sessionSizeMessage, sessionSizeStatus } from "./sessionSize";

export type InsightScope = "repo" | "session";

export type Insight = {
  scope: InsightScope;
  message: string;
};

/** Below this, per-model token totals are too small for a cache-hit ratio to mean anything. */
const MIN_TOKENS_FOR_CACHE_TIP = 50_000;
const LOW_CACHE_HIT_RATIO = 0.4;
const HIGH_SUBAGENT_COST_SHARE = 0.3;
const MIN_SUBAGENTS_FOR_COST_TIP = 3;

function sizeInsight(session: Session): Insight | null {
  if (sessionSizeStatus(session.sizeBytes) === "healthy") return null;
  return { scope: "session", message: sessionSizeMessage(session.sizeBytes) };
}

/**
 * A response's cache-read share of its total context is the most direct signal this app can
 * compute for "is this session re-paying for context it already sent" — a low ratio usually means
 * turns are spaced out past the cache's 5-minute TTL (or context got cleared) rather than an
 * inherent property of the task.
 */
function cacheEfficiencyInsight(session: Session): Insight | null {
  const totals = session.usage.models.reduce(
    (acc, model) => ({
      input: acc.input + model.inputTokens,
      cacheWrite: acc.cacheWrite + model.cacheCreationInputTokens,
      cacheRead: acc.cacheRead + model.cacheReadInputTokens,
    }),
    { input: 0, cacheWrite: 0, cacheRead: 0 },
  );
  const totalContextTokens = totals.input + totals.cacheWrite + totals.cacheRead;
  if (totalContextTokens < MIN_TOKENS_FOR_CACHE_TIP) return null;

  const cacheHitRatio = totals.cacheRead / totalContextTokens;
  if (cacheHitRatio >= LOW_CACHE_HIT_RATIO) return null;

  return {
    scope: "session",
    message:
      `Low cache reuse (only ${Math.round(cacheHitRatio * 100)}% of context came from cache) — ` +
      `keep turns close together, since the cache expires after 5 minutes idle.`,
  };
}

function subagentCostInsight(session: Session): Insight | null {
  const { subagentCostUsd, totalCostUsd } = session.usage;
  if (session.subagentCount < MIN_SUBAGENTS_FOR_COST_TIP) return null;
  if (subagentCostUsd === null || totalCostUsd === null || totalCostUsd <= 0) return null;

  const share = subagentCostUsd / totalCostUsd;
  if (share <= HIGH_SUBAGENT_COST_SHARE) return null;

  return {
    scope: "session",
    message:
      `Subagents made up ${Math.round(share * 100)}% of this session's cost across ` +
      `${session.subagentCount} calls — consider narrowing their scope or batching related ` +
      `lookups into fewer agents.`,
  };
}

function claudeMdInsight(repo: SessionRepoInsights): Insight | null {
  if (repo.hasClaudeMd !== false) return null;
  return {
    scope: "repo",
    message:
      "This project has no CLAUDE.md — adding one (stack, layout, conventions, build commands) " +
      "helps Claude skip re-discovering it every session.",
  };
}

function exploreTopicsInsight(repo: SessionRepoInsights): Insight | null {
  if (repo.exploreTopics.length === 0) return null;
  const count = repo.exploreTopics.length;
  return {
    scope: "repo",
    message:
      `This session spawned ${count} Explore subagent${count === 1 ? "" : "s"} to look things up ` +
      `in the repo (${repo.exploreTopics.join("; ")}) — documenting these in CLAUDE.md would save ` +
      `that lookup next time.`,
  };
}

/**
 * Session-level checks run immediately (everything they need is already in the /sessions list
 * payload); repo-level checks only contribute once `repo` has been fetched (see InsightsModal) —
 * pass `null` to get session-level tips alone while that fetch is in flight or unavailable.
 */
export function computeSessionInsights(session: Session, repo: SessionRepoInsights | null): Insight[] {
  const insights = [
    sizeInsight(session),
    cacheEfficiencyInsight(session),
    subagentCostInsight(session),
    ...(repo ? [claudeMdInsight(repo), exploreTopicsInsight(repo)] : []),
  ];

  return insights.filter((insight): insight is Insight => insight !== null);
}
