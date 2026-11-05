import { createReadStream, type Stats } from "node:fs";
import { mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { TranscriptItem, TranscriptTurn } from "../../shared/session.js";

/**
 * Calls `onLine` with each complete line from byte `start` on, as a raw slice (decoding and
 * parsing is up to the caller, so skipped lines cost almost nothing). A last line without its
 * `\n` is still being written and is left out. `onLine` returning false stops early. Returns the
 * offset right after the last line handed over, where a later call can resume. Always closes the
 * file, also on an early stop or a throw.
 */
async function forEachLine(
  filePath: string,
  start: number,
  onLine: (line: Buffer) => boolean | void,
): Promise<number> {
  const stream = createReadStream(filePath, { start, highWaterMark: 256 * 1024 });
  /** Pieces of a line that spans chunks, joined once its `\n` arrives. */
  let pending: Buffer[] = [];
  let chunkStart = start;
  let consumed = start;
  try {
    for await (const chunk of stream as AsyncIterable<Buffer>) {
      let lineStart = 0;
      for (let nl = chunk.indexOf(10); nl !== -1; nl = chunk.indexOf(10, lineStart)) {
        const piece = chunk.subarray(lineStart, nl);
        const line = pending.length > 0 ? Buffer.concat([...pending, piece]) : piece;
        pending = [];
        consumed = chunkStart + nl + 1;
        if (onLine(line) === false) return consumed;
        lineStart = nl + 1;
      }
      if (lineStart < chunk.length) pending.push(chunk.subarray(lineStart));
      chunkStart += chunk.length;
    }
  } finally {
    stream.destroy();
  }
  return consumed;
}

function parseLine(line: Buffer): JsonlEntry | null {
  try {
    return JSON.parse(line.toString("utf8")) as JsonlEntry;
  } catch {
    return null;
  }
}

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
  customTitle?: string;
  aiTitle?: string;
  summary?: string;
  content?: string;
  isSidechain?: boolean;
  /** Text the CLI injects as a user message (e.g. a skill's body), not typed by the user. */
  isMeta?: boolean;
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

/** The text the user typed, or null for tool results, injected text and `<tag>` messages
 *  (reminders, notifications, command output). */
function humanPromptText(entry: JsonlEntry): string | null {
  if (entry.type !== "user" || entry.isSidechain || entry.isMeta) return null;
  if (entry.message?.role !== "user") return null;
  const text = extractText(entry.message.content);
  return text && !text.trimStart().startsWith("<") ? text.trim() : null;
}

/**
 * Parse cache keyed by file path: transcripts are append-only, so a parse stays valid while
 * `mtime`+`size` are unchanged, and a grown file only needs its new lines. Kept on disk
 * (`persistScanCache`) so a server restart doesn't re-read every transcript.
 */
type CacheEntry<T> = { mtimeMs: number; size: number; value: T };
type FileStat = Pick<Stats, "mtimeMs" | "size">;

function readCache<T>(
  cache: Map<string, CacheEntry<T>>,
  filePath: string,
  s: FileStat,
): T | undefined {
  const entry = cache.get(filePath);
  return entry?.mtimeMs === s.mtimeMs && entry.size === s.size ? entry.value : undefined;
}

function writeCache<T>(
  cache: Map<string, CacheEntry<T>>,
  filePath: string,
  s: FileStat,
  value: T,
): void {
  cache.set(filePath, { mtimeMs: s.mtimeMs, size: s.size, value });
  cacheDirty = true;
}

const headCache = new Map<string, CacheEntry<SessionHead>>();
const summaryCache = new Map<string, CacheEntry<SessionSummary>>();
/** One read per file at a time, for callers asking at once. */
const summaryInFlight = new Map<string, Promise<SessionSummary>>();

/** Bump when what a scan extracts changes, so an older cache on disk is dropped. */
const CACHE_FILE_VERSION = 1;
const CACHE_SAVE_INTERVAL_MS = 60_000;
let cacheDirty = false;
let cacheLoad: Promise<void> | null = null;
let cacheSaveTimer: NodeJS.Timeout | null = null;
let lastCacheSave = 0;

function getCacheFile(): string {
  const base = process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), ".cache");
  return path.join(base, "claude-session-manager", "scan-cache.json");
}

type CacheFile = {
  version: number;
  entries: Record<string, { head?: CacheEntry<SessionHead>; summary?: CacheEntry<SessionSummary> }>;
};

