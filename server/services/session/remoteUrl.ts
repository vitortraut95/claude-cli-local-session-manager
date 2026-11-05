import { readFile } from "node:fs/promises";
import { listSessions } from "./listing.js";
import { findSessionFilePath } from "./lookup.js";

/**
 * The Remote Control link of a session (`https://claude.ai/code/session_…`), which opens it right
 * in the Claude app on the phone. The CLI writes it to the session's `.jsonl` as a `bridge_status`
 * system line when Remote Control starts; the latest one wins.
 */

const BRIDGE_URL = /"subtype":"bridge_status"[^\n]*?"url":"(https:\/\/claude\.ai\/code\/[^"]+)"/g;

async function remoteUrlInFile(filePath: string): Promise<string | null> {
  const text = await readFile(filePath, "utf8").catch(() => "");
  let url: string | null = null;
  for (const match of text.matchAll(BRIDGE_URL)) url = match[1] ?? url;
  return url;
}

/** By session id, or else the most recently updated session of the task `key` that has one. */
export async function findRemoteSessionUrl(
  sessionId: string | null,
  key: string | null,
): Promise<string | null> {
  if (sessionId) {
    const filePath = await findSessionFilePath(sessionId);
    return filePath ? remoteUrlInFile(filePath) : null;
  }
  if (!key) return null;
  const sessions = (await listSessions())
    .filter((s) => s.taskKey === key || s.testKey === key)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  for (const session of sessions) {
    const url = await remoteUrlInFile(session.path);
    if (url) return url;
  }
  return null;
}
