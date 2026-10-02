import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, unlink, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import type {
  Session,
  SessionImportCandidate,
  SessionImportPreview,
  SessionImportResult,
} from "../types/session.js";
import { forgetCachedSession, getClaudeProjectsDir } from "../utils/claudeProjects.js";
import { branchExists, runGit } from "../utils/git.js";
import { AppError } from "../utils/httpError.js";
import { getNicknames, setNickname } from "../utils/nicknames.js";
import {
  directoryExists,
  findSessionFilePath,
  getActiveResumeSessionIds,
  isSafeSessionId,
  listSessions,
  SessionNotFoundError,
} from "./sessionService.js";
import { getKnownProjectFolders } from "./taskService.js";
import { withWorkspaceRepos } from "./workspaceService.js";

/**
 * Session export/import ("share a session with another dev/machine"). A bundle is one gzipped
 * JSON file carrying the session's own `.jsonl`, everything under its `<id>/` sidecar folder
 * (`subagents/`, `tool-results/`, ...) and enough git metadata (origin URL, branch, commit, cwd
 * relative to the repo's top level) for the importing machine to find its own clone of the same
 * repo. Plain JSON inside the gzip on purpose — `zcat file | less` is enough to review what's in
 * it before sending, which matters since a transcript holds every file/command output Claude saw.
 *
 * Importing rewrites the original absolute paths (cwd, repo top level, the CLI's own per-project
 * folder under `~/.claude/projects`) to the importing machine's equivalents inside every string of
 * every line, so both the CLI (which ties a transcript to its exact `cwd`, see `findSessionCwd`)
 * and the model itself (which otherwise "remembers" file paths that don't exist locally) see local
 * paths. A session id that already exists locally (re-importing an updated export, or importing
 * back on the sender's own machine) is never resolved silently — the caller must say whether to
 * overwrite it or import a copy under a fresh id (`onConflict`), after the modal has shown both.
 */

const BUNDLE_FORMAT = "claude-session-manager/session-export";
const BUNDLE_VERSION = 1;

type BundleFile = { path: string; encoding: "utf8" | "base64"; content: string };

type SessionBundle = {
  format: typeof BUNDLE_FORMAT;
  version: number;
  exportedAt: string;
  session: {
    id: string;
    title: string;
    nickname: string | null;
    gitBranch: string | null;
    updatedAt: string;
    isWorktree: boolean;
    originalCwd: string | null;
    /** `git rev-parse --show-toplevel` of `originalCwd` at export time — the worktree's own top
     *  level for a worktree session, not the main checkout's. Null when the directory was gone
     *  or not a git repo. */
    originalRepoTop: string | null;
    /** `originalCwd` relative to `originalRepoTop` ("" for the top level itself). */
    repoRelativeCwd: string | null;
    /** The CLI's own `~/.claude/projects/<encoded-cwd>` folder the transcript lived in. */
    originalProjectDir: string;
    remoteUrl: string | null;
    commit: string | null;
  };
  transcript: string;
  sidecarFiles: BundleFile[];
};

function invalidBundleError(): AppError {
  return new AppError(
    "IMPORT_INVALID_BUNDLE",
    "This file isn't a session exported by Claude Session Manager.",
  );
}

/** Same scheme the CLI itself uses for `~/.claude/projects/<encoded-cwd>` — every
 *  non-alphanumeric character becomes "-" (verified against real transcripts' own `cwd`). */
function encodeProjectDirName(cwd: string): string {
  return cwd.replace(/[^a-zA-Z0-9]/g, "-");
}

/** `git@github.com:Owner/Repo.git`, `https://user@github.com/owner/repo` and friends all collapse
 *  to just `owner/repo` — the host is dropped on purpose, since it's often a per-machine SSH alias
 *  (`git@github-personal:owner/repo.git` via `~/.ssh/config`) that would never match another
 *  dev's plain `github.com` clone of the same repo. */