/** Fills the caches from disk once per process; a missing or unreadable file starts empty. */
function loadPersistedCache(): Promise<void> {
  cacheLoad ??= (async () => {
    try {
      const data = JSON.parse(await readFile(getCacheFile(), "utf8")) as CacheFile;
      if (data.version !== CACHE_FILE_VERSION) return;
      for (const [file, entry] of Object.entries(data.entries)) {
        if (entry.head) headCache.set(file, entry.head);
        if (entry.summary) summaryCache.set(file, entry.summary);
      }
    } catch {
      // No cache yet: the first scan reads everything.
    }
  })();
  return cacheLoad;
}

async function saveCache(files: string[]): Promise<void> {
  cacheDirty = false;
  lastCacheSave = Date.now();
  const entries: CacheFile["entries"] = {};
  for (const file of files) {
    const head = headCache.get(file);
    const summary = summaryCache.get(file);
    if (head ?? summary) entries[file] = { head, summary };
  }
  const target = getCacheFile();
  const temp = `${target}.${process.pid}.tmp`;
  try {
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(temp, JSON.stringify({ version: CACHE_FILE_VERSION, entries }));
    await rename(temp, target);
  } catch {
    // Best-effort: the next restart just scans more.
  }
}

/**
 * After a full listing: drops cache entries of transcripts that are gone and writes the cache to
 * disk, at most once a minute.
 */
export function persistScanCache(files: string[]): void {
  const present = new Set(files);
  for (const cache of [headCache, summaryCache]) {
    for (const file of cache.keys()) {
      if (!present.has(file)) {
        cache.delete(file);
        cacheDirty = true;
      }
    }
  }
  if (!cacheDirty || cacheSaveTimer) return;
  const wait = Math.max(0, lastCacheSave + CACHE_SAVE_INTERVAL_MS - Date.now());
  cacheSaveTimer = setTimeout(() => {
    cacheSaveTimer = null;
    void saveCache(files);
  }, wait);
  cacheSaveTimer.unref();
}

/** Clears every cached parse for a session file; call once its `.jsonl` is deleted. */
export function forgetCachedSession(filePath: string): void {
  headCache.delete(filePath);
  summaryCache.delete(filePath);
  cacheDirty = true;
}

const MAX_LINES_SCANNED = 80;

/** Reads only the leading lines of a session's `.jsonl` (title metadata and the first prompt
 *  appear near the top). Cached by `mtime`+`size`. */
export async function readSessionHead(filePath: string, fileStat?: FileStat): Promise<SessionHead> {
  await loadPersistedCache();
  const s = fileStat ?? (await stat(filePath));
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

  let lineCount = 0;
  await forEachLine(filePath, 0, (line) => {
    if (line.length === 0) return;
    lineCount += 1;
    const entry = parseLine(line);
    if (!entry) return lineCount < MAX_LINES_SCANNED;

    if (!result.sessionId && entry.sessionId) result.sessionId = entry.sessionId;
    if (!result.cwd && entry.cwd) result.cwd = entry.cwd;
    if (!result.gitBranch && entry.gitBranch) result.gitBranch = entry.gitBranch;
    if (!result.aiTitle && entry.type === "ai-title" && entry.aiTitle) {
      result.aiTitle = entry.aiTitle;
    }
    if (!result.summaryTitle && entry.type === "summary" && entry.summary) {
      result.summaryTitle = entry.summary;
    }
    if (!result.firstUserText) {
      const text = humanPromptText(entry);
      // Only feeds the title; a prompt can hold a whole pasted log.
      if (text) result.firstUserText = truncatePrompt(text);
    }

    const haveEverything =
      result.sessionId &&
      result.cwd &&
      result.gitBranch &&
      (result.aiTitle ?? result.summaryTitle) &&
      result.firstUserText;
    return !haveEverything && lineCount < MAX_LINES_SCANNED;
  });

  return result;
}

/** Caps how many prompts the list keeps, so one unusually long session can't bloat it
 *  (`readSessionTranscript` has them all). */
const MAX_PROMPTS_EXTRACTED = 30;
/** Caps per-prompt length in the list payload. */
const MAX_PROMPT_PREVIEW_LENGTH = 300;

/** Truncated into a standalone string: V8's `slice`/`trim` results point into the original, so a
 *  cached preview would otherwise keep the whole prompt (e.g. a pasted log) alive. */
