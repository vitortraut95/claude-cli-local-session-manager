import axios from "axios";

const client = axios.create({
  baseURL: "/tasks",
});

type ErrorResponseBody = { error?: unknown };

/** Mirrors sessionsApi's withServerErrorMessage — surfaces the server's own `{ error }` message
 *  instead of axios's generic "Request failed with status code ..." */
async function withServerErrorMessage<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (err) {
    if (axios.isAxiosError<ErrorResponseBody>(err) && typeof err.response?.data?.error === "string") {
      throw new Error(err.response.data.error, { cause: err });
    }
    throw err;
  }
}

export type ProjectFolderOption = {
  path: string;
  label: string;
};

export async function fetchProjectFolders(): Promise<ProjectFolderOption[]> {
  const { data } = await withServerErrorMessage(() =>
    client.get<{ projects: ProjectFolderOption[] }>("/projects"),
  );
  return data.projects;
}

export type UserPreferences = {
  defaultPrompt: string;
  branchTypes: string[];
  useWorktreeByDefault: boolean;
};

/** Everything the "new task" modal remembers between sessions — one JSON file
 *  (`userPreferences.json`, see preferencesService.ts) instead of separate per-field files. */
export async function fetchPreferences(): Promise<UserPreferences> {
  const { data } = await withServerErrorMessage(() =>
    client.get<UserPreferences>("/preferences"),
  );
  return data;
}

/** Replaces the whole preferences file — callers must send the full object (merging in whatever
 *  fields they aren't intentionally changing), not just the one field they care about. */
export async function savePreferences(preferences: UserPreferences): Promise<void> {
  await withServerErrorMessage(() => client.put("/preferences", preferences));
}

export type JiraMcpStatus = {
  connected: boolean;
  serverName: string | null;
};

/** Checked when the "new task" modal opens (and on demand via its "Verificar novamente" button) —
 *  the launched `claude` session needs a connected Jira/Atlassian MCP server to actually look up
 *  the pasted ticket, so creation is blocked until this comes back connected. */
export async function fetchJiraMcpStatus(): Promise<JiraMcpStatus> {
  const { data } = await withServerErrorMessage(() =>
    client.get<JiraMcpStatus>("/jira-mcp-status"),
  );
  return data;
}

export type RepoInfo = {
  repoRoot: string;
  defaultBaseBranch: string;
};

export async function fetchRepoInfo(folderPath: string): Promise<RepoInfo> {
  const { data } = await withServerErrorMessage(() =>
    client.get<RepoInfo>("/repo-info", { params: { folderPath } }),
  );
  return data;
}

/**
 * The "new task" creation flow is split into separate calls (this, `createTaskWorktree`,
 * `launchTaskTerminal`) rather than one — see NewTaskModal for why: each maps to one visible step
 * in the modal's live progress checklist, so a failure shows exactly which step it happened at
 * instead of one opaque error.
 */
export async function resolveBaseBranch(
  folderPath: string,
  baseBranch: string,
): Promise<{ baseBranchRef: string }> {
  const { data } = await withServerErrorMessage(() =>
    client.post<{ baseBranchRef: string }>("/resolve-base-branch", { folderPath, baseBranch }),
  );
  return data;
}

export async function createTaskWorktree(
  folderPath: string,
  branchName: string,
  baseBranchRef: string,
  useWorktree: boolean,
): Promise<{ worktreePath: string }> {
  const { data } = await withServerErrorMessage(() =>
    client.post<{ worktreePath: string }>("/worktree", {
      folderPath,
      branchName,
      baseBranchRef,
      useWorktree,
    }),
  );
  return data;
}

/** Opens a terminal in `worktreePath` running `claude <prompt>` (see server-side
 *  launchTaskTerminal for why a positional arg, not a temp file/stdin). */
export async function launchTaskTerminal(worktreePath: string, prompt: string): Promise<void> {
  await withServerErrorMessage(() => client.post("/launch", { worktreePath, prompt }));
}