export function normalizeRemoteUrl(url: string): string {
  return url
    .trim()
    .replace(/^[a-z+]+:\/\//i, "")
    .replace(/^[^@/]+@/, "")
    .replace(/^[^/:]+(?::\d+)?[:/]/, "")
    .replace(/\.git$/, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

async function tryGit(args: string[], cwd: string): Promise<string | null> {
  try {
    const out = await runGit(args, cwd);
    return out.trim() || null;
  } catch {
    return null;
  }
}

async function readSidecarFiles(dir: string, prefix = ""): Promise<BundleFile[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const nested = await Promise.all(
    entries.map(async (entry): Promise<BundleFile[]> => {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return readSidecarFiles(full, relative);
      if (!entry.isFile()) return [];
      const buf = await readFile(full);
      const asText = buf.toString("utf8");
      // Round-trip check rather than guessing from the extension — anything that isn't valid
      // UTF-8 travels as base64 so it arrives byte-identical.
      return Buffer.from(asText, "utf8").equals(buf)
        ? [{ path: relative, encoding: "utf8", content: asText }]
        : [{ path: relative, encoding: "base64", content: buf.toString("base64") }];
    }),
  );
  return nested.flat();
}

function slugify(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .toLowerCase() || "session"
  );
}

/** Read-only snapshot — deliberately not gated on the session being inactive: exporting never
 *  touches the session's own files, it just captures whatever has been written so far. */
export async function exportSession(id: string): Promise<{ fileName: string; data: Buffer }> {
  if (!isSafeSessionId(id)) throw new SessionNotFoundError(id);
  const filePath = await findSessionFilePath(id);
  if (!filePath) throw new SessionNotFoundError(id);
  const session = (await listSessions()).find((s) => s.id === id);
  if (!session) throw new SessionNotFoundError(id);

  const cwd = session.workingDirectory;
  const cwdExists = cwd ? await directoryExists(cwd) : false;
  const repoTop = cwd && cwdExists ? await tryGit(["rev-parse", "--show-toplevel"], cwd) : null;
  const [remoteUrl, commit] =
    cwd && repoTop
      ? await Promise.all([
          tryGit(["remote", "get-url", "origin"], cwd),
          // The session's own branch tip when it still exists locally, so the importer can tell
          // whether they have the same code; HEAD otherwise.
          tryGit(
            ["rev-parse", "--verify", "--quiet", `${session.gitBranch ?? "HEAD"}^{commit}`],
            cwd,
          ).then((sha) => sha ?? tryGit(["rev-parse", "HEAD"], cwd)),
        ])
      : [null, null];

  const [transcript, sidecarFiles] = await Promise.all([
    readFile(filePath, "utf8"),
    readSidecarFiles(path.join(path.dirname(filePath), id)),
  ]);

  const bundle: SessionBundle = {
    format: BUNDLE_FORMAT,
    version: BUNDLE_VERSION,
    exportedAt: new Date().toISOString(),
    session: {
      id,
      title: session.title,
      nickname: session.nickname,
      gitBranch: session.gitBranch,
      updatedAt: session.updatedAt,
      isWorktree: session.isWorktree,
      originalCwd: cwd,
      originalRepoTop: repoTop,
      repoRelativeCwd: cwd && repoTop ? path.relative(repoTop, cwd) : null,
      originalProjectDir: path.dirname(filePath),
      remoteUrl,
      commit,
    },
    transcript,
    sidecarFiles,
  };

  return {
    fileName: `${slugify(session.title)}-${id.slice(0, 8)}.claude-session.json.gz`,
    data: gzipSync(JSON.stringify(bundle)),
  };
}

function parseBundle(raw: Buffer): SessionBundle {
  let text: string;
  try {
    // Gzip magic bytes — also accepts a hand-decompressed (plain JSON) bundle.
    text = raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
  } catch {
    throw invalidBundleError();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw invalidBundleError();
  }
  const bundle = parsed as Partial<SessionBundle> | null;
  if (
    !bundle ||
    typeof bundle !== "object" ||
    bundle.format !== BUNDLE_FORMAT ||
    typeof bundle.transcript !== "string" ||
    !Array.isArray(bundle.sidecarFiles) ||
    !bundle.session ||
    typeof bundle.session.id !== "string" ||
    !isSafeSessionId(bundle.session.id)
  ) {
    throw invalidBundleError();
  }
  if (typeof bundle.version !== "number" || bundle.version > BUNDLE_VERSION) {
    throw new AppError(
      "IMPORT_UNSUPPORTED_VERSION",
      "This session was exported by a newer version of Claude Session Manager — update the app first.",
    );
  }
  for (const file of bundle.sidecarFiles) {
    if (!isSafeRelativePath(file?.path) || typeof file.content !== "string") {
      throw invalidBundleError();
    }
  }
  return bundle as SessionBundle;
}

function isSafeRelativePath(value: unknown): value is string {
  if (typeof value !== "string" || !value || path.isAbsolute(value)) return false;
  return !value.split(/[\\/]/).some((segment) => segment === ".." || segment === "");
}

async function resolveCandidate(
  repoRoot: string,
  bundle: SessionBundle,
  activeDirs: Set<string>,
): Promise<SessionImportCandidate> {
  const { remoteUrl, gitBranch, commit, repoRelativeCwd } = bundle.session;
  const [localRemote, currentBranch, hasBranch, hasCommit, targetCwd] = await Promise.all([
    tryGit(["remote", "get-url", "origin"], repoRoot),
    tryGit(["branch", "--show-current"], repoRoot),
    gitBranch ? branchExists(repoRoot, gitBranch) : Promise.resolve(false),
    commit
      ? tryGit(["cat-file", "-t", commit], repoRoot).then((type) => type === "commit")
      : Promise.resolve(false),
    resolveTargetCwd(repoRoot, repoRelativeCwd),
  ]);
  return {
    repoRoot,
    targetCwd,
    remoteMatches:
      remoteUrl !== null &&
      localRemote !== null &&
      normalizeRemoteUrl(remoteUrl) === normalizeRemoteUrl(localRemote),
    currentBranch,
    branchExistsLocally: hasBranch,
    commitExistsLocally: hasCommit,
    hasActiveSession: activeDirs.has(targetCwd) || activeDirs.has(repoRoot),
  };
}

/** `repoRelativeCwd` re-applied under the importer's own clone — falls back to the clone's root
 *  when that subfolder doesn't exist there (or the bundle didn't record one). */
async function resolveTargetCwd(targetDir: string, repoRelativeCwd: string | null): Promise<string> {
  if (repoRelativeCwd && isSafeRelativePath(repoRelativeCwd)) {
    const candidate = path.join(targetDir, repoRelativeCwd);
    if (await directoryExists(candidate)) return candidate;
  }
  return targetDir;
}

function activeWorkingDirectoriesOf(sessions: Session[]): Set<string> {
  return new Set(
    sessions.filter((s) => s.isActive && s.workingDirectory).map((s) => s.workingDirectory!),
  );
}

async function getActiveWorkingDirectories(): Promise<Set<string>> {
  return activeWorkingDirectoriesOf(await listSessions());
}

export async function inspectSessionBundle(raw: Buffer): Promise<SessionImportPreview> {
  const bundle = parseBundle(raw);
  const [sessions, knownFolders] = await Promise.all([listSessions(), getKnownProjectFolders()]);
  // Workspace repos too — finds the matching clone even when it was never used with Claude here.
  const folders = await withWorkspaceRepos(knownFolders, (repoPath) => ({
    path: repoPath,
    label: path.basename(repoPath),
  }));
  const activeDirs = activeWorkingDirectoriesOf(sessions);
  const existing = sessions.find((s) => s.id === bundle.session.id) ?? null;
  const candidates = await Promise.all(
    folders.map((folder) => resolveCandidate(folder.path, bundle, activeDirs)),
  );
  // Same-remote clones first — those are the only ones that can actually hold the same code.
  candidates.sort((a, b) => Number(b.remoteMatches) - Number(a.remoteMatches));

  const { session } = bundle;
  return {
    sessionId: session.id,
    title: session.title,
    nickname: session.nickname,
    gitBranch: session.gitBranch,
    isWorktree: session.isWorktree,
    originalCwd: session.originalCwd,
    remoteUrl: session.remoteUrl,
    commit: session.commit,
    exportedAt: bundle.exportedAt,
    updatedAt: session.updatedAt,
    sizeBytes: Buffer.byteLength(bundle.transcript, "utf8"),
    subagentCount: bundle.sidecarFiles.filter(
      (f) => f.path.startsWith("subagents/") && f.path.endsWith(".jsonl"),
    ).length,
    existingSession: existing && {
      title: existing.title,
      nickname: existing.nickname,
      updatedAt: existing.updatedAt,
      sizeBytes: existing.sizeBytes,
      workingDirectory: existing.workingDirectory,
      gitBranch: existing.gitBranch,
      isActive: existing.isActive,
    },
    candidates,
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type Rewriter = (value: string) => string;

/** Builds one string → string function applying every (old prefix → new prefix) path mapping,
 *  longest first so a nested path wins over its parent, each only at a path-segment boundary
 *  (`/repo` must not also rewrite `/repo-other`). The session id itself is replaced as a plain
 *  substring — it's a UUID, and it appears both as the `sessionId` field and inside paths like
 *  `<project>/<id>/tool-results/...`. */
function buildRewriter(pathMappings: [string, string][], idMapping: [string, string] | null): Rewriter {
  const mappings = pathMappings
    .filter(([from, to]) => from && from !== to)
    .sort((a, b) => b[0].length - a[0].length);
  const pathPattern =
    mappings.length > 0
      ? new RegExp(
          `(?:${mappings.map(([from]) => escapeRegExp(from)).join("|")})(?![A-Za-z0-9._-])`,
          "g",
        )
      : null;
  const lookup = new Map(mappings);
  return (value) => {
    let result = pathPattern ? value.replace(pathPattern, (match) => lookup.get(match) ?? match) : value;
    if (idMapping) result = result.split(idMapping[0]).join(idMapping[1]);
    return result;
  };
}

function rewriteDeep(value: unknown, rewrite: Rewriter): unknown {
  if (typeof value === "string") return rewrite(value);
  if (Array.isArray(value)) return value.map((item) => rewriteDeep(item, rewrite));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, rewriteDeep(item, rewrite)]),
    );
  }
  return value;
}

