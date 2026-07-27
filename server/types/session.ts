export type ModelUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  costUsd: number | null;
};

export type SessionUsage = {
  models: ModelUsage[];
  totalCostUsd: number | null;
  /** Portion of totalCostUsd attributable to subagents spawned during the session; null when
   *  subagentCount is 0 (nothing to break out) rather than when pricing is merely unknown. */
  subagentCostUsd: number | null;
};

export type SubagentUsage = {
  models: ModelUsage[];
  totalCostUsd: number | null;
};

export type SubagentDetail = {
  agentId: string;
  agentType: string | null;
  description: string | null;
  resultText: string | null;
  startedAt: string | null;
  endedAt: string | null;
  usage: SubagentUsage;
};

export type Session = {
  id: string;
  title: string;
  nickname: string | null;
  project: string;
  path: string;
  updatedAt: string;
  prompts: string[];
  isActive: boolean;
  directoryMissing: boolean;
  /** Size of the session's own `.jsonl` file in bytes — powers the "session size" meter. */
  sizeBytes: number;
  /** Number of subagents (via the Agent tool) spawned during this session. */
  subagentCount: number;
  usage: SessionUsage;
};
