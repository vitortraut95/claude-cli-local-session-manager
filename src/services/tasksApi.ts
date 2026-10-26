import axios from "axios";
import type { WorkStatus } from "../../shared/session";
import { type ApiError, withServerErrorMessage } from "../utils/apiClient";
import type { TerminalLayout } from "./preferencesApi";
import type {
  AddRepoInput,
  AddRepoResult,
  AddRepoStep,
  HeavyRunHookStatus,
  ProjectFolderOption,
  QueueEntry,
  QueueEntryInput,
  RepoInfo,
  SchedulerStatus,
  TaskDetails,
  WorktreeSetupResult,
  UsagePauseHookStatus,
} from "../../shared/tasks";
export type {
  AddRepoInput,
  AddRepoResult,
  AddRepoStep,
  HeavyRunHookStatus,
  ProjectFolderOption,
  QueueEntry,
  QueueEntryInput,
  QueueKind,
  RepoInfo,
  SchedulerBlock,
  SchedulerStatus,
  TaskDetails,
  TaskRepo,
  WorktreeSetupResult,
  UsagePauseHookStatus,
} from "../../shared/tasks";

const client = axios.create({
  baseURL: "/tasks",
});

export async function fetchProjectFolders(): Promise<ProjectFolderOption[]> {
  const { data } = await withServerErrorMessage(() =>
    client.get<{ projects: ProjectFolderOption[] }>("/projects"),
  );
  return data.projects;
}

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
): Promise<{ worktreePath: string; setup?: WorktreeSetupResult }> {
  const { data } = await withServerErrorMessage(() =>
    client.post<{ worktreePath: string; setup?: WorktreeSetupResult }>("/worktree", {
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

/** Opens a terminal (or a grid pane, per `layout` / the preference) in `worktreePath` running
 *  `claude <prompt>`. `repoRoot` ("" if unknown) is
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
  layout?: TerminalLayout,
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
      layout,
    }),
  );
}

export async function fetchTask(taskKey: string): Promise<TaskDetails> {
  const { data } = await withServerErrorMessage(() =>
    client.get<TaskDetails>(`/by-key/${encodeURIComponent(taskKey)}`),
  );
  return data;
}

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

/** Shared by every session of the task; null clears it. */
export async function setTaskStatus(taskKey: string, status: WorkStatus | null): Promise<void> {
  await withServerErrorMessage(() =>
    client.put(`/by-key/${encodeURIComponent(taskKey)}/status`, { status }),
  );
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

export async function fetchTaskQueue(): Promise<QueueEntry[]> {
  const { data } = await withServerErrorMessage(() =>
    client.get<{ entries: QueueEntry[] }>("/queue"),
  );
  return data.entries;
}

/** Replaces the whole queue; returns it as stored (repos resolved to their roots, launched entries
 *  kept as the scheduler left them). */
export async function saveTaskQueue(entries: QueueEntryInput[]): Promise<QueueEntry[]> {
  const { data } = await withServerErrorMessage(() =>
    client.put<{ entries: QueueEntry[] }>("/queue", { entries }),
  );
  return data.entries;
}

export async function fetchSchedulerStatus(): Promise<SchedulerStatus> {
  const { data } = await withServerErrorMessage(() => client.get<SchedulerStatus>("/queue/status"));
  return data;
}

/** Runs a scheduler check right away instead of waiting for its next tick. */
export async function runSchedulerNow(): Promise<SchedulerStatus> {
  const { data } = await withServerErrorMessage(() => client.post<SchedulerStatus>("/queue/run"));
  return data;
}

/** "Start now": launches a saved entry right away, ignoring its place in line and every limit;
 *  resolves once its session started. */
export async function startQueueEntryNow(key: string): Promise<void> {
  await withServerErrorMessage(() =>
    client.post(`/queue/${encodeURIComponent(key)}/start-now`, undefined, { timeout: 0 }),
  );
}

export async function fetchUsagePauseHookStatus(): Promise<UsagePauseHookStatus> {
  const { data } = await withServerErrorMessage(() =>
    client.get<UsagePauseHookStatus>("/usage-pause/hook"),
  );
  return data;
}

export async function setUsagePauseHookInstalled(
  installed: boolean,
): Promise<UsagePauseHookStatus> {
  const { data } = await withServerErrorMessage(() =>
    client.put<UsagePauseHookStatus>("/usage-pause/hook", { installed }),
  );
  return data;
}

export async function fetchHeavyRunHookStatus(): Promise<HeavyRunHookStatus> {
  const { data } = await withServerErrorMessage(() =>
    client.get<HeavyRunHookStatus>("/heavy-run/hook"),
  );
  return data;
}

/** Edits `~/.claude/settings.json` (only this hook's entry); new sessions pick it up. */
export async function setHeavyRunHookInstalled(installed: boolean): Promise<HeavyRunHookStatus> {
  const { data } = await withServerErrorMessage(() =>
    client.put<HeavyRunHookStatus>("/heavy-run/hook", { installed }),
  );
  return data;
}
