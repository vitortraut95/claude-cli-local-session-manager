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
  usage: SessionUsage;
};