/** Rewrites every string inside every JSON line; a line that doesn't parse (shouldn't happen in
 *  a CLI-written transcript) gets the same rewrite applied to its raw text instead of being
 *  dropped. */
function rewriteJsonl(text: string, rewrite: Rewriter): string {
  return text
    .split("\n")
    .map((line) => {
      if (!line.trim()) return line;
      try {
        return JSON.stringify(rewriteDeep(JSON.parse(line), rewrite));
      } catch {
        return rewrite(line);
      }
    })
    .join("\n");
}

export type ImportConflictResolution = "overwrite" | "copy";

export type ImportSessionOptions = {
  targetDir: string;
  checkoutBranch: boolean;
  /** Required only when the bundle's session id already exists locally. */
  onConflict: ImportConflictResolution | null;
};

async function checkoutImportedBranch(cwd: string, branch: string): Promise<void> {
  const active = await getActiveWorkingDirectories();
  const repoTop = (await tryGit(["rev-parse", "--show-toplevel"], cwd)) ?? cwd;
  if (active.has(cwd) || active.has(repoTop)) {
    throw new AppError(
      "IMPORT_CHECKOUT_BLOCKED_ACTIVE",
      "Another Claude session is active in that folder — close it before switching branches.",
    );
  }
  if ((await tryGit(["branch", "--show-current"], cwd)) === branch) return;
  if (!(await branchExists(cwd, branch))) {
    // Best-effort: lets the plain `git checkout <branch>` below DWIM-create a tracking branch from
    // `origin/<branch>` for a branch the importer never had locally.
    await tryGit(["fetch", "origin", `refs/heads/${branch}:refs/remotes/origin/${branch}`], cwd);
  }
  try {
    // No --force — uncommitted changes that would be overwritten block it, same as everywhere else.
    await runGit(["checkout", branch], cwd);
  } catch (err) {
    // Uncoded-message fallback isn't wanted here: git's own reason ("your local changes would be
    // overwritten...") is the useful part, so it's folded into the message, which the frontend
    // shows as-is (this code isn't in SERVER_ERROR_CODE_KEYS on purpose).
    throw new AppError(
      "IMPORT_CHECKOUT_FAILED",
      `Couldn't check out "${branch}": ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }
}

export async function importSessionBundle(
  raw: Buffer,
  { targetDir, checkoutBranch, onConflict }: ImportSessionOptions,
): Promise<SessionImportResult> {
  const bundle = parseBundle(raw);
  const trimmedTarget = targetDir.trim();
  if (!trimmedTarget) {
    throw new AppError("IMPORT_TARGET_REQUIRED", "Choose the folder to import the session into.");
  }
  const resolvedTarget = path.resolve(trimmedTarget.replace(/^~(?=$|\/)/, os.homedir()));
  if (!(await directoryExists(resolvedTarget))) {
    throw new AppError(
      "IMPORT_TARGET_MISSING",
      `The folder "${resolvedTarget}" doesn't exist on this machine.`,
    );
  }

  const { session } = bundle;
  const cwd = await resolveTargetCwd(resolvedTarget, session.repoRelativeCwd);

  // Resolved (and validated) before the checkout below, so a missing/invalid choice never leaves
  // the target folder switched to another branch with nothing imported.
  const existingPath = await findSessionFilePath(session.id);
  if (existingPath && onConflict === null) {
    throw new AppError(
      "IMPORT_SESSION_EXISTS",
      "A session with this id already exists here — choose whether to overwrite it or import a copy.",
    );
  }
  const overwrite = existingPath !== null && onConflict === "overwrite";
  if (overwrite && (await getActiveResumeSessionIds()).has(session.id)) {
    throw new AppError(
      "IMPORT_OVERWRITE_ACTIVE",
      "The existing session is active in a terminal — close it before overwriting, or import a copy.",
    );
  }

  // Before writing anything, so a failed checkout leaves nothing half-imported behind.
  let checkedOutBranch: string | null = null;
  if (checkoutBranch && session.gitBranch) {
    await checkoutImportedBranch(cwd, session.gitBranch);
    checkedOutBranch = session.gitBranch;
  }

  const importedAsCopy = existingPath !== null && !overwrite;
  const newId = importedAsCopy ? randomUUID() : session.id;
  const projectDir = path.join(getClaudeProjectsDir(), encodeProjectDirName(cwd));
  const localRepoTop = (await tryGit(["rev-parse", "--show-toplevel"], cwd)) ?? resolvedTarget;

  const rewrite = buildRewriter(
    [
      ...(session.originalCwd ? [[session.originalCwd, cwd] as [string, string]] : []),
      ...(session.originalRepoTop ? [[session.originalRepoTop, localRepoTop] as [string, string]] : []),
      [session.originalProjectDir, projectDir],
    ],
    importedAsCopy ? [session.id, newId] : null,
  );

  await mkdir(projectDir, { recursive: true });
  const transcriptPath = path.join(projectDir, `${newId}.jsonl`);
  const sidecarRoot = path.join(projectDir, newId);
  // Everything is first written under staging names the session list never picks up (only
  // `*.jsonl` directly inside a project folder counts, see `findJsonlFiles`), then moved into
  // place — so an overwrite that fails halfway through still leaves the old session intact.
  const stagingTranscript = `${transcriptPath}.importing`;
  const stagingSidecar = `${sidecarRoot}.importing`;
  const discardStaging = async () => {
    await rm(stagingTranscript, { force: true });
    await rm(stagingSidecar, { recursive: true, force: true });
  };
  await discardStaging();
  try {
    await writeFile(stagingTranscript, rewriteJsonl(bundle.transcript, rewrite), "utf8");
    for (const file of bundle.sidecarFiles) {
      const target = path.join(stagingSidecar, file.path);
      await mkdir(path.dirname(target), { recursive: true });
      if (file.encoding === "base64") {
        await writeFile(target, Buffer.from(file.content, "base64"));
      } else {
        const content = file.path.endsWith(".jsonl")
          ? rewriteJsonl(file.content, rewrite)
          : rewrite(file.content);
        await writeFile(target, content, "utf8");
      }
    }
  } catch (err) {
    await discardStaging();
    throw err;
  }

  if (overwrite && existingPath) {
    // The existing copy may live under a different project folder (it ran from another cwd) —
    // remove it wherever it is, sidecar folder included, so exactly one copy of this id remains.
    await rm(path.join(path.dirname(existingPath), session.id), { recursive: true, force: true });
    if (existingPath !== transcriptPath) await unlink(existingPath).catch(() => undefined);
    forgetCachedSession(existingPath);
  } else if ((await directoryExists(sidecarRoot)) || (await findSessionFilePath(newId))) {
    // Never merge into / clobber something that appeared since the check above.
    await discardStaging();
    throw new AppError("IMPORT_SESSION_EXISTS", `Session "${newId}" already exists here.`);
  }
  await rename(stagingTranscript, transcriptPath);
  if (bundle.sidecarFiles.length > 0) await rename(stagingSidecar, sidecarRoot);
  else await rm(stagingSidecar, { recursive: true, force: true });
  forgetCachedSession(transcriptPath);

  // Keeps the imported card sorted by when the conversation actually happened, not by "now".
  const updatedAt = new Date(session.updatedAt);
  if (!Number.isNaN(updatedAt.getTime())) {
    await utimes(transcriptPath, updatedAt, updatedAt).catch(() => undefined);
  }

  // An overwrite takes the incoming nickname when it has one; otherwise the local one stays.
  if (session.nickname && (overwrite || !(await getNicknames())[newId])) {
    await setNickname(newId, session.nickname).catch(() => undefined);
  }

  return {
    sessionId: newId,
    workingDirectory: cwd,
    importedAsCopy,
    overwritten: overwrite,
    checkedOutBranch,
  };
}
