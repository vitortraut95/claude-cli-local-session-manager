import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { directoryExists, launchInTerminal, listSessions, posixShellQuote } from "./sessionService.js";
import {
  branchExists,
  checkoutNewBranch,
  createWorktreeWithBranch,
  getDefaultBaseBranch,
  getRepoRoot,
  resolveBaseBranchRef,
} from "../utils/git.js";

export type ProjectFolderOption = {
  path: string;
  label: string;
};

/**
 * Folder choices for the "new task" form's project select — derived from existing sessions' own
 * working directories (there's no independent registry of project folders, see CLAUDE.md), deduped
 * by repo root rather than raw directory so a worktree-backed session collapses onto the same
 * option as its main checkout instead of appearing as a separate entry. The label always comes
 * from the repo root's own directory name, never `session.project` — that field is just
 * `path.basename(workingDirectory)` (see `resolveProject` in sessionService.ts), so for a
 * worktree-backed session it'd be the worktree/branch name (e.g. `fix-PROJ-123`) rather than the
 * repo's name.
 */
export async function getKnownProjectFolders(): Promise<ProjectFolderOption[]> {
  const sessions = await listSessions();
  const uniqueDirs = [
    ...new Set(sessions.map((s) => s.workingDirectory).filter((d): d is string => d !== null)),
  ];

  const roots = await Promise.all(uniqueDirs.map((dir) => getRepoRoot(dir)));

  const options = new Set<string>();
  uniqueDirs.forEach((dir, i) => {
    options.add(roots[i] ?? dir);
  });

  return [...options]
    .map((folderPath) => ({ path: folderPath, label: path.basename(folderPath) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

const execFileAsync = promisify(execFile);

/** Matches an MCP server entry's name against anything Jira-flavored — configured server names
 *  vary per user/org (e.g. "claude.ai Atlassian Rovo", "jira", "atlassian-mcp"), so this can't be
 *  an exact match. */
const JIRA_MCP_NAME_PATTERN = /jira|atlassian/i;

/**
 * `claude mcp list` prints one line per configured server, formatted as
 * `<name>: <url-or-command> - <status>` (status is `✔ Connected`, `! Needs authentication`, or
 * `⏸ Pending approval`) after a "Checking MCP server health…" banner line. Splits on the *first*
 * ": " rather than a bare ":" since the URL/command half almost always contains its own colons
 * (`https://...`).
 */
function parseMcpListLine(line: string): { name: string; status: string } | null {
  const sepIndex = line.indexOf(": ");
  if (sepIndex === -1) return null;
  return { name: line.slice(0, sepIndex).trim(), status: line.slice(sepIndex + 2).trim() };
}

export type JiraMcpStatus = {
  connected: boolean;
  /** Name of the matching server found (connected or not); null when none was configured at all. */
  serverName: string | null;
};

/**
 * Shells out to `claude mcp list` (the CLI's own health-checked server list — there's no faster
 * "just tell me if Jira is connected" command) and looks for any configured server whose name
 * looks Jira/Atlassian-flavored. This is what the "new task" flow blocks on: since the whole point
 * of pasting a Jira link is for the launched `claude` session to actually be able to look the
 * ticket up, starting the task without that connected would just leave Claude unable to do the
 * first thing the prompt asks of it.
 */
export async function getJiraMcpStatus(): Promise<JiraMcpStatus> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync("claude", ["mcp", "list"], { timeout: 30_000 }));
  } catch (err) {
    if ((err as { code?: string } | null)?.code === "ENOENT") {
      throw new Error(`The "claude" command wasn't found on PATH.`, { cause: err });
    }
    throw new Error(
      `Could not check MCP servers ("claude mcp list" failed): ${
        err instanceof Error ? err.message : String(err)
      }`,
      { cause: err },
    );
  }

  const matches = stdout
    .split("\n")
    .map(parseMcpListLine)
    .filter((entry): entry is { name: string; status: string } => entry !== null)
    .filter((entry) => JIRA_MCP_NAME_PATTERN.test(entry.name));

  const [firstMatch] = matches;
  if (!firstMatch) return { connected: false, serverName: null };

  const connectedMatch = matches.find((entry) => entry.status.includes("✔"));
  return { connected: connectedMatch !== undefined, serverName: (connectedMatch ?? firstMatch).name };
}

export type RepoInfo = {
  repoRoot: string;
  defaultBaseBranch: string;
};

/** Used by the "new task" form to prefill the source-branch field once a folder is chosen/typed. */
export async function getRepoInfo(folderPath: string): Promise<RepoInfo> {
  const trimmed = folderPath.trim();
  if (!trimmed) throw new Error("A project folder is required.");
  if (!(await directoryExists(trimmed))) {
    throw new Error(`Folder "${trimmed}" does not exist.`);
  }

  const repoRoot = await getRepoRoot(trimmed);
  if (!repoRoot) throw new Error(`"${trimmed}" is not inside a git repository.`);

  const defaultBaseBranch = await getDefaultBaseBranch(repoRoot);
  return { repoRoot, defaultBaseBranch };
}

/** Only letters/digits/`-`/`_`/`.`/`/`, and must start with a letter or digit — same spirit as
 *  git's own branch-name rules, just narrower; rejects a leading `-` in particular since that could
 *  otherwise be read as a git flag once interpolated into an argv position. */
const SAFE_BRANCH_NAME = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

/**
 * The "new task" flow is split into separate steps (this, `createTaskWorktree`,
 * `launchTaskTerminal` — plus `getRepoInfo` above) rather than one function, so the client can
 * show live per-step progress and know exactly which step failed (this app used to run the whole
 * thing as one opaque call; see CLAUDE.md's Warp TOML-escaping incident for why "which step failed"
 * turned out to matter). Resolves the actual starting commit for the new branch — see
 * `resolveBaseBranchRef` for why this prefers a freshly fetched `origin/<baseBranch>`.
 */
export async function resolveBaseBranch(
  folderPath: string,
  baseBranch: string,
): Promise<{ baseBranchRef: string }> {
  const trimmedFolder = folderPath.trim();
  const trimmedBase = baseBranch.trim();
  if (!trimmedFolder) throw new Error("A project folder is required.");
  if (!trimmedBase) throw new Error("A source branch is required.");

  const repoRoot = await getRepoRoot(trimmedFolder);
  if (!repoRoot) throw new Error(`"${trimmedFolder}" is not inside a git repository.`);

  const baseBranchRef = await resolveBaseBranchRef(repoRoot, trimmedBase);
  return { baseBranchRef };
}

/**
 * Creates a new linked worktree at `<repoRoot>/.claude/worktrees/<branchName>` on a fresh branch
 * (custom name + custom base branch — unlike `createSessionWorktree`'s CLI-delegated
 * `worktree-<name>` naming). Uses a worktree (rather than checking out the branch directly in
 * `folderPath`) so starting a new task never collides with whatever session might already be
 * active in that folder. `baseBranchRef` comes from `resolveBaseBranch` above (a separate step),
 * not re-resolved here.
 *
 * `useWorktree` is the escape hatch behind the modal's "no worktree" checkbox (default off, so the
 * collision-free worktree path stays the default): when false, this instead checks out the new
 * branch directly in `folderPath` via `checkoutNewBranch`, and the returned "worktreePath" is just
 * `repoRoot` — the caller only ever uses it as "where to open the terminal", so no separate field
 * is needed for the two cases.
 */
export async function createTaskWorktree(
  folderPath: string,
  branchName: string,
  baseBranchRef: string,
  useWorktree: boolean,
): Promise<{ worktreePath: string }> {
  const trimmedFolder = folderPath.trim();
  const trimmedBranch = branchName.trim();
  const trimmedRef = baseBranchRef.trim();

  if (!trimmedFolder) throw new Error("A project folder is required.");
  if (!trimmedBranch) throw new Error("A branch name is required.");
  if (!SAFE_BRANCH_NAME.test(trimmedBranch)) {
    throw new Error(
      `"${trimmedBranch}" isn't a valid branch name (letters, numbers, "-", "_", "." and "/" ` +
        `only, must start with a letter or number).`,
    );
  }
  if (!trimmedRef) throw new Error("A resolved base branch is required.");

  if (!(await directoryExists(trimmedFolder))) {
    throw new Error(`Folder "${trimmedFolder}" does not exist.`);
  }
  const repoRoot = await getRepoRoot(trimmedFolder);
  if (!repoRoot) throw new Error(`"${trimmedFolder}" is not inside a git repository.`);

  if (await branchExists(repoRoot, trimmedBranch)) {
    throw new Error(`Branch "${trimmedBranch}" already exists.`);
  }

  if (!useWorktree) {
    await checkoutNewBranch(repoRoot, trimmedBranch, trimmedRef);
    return { worktreePath: repoRoot };
  }

  const worktreeDirName = trimmedBranch.replace(/[^A-Za-z0-9_-]/g, "-");
  const worktreePath = path.join(repoRoot, ".claude", "worktrees", worktreeDirName);

  // Guards against reusing an existing worktree's name/folder even when its branch was already
  // deleted (or never existed) — the `branchExists` check above wouldn't catch that case, and
  // `git worktree add` would otherwise fail with a much less clear "already exists" error.
  if (await directoryExists(worktreePath)) {
    throw new Error(`A worktree named "${worktreeDirName}" already exists.`);
  }

  await createWorktreeWithBranch(repoRoot, worktreePath, trimmedBranch, trimmedRef);
  return { worktreePath };
}

/**
 * Opens a terminal in `worktreePath` running `claude <prompt>` — passing the composed prompt as a
 * positional argument starts an interactive session with it already sent as the first message, so
 * no temp file or stdin piping is needed. The final step of the "new task" flow.
 */
export async function launchTaskTerminal(worktreePath: string, prompt: string): Promise<void> {
  const trimmedWorktreePath = worktreePath.trim();
  const trimmedPrompt = prompt.trim();
  if (!trimmedWorktreePath) throw new Error("A worktree path is required.");
  if (!trimmedPrompt) throw new Error("A prompt is required to start Claude.");

  await launchInTerminal(`claude ${posixShellQuote(trimmedPrompt)}`, trimmedWorktreePath);
}
