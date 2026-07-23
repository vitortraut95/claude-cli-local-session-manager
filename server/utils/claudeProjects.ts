import { createReadStream } from "node:fs";
import { readdir } from "node:fs/promises";
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
  aiTitle: string | null;
  summaryTitle: string | null;
  firstUserText: string | null;
};

type JsonlEntry = {
  type?: string;
  sessionId?: string;
  cwd?: string;
  aiTitle?: string;
  summary?: string;
  isSidechain?: boolean;
  message?: {
    role?: string;
    content?: unknown;
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

const MAX_LINES_SCANNED = 80;

/**
 * Reads only the leading lines of a session's `.jsonl` file — title metadata
 * and the first user prompt both appear near the top, so a full read is unnecessary.
 */
export async function readSessionHead(filePath: string): Promise<SessionHead> {
  const result: SessionHead = {
    sessionId: null,
    cwd: null,
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
        entry = JSON.parse(line);
      } catch {
        if (lineCount >= MAX_LINES_SCANNED) break;
        continue;
      }

      if (!result.sessionId && entry.sessionId) result.sessionId = entry.sessionId;
      if (!result.cwd && entry.cwd) result.cwd = entry.cwd;
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
        (result.aiTitle || result.summaryTitle) &&
        result.firstUserText;
      if (haveEverything || lineCount >= MAX_LINES_SCANNED) break;
    }
  } finally {
    rl.close();
  }

  return result;
}