function truncatePrompt(text: string): string {
  const trimmed = text.trim();
  const preview =
    trimmed.length > MAX_PROMPT_PREVIEW_LENGTH
      ? `${trimmed.slice(0, MAX_PROMPT_PREVIEW_LENGTH - 1)}…`
      : trimmed;
  return Buffer.from(preview, "utf8").toString("utf8");
}

/** The CLI appends this hint to some recaps — a UI aside, not part of the actual summary. */
const RECAP_HINT_SUFFIX = / \(disable recaps in \/config\)$/;

export type SessionSummary = {
  /** Capped at MAX_PROMPTS_EXTRACTED, each truncated (the cache holds every session). */
  prompts: string[];
  /** The most recent `{"type":"system","subtype":"away_summary"}` recap the CLI logged. */
  recap: string | null;
  /** The session's latest name: set by `claude --name` and by every `/rename` (appended where it
   *  happens). */
  customTitle: string | null;
  /** The *last* `gitBranch` logged (a session can switch branches mid-way). */
  latestGitBranch: string | null;
  /** Bytes read so far: a grown transcript resumes here. */
  offset: number;
};

/**
 * Markers that let a line be skipped without decoding or parsing it. Inside a string value these
 * quotes would be escaped, so a match is a real key or value; none depends on the JSON's
 * spacing. Most lines (tool results, assistant turns) only need their `gitBranch`.
 */
const USER = Buffer.from('"user"');
/** Near the start of a tool-result line, so the (often huge) rest isn't searched. */
const TOOL_RESULT = Buffer.from('"tool_result"');
const TOOL_ERROR = Buffer.from('"is_error"');
const AWAY_SUMMARY = Buffer.from('"away_summary"');
const CUSTOM_TITLE = Buffer.from('"custom-title"');
/** Recap and name entries are short; longer lines aren't searched for them. */
const MAX_METADATA_LINE_BYTES = 64 * 1024;
const GIT_BRANCH_KEY = Buffer.from('"gitBranch"');
const QUOTE = 34;
const COLON = 58;
const isJsonSpace = (byte: number | undefined) =>
  byte === 32 || byte === 9 || byte === 10 || byte === 13;

/** Where the CLI writes the top-level metadata (`gitBranch`, `cwd`...): after the message body. */
const LINE_TAIL_BYTES = 4096;

/** The line's top-level `gitBranch`. Only the tail is searched: a tool result can be megabytes. */
function lineGitBranch(fullLine: Buffer): string | null {
  const line = fullLine.subarray(Math.max(0, fullLine.length - LINE_TAIL_BYTES));
  const key = line.lastIndexOf(GIT_BRANCH_KEY);
  if (key === -1) return null;
  let i = key + GIT_BRANCH_KEY.length;
  while (isJsonSpace(line[i])) i++;
  if (line[i++] !== COLON) return null;
  while (isJsonSpace(line[i])) i++;
  if (line[i] !== QUOTE) return null;
  const valueEnd = line.indexOf(QUOTE, i + 1);
  if (valueEnd === -1) return null;
  try {
    return (JSON.parse(line.toString("utf8", i, valueEnd + 1)) as string) || null;
  } catch {
    return null;
  }
}

/** Reads the transcript from `previous.offset` (0 = from the start) and folds the new lines into
 *  it: recap/customTitle/latestGitBranch keep the *last* match, so there's no early exit. */
async function scanSessionSummary(
  filePath: string,
  previous: SessionSummary | null,
): Promise<SessionSummary> {
  const result: SessionSummary = previous
    ? { ...previous, prompts: [...previous.prompts] }
    : { prompts: [], recap: null, customTitle: null, latestGitBranch: null, offset: 0 };

  result.offset = await forEachLine(filePath, result.offset, (line) => {
    const branch = lineGitBranch(line);
    if (branch) result.latestGitBranch = branch;

    const maybePrompt =
      result.prompts.length < MAX_PROMPTS_EXTRACTED &&
      line.includes(USER) &&
      !line.includes(TOOL_RESULT);
    const maybeMetadata =
      line.length <= MAX_METADATA_LINE_BYTES &&
      (line.includes(AWAY_SUMMARY) || line.includes(CUSTOM_TITLE));
    if (!maybePrompt && !maybeMetadata) return;
    const entry = parseLine(line);
    if (!entry) return;

    if (result.prompts.length < MAX_PROMPTS_EXTRACTED) {
      const text = humanPromptText(entry);
      if (text) result.prompts.push(truncatePrompt(text));
    }
    if (entry.type === "system" && entry.subtype === "away_summary" && entry.content) {
      result.recap = entry.content.replace(RECAP_HINT_SUFFIX, "").trim();
    }
    if (entry.type === "custom-title" && entry.customTitle) result.customTitle = entry.customTitle;
  });
  return result;
}

