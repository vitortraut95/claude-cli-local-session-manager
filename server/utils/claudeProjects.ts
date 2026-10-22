import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
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
 * Collects each project's `*.jsonl` session logs, one directory level below `rootDir`. Doesn't
 * recurse: `<session-id>/subagents/agent-*.jsonl` reuse the parent's id and aren't sessions.
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

/** The first text block of a message's `content` (a string or an array of content blocks). */
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
 * Parse cache keyed by file path: transcripts are append-only, so a parse stays valid while
 * `mtime`+`size` are unchanged. Nothing evicts on its own; deleted sessions call
 * `forgetCachedSession`.
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

/** Clears every cached parse for a session file; call once its `.jsonl` is deleted. */
export function forgetCachedSession(filePath: string): void {
  headCache.delete(filePath);
  fullScanCache.delete(filePath);
}

const MAX_LINES_SCANNED = 80;

/** Reads only the leading lines of a session's `.jsonl` (title metadata and the first prompt
 *  appear near the top). Cached by `mtime`+`size`. */
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
/** Caps per-prompt length in the list payload only (readFullSessionPrompts is untruncated). */
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
  /** Untruncated, capped at MAX_PROMPTS_EXTRACTED. */
  prompts: string[];
  recap: string | null;
  latestGitBranch: string | null;
};

/** One full pass over the transcript: recap/latestGitBranch need the *last*
 *  matching entries, so there's no early exit. */
async function scanFullTranscript(filePath: string): Promise<FullScanResult> {
  const prompts: string[] = [];
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

      if (entry.type === "system" && entry.subtype === "away_summary" && entry.content) {
        recap = entry.content.replace(RECAP_HINT_SUFFIX, "").trim();
      }

      if (entry.gitBranch) latestGitBranch = entry.gitBranch;
    }
  } finally {
    rl.close();
  }

  return { prompts, recap, latestGitBranch };
}

async function getFullScan(filePath: string): Promise<FullScanResult> {
  const s = await stat(filePath);
  const cached = readCache(fullScanCache, filePath, s);
  if (cached) return cached;
  const value = await scanFullTranscript(filePath);
  writeCache(fullScanCache, filePath, s, value);
  return value;
}

/** Prompts for search and the `/sessions` list, each truncated to MAX_PROMPT_PREVIEW_LENGTH. */
export async function readSessionPrompts(filePath: string): Promise<string[]> {
  const { prompts } = await getFullScan(filePath);
  return prompts.map(truncatePrompt);
}

/** Untruncated prompts, for `GET /sessions/:id/prompts`. */
export async function readFullSessionPrompts(filePath: string): Promise<string[]> {
  return (await getFullScan(filePath)).prompts;
}

/** The *last* `gitBranch` logged in the transcript (a session can switch branches mid-way). */
export async function readSessionLatestGitBranch(filePath: string): Promise<string | null> {
  return (await getFullScan(filePath)).latestGitBranch;
}

/** The most recent `{"type":"system","subtype":"away_summary"}` recap the CLI logged. */
export async function readSessionRecap(filePath: string): Promise<string | null> {
  return (await getFullScan(filePath)).recap;
}
