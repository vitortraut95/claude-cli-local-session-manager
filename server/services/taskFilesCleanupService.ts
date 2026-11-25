import { lstat, readFile, readdir, rm, rmdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Session } from "../../shared/session.js";
import type { CleanupFinding, StaleTaskFile, TaskFileGroup } from "../../shared/cleanup.js";
import type { TaskStore } from "../utils/taskStore.js";

/** A ticket's files stay until none of them changed for this long, so a recently finished task
 *  keeps its history around. */
const STALE_TASK_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;
const TASK_KEY_PATTERN = /\b([A-Z][A-Z0-9]+-\d+)\b/;

type Candidate = StaleTaskFile & { group: TaskFileGroup };

/**
 * Leftovers the task skills write outside any repo, read from the same variables the skills use
 * (the process env, else the `env` block of `~/.claude/settings.json`, which is where Claude Code
 * hands them to the skills), else the skills' defaults:
 *
 * - `checklists` — `TASK_CHECKLIST_DIR` (`~/.cache/task-checklists`): checklist, handoff, Jira
 *   text and questions per ticket (`<KEY>.md`, `test-<KEY>.md`, `<KEY>-handoff.md`, ...).
 * - `evidence` — `QA_EVIDENCE_DIR` (`~/Documents/evidencias`, or `~/evidencias`): test prints per
 *   ticket (`<KEY>/`), already attached to the ticket when the test ends.
 * - `figma-cache` — `FIGMA_CACHE_DIR` (`~/.cache/figma-mcp`): `<fileKey>/<nodeId>/` older than
 *   `FIGMA_CACHE_TTL_HOURS` (24), which the skill fetches again instead of reading.
 *
 * A ticket's files go once none of them changed in `STALE_TASK_DAYS` and its task is marked done
 * (or the app doesn't track the ticket). Never while a session for it is active.
 */
export async function scanForTaskFileFindings(
  sessions: Session[],
  store: TaskStore,
): Promise<CleanupFinding[]> {
  const { dirs, candidates } = await findCandidates(sessions, store);
  const findings: CleanupFinding[] = [];
  for (const group of Object.keys(dirs) as TaskFileGroup[]) {
    const staleFiles = candidates
      .filter((c) => c.group === group)
      .map(({ group: _group, ...file }) => file)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (staleFiles.length === 0) continue;
    findings.push({
      id: `task-files:${group}`,
      kind: "remove-task-files",
      command: "",
      repoRoot: dirs[group],
      staleBranches: [],
      worktreePath: null,
      branch: null,
      defaultBranch: null,
      staleSessions: [],
      keepCount: 0,
      fileGroup: group,
      staleFiles,
    });
  }
  return findings;
}

/** Deletes the finding's paths that still qualify right now; anything else in the body is
 *  ignored, so a stale or tampered finding can't reach outside these folders. */
export async function executeTaskFilesFinding(
  finding: CleanupFinding,
  sessions: Session[],
  store: TaskStore,
): Promise<void> {
  const requested = new Set((finding.staleFiles ?? []).map((f) => f.path));
  const { candidates } = await findCandidates(sessions, store);
  for (const candidate of candidates) {
    if (candidate.group !== finding.fileGroup || !requested.has(candidate.path)) continue;
    await rm(candidate.path, { recursive: true, force: true });
    if (candidate.group === "figma-cache") {
      await rmdir(path.dirname(candidate.path)).catch(() => undefined); // only when empty
    }
  }
}

