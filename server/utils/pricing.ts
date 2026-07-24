import type { RawModelUsage } from "./claudeProjects.js";

/**
 * Per-million-token USD pricing for current Claude models, from Anthropic's public API pricing
 * (captured 2026-07-24 — prices change; update this table if it drifts, and see CLAUDE.md).
 * Cache write/read aren't separately published per model — they're documented multipliers of
 * the base input rate: 1.25x for the default 5-minute TTL (what Claude Code uses), 0.1x for a
 * cache read. Sonnet 5 is at introductory pricing through 2026-08-31; reverts to $3/$15 after.
 */
const CACHE_WRITE_MULTIPLIER = 1.25;
const CACHE_READ_MULTIPLIER = 0.1;

type ModelRate = { inputPerMTok: number; outputPerMTok: number };

const MODEL_PRICING: Record<string, ModelRate> = {
  "claude-fable-5": { inputPerMTok: 10.0, outputPerMTok: 50.0 },
  "claude-mythos-5": { inputPerMTok: 10.0, outputPerMTok: 50.0 },
  "claude-opus-4-8": { inputPerMTok: 5.0, outputPerMTok: 25.0 },
  "claude-opus-4-7": { inputPerMTok: 5.0, outputPerMTok: 25.0 },
  "claude-opus-4-6": { inputPerMTok: 5.0, outputPerMTok: 25.0 },
  "claude-sonnet-5": { inputPerMTok: 2.0, outputPerMTok: 10.0 },
  "claude-sonnet-4-6": { inputPerMTok: 3.0, outputPerMTok: 15.0 },
  "claude-haiku-4-5": { inputPerMTok: 1.0, outputPerMTok: 5.0 },
};

export type ModelUsageWithCost = RawModelUsage & { costUsd: number | null };

/** Null means this model isn't in MODEL_PRICING — cost can't be estimated, not that it's free. */
function estimateModelCost(usage: RawModelUsage): number | null {
  const rate = MODEL_PRICING[usage.model];
  if (!rate) return null;

  const inputCost = (usage.inputTokens / 1_000_000) * rate.inputPerMTok;
  const outputCost = (usage.outputTokens / 1_000_000) * rate.outputPerMTok;
  const cacheWriteCost =
    (usage.cacheCreationInputTokens / 1_000_000) * rate.inputPerMTok * CACHE_WRITE_MULTIPLIER;
  const cacheReadCost =
    (usage.cacheReadInputTokens / 1_000_000) * rate.inputPerMTok * CACHE_READ_MULTIPLIER;

  return inputCost + outputCost + cacheWriteCost + cacheReadCost;
}

export type SessionUsage = {
  models: ModelUsageWithCost[];
  /** Null whenever any model's pricing is unknown — a partial total would be misleadingly low. */
  totalCostUsd: number | null;
};

function hasNonZeroUsage(usage: RawModelUsage): boolean {
  return (
    usage.inputTokens > 0 ||
    usage.outputTokens > 0 ||
    usage.cacheCreationInputTokens > 0 ||
    usage.cacheReadInputTokens > 0
  );
}

/**
 * Some transcripts log an internal `"<synthetic>"` model marker with all-zero usage (retries,
 * injected turns — not a real API call). Drop anything with zero usage before pricing: it
 * contributes nothing either way, and an unpriced zero-usage entry shouldn't null out an
 * otherwise-fully-known total.
 */
export function summarizeUsage(rawUsage: RawModelUsage[]): SessionUsage {
  const models = rawUsage
    .filter(hasNonZeroUsage)
    .map((usage) => ({ ...usage, costUsd: estimateModelCost(usage) }));
  const totalCostUsd = models.some((m) => m.costUsd === null)
    ? null
    : models.reduce((sum, m) => sum + (m.costUsd ?? 0), 0);

  return { models, totalCostUsd };
}
