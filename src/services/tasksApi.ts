import axios from "axios";
import type { TaskRepoRef } from "../types/session";
import { type ApiError, withServerErrorMessage } from "../utils/apiClient";

const client = axios.create({
  baseURL: "/tasks",
});

export type ProjectFolderOption = {
  path: string;
  label: string;
  /** False for repos only found in a workspace dir. Absent (older backend) = recent. */
  recent?: boolean;
};

export async function fetchProjectFolders(): Promise<ProjectFolderOption[]> {
  const { data } = await withServerErrorMessage(() =>
    client.get<{ projects: ProjectFolderOption[] }>("/projects"),
  );
  return data.projects;
}

export type RepoInfo = {
  repoRoot: string;
  defaultBaseBranch: string;
  /** A session is active with its working directory exactly at `repoRoot` — drives the "use a
   *  worktree" default. */
  hasActiveSessionInRoot: boolean;
};

export async function fetchRepoInfo(folderPath: string): Promise<RepoInfo> {
  const { data } = await withServerErrorMessage(() =>
    client.get<RepoInfo>("/repo-info", { params: { folderPath } }),
  );
  return data;
}

/** First step of "New task" (then `createTaskWorktree`, `launchTaskTerminal`); each call is one
 *  step in the modal's progress checklist. */
export async function resolveBaseBranch(
  folderPath: string,
  baseBranch: string,
  useLocalBranch = false,
): Promise<{ baseBranchRef: string }> {
  const { data } = await withServerErrorMessage(() =>
    client.post<{ baseBranchRef: string }>("/resolve-base-branch", {
      folderPath,
      baseBranch,
      useLocalBranch,
    }),
  );
  return data;
}

export async function createTaskWorktree(
  folderPath: string,
  branchName: string,
  baseBranchRef: string,
  baseBranch: string,
  useWorktree: boolean,
  taskKey = "",
  taskLink = "",
): Promise<{ worktreePath: string }> {
  const { data } = await withServerErrorMessage(() =>
    client.post<{ worktreePath: string }>("/worktree", {
      folderPath,
      branchName,
      baseBranchRef,
      baseBranch,
      useWorktree,
      taskKey,
      taskLink,
    }),
  );
  return data;
}

/** Opens a terminal in `worktreePath` running `claude <prompt>`. `repoRoot` ("" if unknown) is
 *  remembered for the folder dropdown. A non-blank `nickname` and `originBranch`/`destinationBranch`
 *  are saved for the new session. */
export async function launchTaskTerminal(
  worktreePath: string,
  prompt: string,
  permissionModeAuto: boolean,
  repoRoot: string,
  nickname = "",
  originBranch = "",
  destinationBranch = "",
  addDirs: string[] = [],
): Promise<void> {
  await withServerErrorMessage(() =>
    client.post("/launch", {
      worktreePath,
      prompt,
      permissionModeAuto,
      repoRoot,
      nickname,
      originBranch,
      destinationBranch,
      addDirs,
    }),
  );
}

/** One repo of a task as `GET /tasks/by-key/:key` returns it. */
export type TaskRepo = TaskRepoRef & { defaultBranch: string | null };

export type TaskDetails = {
  key: string;
  link: string | null;
  repos: TaskRepo[];
  sessions: { id: string; title: string; nickname: string | null; isActive: boolean }[];
};

export async function fetchTask(taskKey: string): Promise<TaskDetails> {
  const { data } = await withServerErrorMessage(() =>
    client.get<TaskDetails>(`/by-key/${encodeURIComponent(taskKey)}`),
  );
  return data;
}

export type AddRepoStep = "repo" | "base" | "worktree";

export type AddRepoInput = {
  folderPath: string;
  branchName: string;
  baseBranch: string;
  useLocalBranch: boolean;
  /** Omitted = the server's smart default (a worktree only when the root has an active session). */
  useWorktree?: boolean;
  taskLink: string;
};

export type AddRepoResult = {
  repoRoot: string;
  branch: string;
  baseBranch: string;
  /** Where the branch is checked out — what to `/add-dir`. */
  workingDirectory: string;
  completedSteps: AddRepoStep[];
};

/** A failed add-repo also says which step failed and which had already finished (nothing is
 *  rolled back server-side). */
export type AddRepoError = ApiError & { failedStep?: AddRepoStep; completedSteps?: AddRepoStep[] };

export async function addRepoToTask(taskKey: string, input: AddRepoInput): Promise<AddRepoResult> {
  try {
    const { data } = await withServerErrorMessage(() =>
      client.post<AddRepoResult>(`/by-key/${encodeURIComponent(taskKey)}/repos`, input),
    );
    return data;
  } catch (err) {
    const cause = err instanceof Error ? err.cause : undefined;
    if (err instanceof Error && axios.isAxiosError<Partial<AddRepoError>>(cause)) {
      const body = cause.response?.data;
      Object.assign(err, {
        failedStep: body?.failedStep,
        completedSteps: body?.completedSteps ?? [],
      });
    }
    throw err;
  }
}

/** Only drops the link — the branch, worktree and sessions stay. */
export async function unlinkTaskRepo(
  taskKey: string,
  repoRoot: string,
  branch: string,
): Promise<void> {
  await withServerErrorMessage(() =>
    client.delete(`/by-key/${encodeURIComponent(taskKey)}/repos`, { data: { repoRoot, branch } }),
  );
}

/** "Open PR" for one repo/branch of a multi-repo task — works for a repo with no session of its
 *  own; the server only accepts a repo/branch that belongs to the task. */
export async function fetchTaskRepoPrUrl(
  taskKey: string,
  repoRoot: string,
  branch: string,
  base = "",
): Promise<string> {
  const { data } = await withServerErrorMessage(() =>
    client.get<{ url: string }>(`/by-key/${encodeURIComponent(taskKey)}/pr-url`, {
      params: { repoRoot, branch, base },
    }),
  );
  return data.url;
}

/** Header's "Test task": a terminal running `claude "/<taskTestSkill> <ticketLink>"` — the skill
 *  comes from the saved preference, resolved server-side. */
export async function launchTaskTest(
  ticketLink: string,
  permissionModeAuto: boolean,
  nickname: string,
): Promise<void> {
  await withServerErrorMessage(() =>
    client.post("/test-task", { ticketLink, permissionModeAuto, nickname }),
  );
}

// ---------------------------------------------------------------------------------------------
