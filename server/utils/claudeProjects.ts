import { createReadStream } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { createInterface } from "node:readline";
import os from "node:os";
import path from "node:path";

/** Root directory where the Claude CLI stores per-project session logs. */
export function getClaudeProjectsDir(): string {
  return path.join(os.homedir(), ".claude", "projects");
}

async function safeReaddir(dir: string) {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

/**
 * Collects each project's own `*.jsonl` session logs, one directory level below `rootDir`.
 * Deliberately does not recurse further: sessions that spawn subagents get a
 * `<session-id>/subagents/agent-*.jsonl` folder reusing the parent's session id, and
 * treating those as independent sessions would create duplicate/non-resumable entries.
 */
export async function findJsonlFiles(rootDir: string): Promise<string[]> {
  const projectDirs = await safeReaddir(rootDir);

  const files = await Promise.all(
    projectDirs
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const projectPath = path.join(rootDir, entry.name);
        const projectEntries = await safeReaddir(projectPath);
        return projectEntries
          .filter((file) => file.isFile() && file.name.endsWith(".jsonl"))
          .map((file) => path.join(projectPath, file.name));
      }),
  );

  return files.flat();
}

export type SessionHead = {
  sessionId: string | null;
  cwd: string | null;
  gitBranch: string | null;
  aiTitle: string | null;
  summaryTitle: string | null;
  firstUserText: string | null;
};

type JsonlEntry = {
  type?: string;
  subtype?: string;
  durationMs?: number;
  sessionId?: string;
  cwd?: string;
  gitBranch?: string;
  aiTitle?: string;
  summary?: string;
  content?: string;
  isSidechain?: boolean;
  timestamp?: string;
  message?: {
    role?: string;
    content?: unknown;
    id?: string;
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
};

/** Pulls the first plain-text block out of a message's `content`, which may be a string or an array of content blocks. */
function extractText(content: unknown): string | null {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    for (const block of content) {
      if (
        block &&
        typeof block === "object" &&
        (block as { type?: string }).type === "text" &&
        typeof (block as { text?: string }).text === "string"
      ) {
        return (block as { text: string }).text;
      }
    }
  }
  return null;
}

/**
 * `.jsonl` transcripts are append-only (the CLI only ever adds lines to its own session log), so
 * a previous parse stays valid for as long as `mtime`+`size` haven't changed — cheap to check via
 * a single `stat()` and far cheaper than re-scanning a multi-MB transcript on every `GET
 * /sessions`. Keyed by absolute file path; entries for deleted sessions are pruned explicitly via
 * `forgetCachedSession` rather than left to grow forever, since nothing here ever evicts on its
 * own otherwise.
 */
type CacheEntry<T> = { mtimeMs: number; size: number; value: T };

function readCache<T>(
  cache: Map<string, CacheEntry<T>>,
  filePath: string,
  s: { mtimeMs: number; size: number },
): T | undefined {
  const entry = cache.get(filePath);
  return entry?.mtimeMs === s.mtimeMs && entry.size === s.size ? entry.value : undefined;
}

function writeCache<T>(
  cache: Map<string, CacheEntry<T>>,
  filePath: string,
  s: { mtimeMs: number; size: number },
  value: T,
): void {
  cache.set(filePath, { mtimeMs: s.mtimeMs, size: s.size, value });
}

const headCache = new Map<string, CacheEntry<SessionHead>>();
const fullScanCache = new Map<string, CacheEntry<FullScanResult>>();

/** Clears every cached parse for a session file — call once its `.jsonl` is actually deleted, so
 *  a stale entry never lingers keyed by a path that no longer exists. */
export function forgetCachedSession(filePath: string): void {
  headCache.delete(filePath);
  fullScanCache.delete(filePath);
}

const MAX_LINES_SCANNED = 80;

/**
 * Reads only the leading lines of a session's `.jsonl` file — title metadata
 * and the first user prompt both appear near the top, so a full read is unnecessary. Cached by
 * `mtime`+`size` (see above) since even this partial read isn't free on a very active session.
 */
export async function readSessionHead(filePath: string): Promise<SessionHead> {
  const s = await stat(filePath);
  const cached = readCache(headCache, filePath, s);
  if (cached) return cached;
  const value = await scanSessionHead(filePath);
  writeCache(headCache, filePath, s, value);
  return value;
}

