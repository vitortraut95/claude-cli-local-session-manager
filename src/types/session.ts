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

export type SessionRepoInsights = {
  /** Null when the session's original directory no longer exists, so this can't be checked. */
  hasClaudeMd: boolean | null;
  /** Task descriptions of Explore-type subagents spawned this session — candidate topics for
   *  CLAUDE.md, since each one is something Claude had to go search the repo for. */
  exploreTopics: string[];
};

export type Session = {
  id: string;
  title: string;
  nickname: string | null;
  project: string;
  path: string;
  /** Session's original working directory, as logged by the CLI. Null when older transcripts
   *  didn't log a `cwd` — matches the same fallback used for directoryMissing. */
  workingDirectory: string | null;
  /** Git branch checked out in workingDirectory when the CLI logged the entry. Null when older
   *  transcripts didn't log a `gitBranch`, or the session wasn't started inside a git repo. */
  gitBranch: string | null;
  /** True when workingDirectory is a linked git worktree rather than a repo's main checkout —
   *  powers the "Delete worktree" action. False (not null) when workingDirectory is missing or
   *  isn't inside a git repo at all, same as gitBranch's "no info" case collapsing to a falsy value. */
  isWorktree: boolean;
  updatedAt: string;
  prompts: string[];
  isActive: boolean;
  directoryMissing: boolean;
  /** Size of the session's own `.jsonl` file in bytes — powers the "session size" meter. */
  sizeBytes: number;
  /** Number of subagents (via the Agent tool) spawned during this session. */
  subagentCount: number;
  /** Sum of the CLI's own `turn_duration` entries — actual time spent processing, a more honest
   *  signal than `updatedAt` (the file's mtime, which only says when it was last written). */
  activeTimeMs: number;
  usage: SessionUsage;
};