/** Prompts, recap, name and latest branch of a transcript. Cached; a transcript that grew is read
 *  only from where the last read stopped. */
export async function readSessionSummary(
  filePath: string,
  fileStat?: FileStat,
): Promise<SessionSummary> {
  await loadPersistedCache();
  const s = fileStat ?? (await stat(filePath));
  const cached = readCache(summaryCache, filePath, s);
  if (cached) return cached;
  const inFlight = summaryInFlight.get(filePath);
  if (inFlight) return inFlight;
  const previous = summaryCache.get(filePath);
  // Append-only: a file that shrank was replaced, so it's read again from the start.
  const resumeFrom = previous && previous.size <= s.size ? previous.value : null;
  const scan = scanSessionSummary(filePath, resumeFrom)
    .then((value) => {
      writeCache(summaryCache, filePath, s, value);
      return value;
    })
    .finally(() => summaryInFlight.delete(filePath));
  summaryInFlight.set(filePath, scan);
  return scan;
}

/** The most recent recap the CLI logged. */
export async function readSessionRecap(filePath: string): Promise<string | null> {
  return (await readSessionSummary(filePath)).recap;
}

/** Tool input fields tried in order for the one-line summary of a tool call. */
const TOOL_SUMMARY_FIELDS = [
  "file_path",
  "notebook_path",
  "command",
  "pattern",
  "url",
  "query",
  "skill",
  "description",
  "prompt",
];
const MAX_TOOL_SUMMARY_LENGTH = 300;

function toolSummary(input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const fields = input as Record<string, unknown>;
  const value = TOOL_SUMMARY_FIELDS.map((key) => fields[key]).find(
    (v): v is string => typeof v === "string" && v.trim() !== "",
  );
  if (!value) return "";
  const trimmed = value.trim();
  return trimmed.length > MAX_TOOL_SUMMARY_LENGTH
    ? `${trimmed.slice(0, MAX_TOOL_SUMMARY_LENGTH - 1)}…`
    : trimmed;
}

type ContentBlock = {
  type?: string;
  text?: string;
  name?: string;
  id?: string;
  input?: unknown;
  tool_use_id?: string;
  is_error?: boolean;
};

function contentBlocks(content: unknown): ContentBlock[] {
  return Array.isArray(content)
    ? content.filter((b): b is ContentBlock => !!b && typeof b === "object")
    : [];
}

/** Every prompt of the session with the agent's replies and tool calls after it, read on demand
 *  (one full pass, not cached: only the transcript modal asks for it). */
export async function readSessionTranscript(filePath: string): Promise<TranscriptTurn[]> {
  const turns: TranscriptTurn[] = [];
  const toolsById = new Map<string, Extract<TranscriptItem, { kind: "tool" }>>();

  await forEachLine(filePath, 0, (line) => {
    // Tool results are the bulk of a transcript; only a failed one changes what's shown.
    if (line.includes(TOOL_RESULT) && !line.includes(TOOL_ERROR)) return;
    const entry = parseLine(line);
    if (!entry || entry.isSidechain) return;

    const prompt = humanPromptText(entry);
    if (prompt) {
      turns.push({ prompt, timestamp: entry.timestamp ?? null, items: [] });
      return;
    }
    const turn = turns.at(-1);
    if (!turn) return;

    if (entry.type === "assistant") {
      for (const block of contentBlocks(entry.message?.content)) {
        if (block.type === "text" && block.text?.trim()) {
          turn.items.push({ kind: "text", text: block.text.trim() });
        } else if (block.type === "tool_use" && block.name) {
          const item = {
            kind: "tool" as const,
            name: block.name,
            summary: toolSummary(block.input),
            isError: false,
          };
          turn.items.push(item);
          if (block.id) toolsById.set(block.id, item);
        }
      }
    } else if (entry.type === "user") {
      for (const block of contentBlocks(entry.message?.content)) {
        if (block.type === "tool_result" && block.is_error && block.tool_use_id) {
          const tool = toolsById.get(block.tool_use_id);
          if (tool) tool.isError = true;
        }
      }
    }
  });

  return turns;
}