async function scanSessionHead(filePath: string): Promise<SessionHead> {
  const result: SessionHead = {
    sessionId: null,
    cwd: null,
    gitBranch: null,
    aiTitle: null,
    summaryTitle: null,
    firstUserText: null,
  };

  const rl = createInterface({
    input: createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  let lineCount = 0;
  try {
    for await (const line of rl) {
      if (!line.trim()) continue;
      lineCount += 1;

      let entry: JsonlEntry;
      try {
        entry = JSON.parse(line) as JsonlEntry;
      } catch {
        if (lineCount >= MAX_LINES_SCANNED) break;
        continue;
      }

      if (!result.sessionId && entry.sessionId) result.sessionId = entry.sessionId;
      if (!result.cwd && entry.cwd) result.cwd = entry.cwd;
      if (!result.gitBranch && entry.gitBranch) result.gitBranch = entry.gitBranch;
      if (!result.aiTitle && entry.type === "ai-title" && entry.aiTitle) {
        result.aiTitle = entry.aiTitle;
      }
      if (!result.summaryTitle && entry.type === "summary" && entry.summary) {
        result.summaryTitle = entry.summary;
      }
      if (
        !result.firstUserText &&
        entry.type === "user" &&
        !entry.isSidechain &&
        entry.message?.role === "user"
      ) {
        const text = extractText(entry.message.content);
        if (text && !text.trimStart().startsWith("<")) {
          result.firstUserText = text;
        }
      }

      const haveEverything =
        result.sessionId &&
        result.cwd &&
        result.gitBranch &&
        (result.aiTitle ?? result.summaryTitle) &&
        result.firstUserText;
      if (haveEverything || lineCount >= MAX_LINES_SCANNED) break;
    }
  } finally {
    rl.close();
  }

  return result;
}

/** Caps how many prompts are kept, so one unusually long session can't bloat either payload. */
const MAX_PROMPTS_EXTRACTED = 30;
/** Caps per-prompt length only in the *list* payload (see readSessionPrompts) — the full-text
 *  preview modal fetches the untruncated version separately via readFullSessionPrompts. */
const MAX_PROMPT_PREVIEW_LENGTH = 300;

function truncatePrompt(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > MAX_PROMPT_PREVIEW_LENGTH
    ? `${trimmed.slice(0, MAX_PROMPT_PREVIEW_LENGTH - 1)}…`
    : trimmed;
}

/** The CLI appends this hint to some recaps — a UI aside, not part of the actual summary. */
const RECAP_HINT_SUFFIX = / \(disable recaps in \/config\)$/;

type FullScanResult = {
  /** Untruncated, capped at MAX_PROMPTS_EXTRACTED — callers below truncate per-prompt as needed. */
  prompts: string[];
  activeTimeMs: number;
  recap: string | null;
  latestGitBranch: string | null;
};

/**
 * Every field here needs a full pass over the transcript with no early exit (prompts stop once
 * `MAX_PROMPTS_EXTRACTED` is hit, but activeTimeMs/recap/latestGitBranch all need the *last*
 * matching entry, which can appear anywhere). Previously each lived in its own function and did
 * its own independent full-file read; folded into one pass since they're always needed together
 * (see `getFullScan`'s callers) and a `.jsonl` transcript is only worth reading through once.
 */
async function scanFullTranscript(filePath: string): Promise<FullScanResult> {
  const prompts: string[] = [];
  let activeTimeMs = 0;
  let recap: string | null = null;
  let latestGitBranch: string | null = null;

  const rl = createInterface({
    input: createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  try {
    for await (const line of rl) {
      if (!line.trim()) continue;

      let entry: JsonlEntry;
      try {
        entry = JSON.parse(line) as JsonlEntry;
      } catch {
        continue;
      }

      if (
        prompts.length < MAX_PROMPTS_EXTRACTED &&
        entry.type === "user" &&
        !entry.isSidechain &&
        entry.message?.role === "user"
      ) {
        const text = extractText(entry.message.content);
        if (text && !text.trimStart().startsWith("<")) {
          prompts.push(text.trim());
        }
      }

      if (entry.type === "system" && entry.subtype === "turn_duration" && entry.durationMs) {
        activeTimeMs += entry.durationMs;
      }

      if (entry.type === "system" && entry.subtype === "away_summary" && entry.content) {
        recap = entry.content.replace(RECAP_HINT_SUFFIX, "").trim();
      }

      if (entry.gitBranch) latestGitBranch = entry.gitBranch;
    }
  } finally {
    rl.close();
  }

  return { prompts, activeTimeMs, recap, latestGitBranch };
}

async function getFullScan(filePath: string): Promise<FullScanResult> {
  const s = await stat(filePath);
  const cached = readCache(fullScanCache, filePath, s);
  if (cached) return cached;
  const value = await scanFullTranscript(filePath);
  writeCache(fullScanCache, filePath, s, value);
  return value;
}

/**
 * Powers full-text search and the (truncated) list payload — every prompt is capped at
 * MAX_PROMPT_PREVIEW_LENGTH so one unusually long prompt can't bloat the `/sessions` response,
 * which embeds this for every session up front.
 */
export async function readSessionPrompts(filePath: string): Promise<string[]> {
  const { prompts } = await getFullScan(filePath);
  return prompts.map(truncatePrompt);
}

/**
 * Powers the prompt-preview modal only — fetched on demand for a single session (see
 * `GET /sessions/:id/prompts`), so returning full, untruncated text here doesn't affect the
 * `/sessions` list payload's size the way including it in `readSessionPrompts` would.
 */
export async function readFullSessionPrompts(filePath: string): Promise<string[]> {
  return (await getFullScan(filePath)).prompts;
}

/**
 * Sums `{"type":"system","subtype":"turn_duration","durationMs":...}` entries — the CLI's own
 * measurement of how long it actually spent processing each turn. A more honest signal of active
 * work than the file's mtime, which only says when the transcript was last written to.
 */
export async function readSessionActiveTimeMs(filePath: string): Promise<number> {
  return (await getFullScan(filePath)).activeTimeMs;
}

/**
 * Scans the entire transcript for the *last* recorded `gitBranch`, not the first (unlike
 * `readSessionHead`, which stops at the first non-null value within its leading-lines window).
 * The CLI logs the current branch on every entry, and a session that switches branches mid-way
 * (e.g. a manual `git checkout` run outside the "New task" modal's worktree/branch-per-task flow)
 * will have that switch land well past `readSessionHead`'s `MAX_LINES_SCANNED` cutoff — using the
 * first-seen value would then pin the session to a branch it left behind hundreds of lines ago.
 * The last-seen value is what the session's working directory is actually left on.
 */
export async function readSessionLatestGitBranch(filePath: string): Promise<string | null> {
  return (await getFullScan(filePath)).latestGitBranch;
}

/**
 * Scans for `{"type":"system","subtype":"away_summary","content":...}` entries — the CLI's own
 * natural-language "what we did / what's next" recap, written each time the user steps away. A
 * session can log several over its lifetime (one per away period); later entries overwrite
 * earlier ones here so the *most recent* recap wins, since it best reflects where the session
 * currently stands.
 */
export async function readSessionRecap(filePath: string): Promise<string | null> {
  return (await getFullScan(filePath)).recap;
}

/**
 * Subagents spawned mid-session (via the `Agent` tool) log to their own sibling
 * `<sessionId>/subagents/agent-*.jsonl` files rather than the parent's own `.jsonl` — real token
 * spend that otherwise never gets counted anywhere (see `findJsonlFiles`'s doc comment for why
 * those files aren't treated as independent sessions in the first place).
 */
export async function findSubagentFiles(sessionFilePath: string): Promise<string[]> {
  const sessionId = path.basename(sessionFilePath, ".jsonl");
  const subagentsDir = path.join(path.dirname(sessionFilePath), sessionId, "subagents");
  const entries = await safeReaddir(subagentsDir);
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
    .map((entry) => path.join(subagentsDir, entry.name));
}

export type SubagentMeta = {
  agentType: string | null;
  description: string | null;
};

/**
 * Each `agent-<id>.jsonl` has a sibling `agent-<id>.meta.json` (written once, at spawn time) with
 * the agent type and the short task description passed to the `Agent` tool call — the only place
 * either of those is recorded, since the subagent's own transcript starts with a placeholder user
 * message rather than the real prompt.
 */
export async function readSubagentMeta(metaFilePath: string): Promise<SubagentMeta> {
  try {
    const raw = await readFile(metaFilePath, "utf8");
    const data = JSON.parse(raw) as { agentType?: string; description?: string };
    return { agentType: data.agentType ?? null, description: data.description ?? null };
  } catch {
    return { agentType: null, description: null };
  }
}

export type SubagentTranscriptSummary = {
  startedAt: string | null;
  endedAt: string | null;
  resultText: string | null;
};

/**
 * Scans a subagent's own transcript for its start/end timestamps and its final returned text.
 * The last assistant message's text block is literally the value returned to the orchestrating
 * agent's `Agent()` call, so it doubles as a human-readable summary of what the subagent did or
 * found — reading the whole file is unavoidable since that's determined by which message ends up
 * last, not by any position known in advance.
 */
export async function readSubagentSummary(filePath: string): Promise<SubagentTranscriptSummary> {
  let startedAt: string | null = null;
  let endedAt: string | null = null;
  let resultText: string | null = null;

  const rl = createInterface({
    input: createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  try {
    for await (const line of rl) {
      if (!line.trim()) continue;

      let entry: JsonlEntry;
      try {
        entry = JSON.parse(line) as JsonlEntry;
      } catch {
        continue;
      }

      if (entry.timestamp) {
        startedAt ??= entry.timestamp;
        endedAt = entry.timestamp;
      }

      if (entry.type === "assistant" && entry.message?.role === "assistant") {
        const text = extractText(entry.message.content);
        if (text) resultText = text;
      }
    }
  } finally {
    rl.close();
  }

  return { startedAt, endedAt, resultText };
}