async function findCandidates(
  sessions: Session[],
  store: TaskStore,
): Promise<{ dirs: Record<TaskFileGroup, string>; candidates: Candidate[] }> {
  const settingsEnv = await readClaudeSettingsEnv();
  const env = (name: string) =>
    expandHome(process.env[name] ?? null) ?? expandHome(settingsEnv[name] ?? null);
  const home = os.homedir();
  const evidenceDefault = (await isDirectory(path.join(home, "Documents")))
    ? path.join(home, "Documents", "evidencias")
    : path.join(home, "evidencias");
  const dirs: Record<TaskFileGroup, string> = {
    checklists: env("TASK_CHECKLIST_DIR") ?? path.join(home, ".cache", "task-checklists"),
    evidence: env("QA_EVIDENCE_DIR") ?? evidenceDefault,
    "figma-cache": env("FIGMA_CACHE_DIR") ?? path.join(home, ".cache", "figma-mcp"),
  };

  const keyed = [
    ...(await listEntries(dirs.checklists, "checklists")),
    ...(await listEntries(dirs.evidence, "evidence")),
  ];
  const newestByKey = new Map<string, number>();
  for (const entry of keyed) {
    newestByKey.set(entry.taskKey, Math.max(newestByKey.get(entry.taskKey) ?? 0, entry.mtimeMs));
  }
  const activeKeys = activeTaskKeys(sessions);
  const staleBefore = Date.now() - STALE_TASK_DAYS * DAY_MS;

  const candidates: Candidate[] = [];
  for (const entry of keyed) {
    if (activeKeys.has(entry.taskKey)) continue;
    if ((newestByKey.get(entry.taskKey) ?? Infinity) >= staleBefore) continue;
    const task = store.tasks[entry.taskKey];
    if (task && task.status !== "done") continue;
    candidates.push(toCandidate(entry, entry.group, entry.taskKey, task ? "done" : "stale"));
  }

  const ttlHours = Number(env("FIGMA_CACHE_TTL_HOURS")) || 24;
  const expiredBefore = Date.now() - ttlHours * 60 * 60 * 1000;
  for (const fileKey of await readDirNames(dirs["figma-cache"])) {
    const fileDir = path.join(dirs["figma-cache"], fileKey);
    for (const nodeId of await readDirNames(fileDir)) {
      const stats = await measure(path.join(fileDir, nodeId));
      if (stats && stats.mtimeMs < expiredBefore) {
        candidates.push(
          toCandidate({ path: path.join(fileDir, nodeId), ...stats }, "figma-cache", null, "expired"),
        );
      }
    }
  }

  return { dirs, candidates };
}

type Entry = { path: string; sizeBytes: number; mtimeMs: number };

function toCandidate(
  entry: Entry,
  group: TaskFileGroup,
  taskKey: string | null,
  reason: StaleTaskFile["reason"],
): Candidate {
  return {
    group,
    path: entry.path,
    taskKey,
    reason,
    sizeBytes: entry.sizeBytes,
    updatedAt: new Date(entry.mtimeMs).toISOString(),
  };
}

/** Top-level entries named after a ticket key; anything else in the folder isn't ours to judge. */
async function listEntries(
  dir: string,
  group: TaskFileGroup,
): Promise<(Entry & { group: TaskFileGroup; taskKey: string })[]> {
  const result: (Entry & { group: TaskFileGroup; taskKey: string })[] = [];
  for (const name of await readDirNames(dir)) {
    const taskKey = TASK_KEY_PATTERN.exec(name)?.[1];
    if (!taskKey) continue;
    const stats = await measure(path.join(dir, name));
    if (stats) result.push({ path: path.join(dir, name), group, taskKey, ...stats });
  }
  return result;
}

/** Tickets with an active session: by its task key, or named in its title/nickname. */
function activeTaskKeys(sessions: Session[]): Set<string> {
  const keys = new Set<string>();
  for (const session of sessions) {
    if (!session.isActive) continue;
    if (session.taskKey) keys.add(session.taskKey);
    for (const text of [session.title, session.nickname ?? ""]) {
      for (const [, key] of text.matchAll(new RegExp(TASK_KEY_PATTERN, "g"))) {
        if (key) keys.add(key);
      }
    }
  }
  return keys;
}

/** Total size and newest mtime of a file or folder (symlinks not followed); null if gone. */
async function measure(target: string): Promise<{ sizeBytes: number; mtimeMs: number } | null> {
  let stats;
  try {
    stats = await lstat(target);
  } catch {
    return null;
  }
  let sizeBytes = stats.size;
  let mtimeMs = stats.mtimeMs;
  if (stats.isDirectory()) {
    for (const name of await readDirNames(target, true)) {
      const child = await measure(path.join(target, name));
      if (!child) continue;
      sizeBytes += child.sizeBytes;
      mtimeMs = Math.max(mtimeMs, child.mtimeMs);
    }
  }
  return { sizeBytes, mtimeMs };
}

async function readDirNames(dir: string, includeSymlinks = false): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((e) => includeSymlinks || e.isDirectory() || e.isFile()).map((e) => e.name);
  } catch {
    return [];
  }
}

async function isDirectory(target: string): Promise<boolean> {
  return lstat(target).then(
    (s) => s.isDirectory(),
    () => false,
  );
}

async function readClaudeSettingsEnv(): Promise<Record<string, string>> {
  try {
    const raw = await readFile(path.join(os.homedir(), ".claude", "settings.json"), "utf8");
    const env = (JSON.parse(raw) as { env?: unknown }).env;
    if (!env || typeof env !== "object") return {};
    return Object.fromEntries(
      Object.entries(env).filter((pair): pair is [string, string] => typeof pair[1] === "string"),
    );
  } catch {
    return {};
  }
}

function expandHome(value: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return path.resolve(trimmed.replace(/^~(?=$|\/)/, os.homedir()));
}
