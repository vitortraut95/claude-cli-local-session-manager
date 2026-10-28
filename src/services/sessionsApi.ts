import axios from "axios";
import type { Session, WorkStatus } from "../../shared/session";
import { withServerErrorMessage } from "../utils/apiClient";
import type { TerminalLayout } from "./preferencesApi";
import type {
  HistoryEvent,
  HistorySummary,
  ResumeOpenResult,
  ScanProgress,
} from "../../shared/session";
export type {
  HistoryEvent,
  HistorySummary,
  ResumeOpenResult,
  ScanProgress,
} from "../../shared/session";

const client = axios.create({
  baseURL: "/sessions",
});

/** `taskKey`: a key or ticket URL saves it on the session; "" = back to inferring it from the
 *  branch. `link` (optional) is stored on the task. */
export async function setSessionTask(id: string, taskKey: string, link = ""): Promise<void> {
  await withServerErrorMessage(() =>
    client.put(`/${encodeURIComponent(id)}/task`, { taskKey, link }),
  );
}

export async function fetchSessions(): Promise<Session[]> {
  const { data } = await client.get<Session[]>("/");
  return data;
}

/** Scan progress, polled while the initial `fetchSessions()` is in flight. Best-effort: callers
 *  swallow errors. */
export async function fetchScanProgress(): Promise<ScanProgress> {
  const { data } = await client.get<ScanProgress>("/scan-progress");
  return data;
}

export async function deleteSession(id: string): Promise<void> {
  await withServerErrorMessage(() => client.delete(`/${encodeURIComponent(id)}`));
}

// `layout` (actions that open a Claude session) overrides the `terminalLayout` preference.

export async function continueSession(id: string, layout?: TerminalLayout): Promise<void> {
  await withServerErrorMessage(() =>
    client.post(`/${encodeURIComponent(id)}/continue`, layout ? { layout } : undefined),
  );
}

/** Shows the Limux grid pane already running this session; false when the grid isn't the layout
 *  or no pane runs it. */
export async function focusSessionInGrid(id: string): Promise<boolean> {
  const { data } = await withServerErrorMessage(() =>
    client.post<{ focused: boolean }>(`/${encodeURIComponent(id)}/grid-focus`),
  );
  return data.focused;
}

/** Resumes the latest session of every in-progress / waiting task with nothing running, up to
 *  the session limit (in the grid when that's the terminal layout). */
export async function resumeOpenTasks(): Promise<ResumeOpenResult> {
  const { data } = await withServerErrorMessage(() =>
    client.post<ResumeOpenResult>("/resume-open"),
  );
  return data;
}

export async function openInVSCode(id: string): Promise<void> {
  await withServerErrorMessage(() => client.post(`/${encodeURIComponent(id)}/vscode`));
}

export async function openInCursor(id: string): Promise<void> {
  await withServerErrorMessage(() => client.post(`/${encodeURIComponent(id)}/cursor`));
}

/** Starts a new `claude --worktree <name>` conversation in this session's project. */
export async function createWorktree(
  id: string,
  name: string,
  layout?: TerminalLayout,
): Promise<void> {
  await withServerErrorMessage(() =>
    client.post(`/${encodeURIComponent(id)}/worktree`, { name, layout }),
  );
}

export async function deleteWorktree(id: string): Promise<void> {
  await withServerErrorMessage(() => client.delete(`/${encodeURIComponent(id)}/worktree`));
}

/** Deletes `branch` (git branch -D) in the session's working directory. */
export async function deleteBranch(id: string, branch: string): Promise<void> {
  await withServerErrorMessage(() =>
    client.delete(`/${encodeURIComponent(id)}/branch`, { params: { branch } }),
  );
}

/** Ends `siblingSessionId`'s process, checks out `branch` in the shared directory, and resumes
 *  `id` there. */
export async function stopAndCheckoutResume(
  id: string,
  siblingSessionId: string,
  branch: string,
  layout?: TerminalLayout,
): Promise<void> {
  await withServerErrorMessage(() =>
    client.post(`/${encodeURIComponent(id)}/checkout-and-resume`, {
      siblingSessionId,
      branch,
      layout,
    }),
  );
}

export async function setNickname(id: string, nickname: string): Promise<void> {
  await withServerErrorMessage(() =>
    client.patch(`/${encodeURIComponent(id)}/nickname`, { nickname }),
  );
}

/** For a session with no task (a task's status goes through `tasksApi.setTaskStatus`); null
 *  clears it. */
export async function setStatus(id: string, status: WorkStatus | null): Promise<void> {
  await withServerErrorMessage(() => client.patch(`/${encodeURIComponent(id)}/status`, { status }));
}

/** Blank clears that side; both blank removes the saved branches. */
export async function setBranches(id: string, origin: string, destination: string): Promise<void> {
  await withServerErrorMessage(() =>
    client.patch(`/${encodeURIComponent(id)}/branches`, { origin, destination }),
  );
}

/** Full prompts for one session (`Session.prompts` is truncated). */
export async function fetchSessionPrompts(id: string): Promise<string[]> {
  const { data } = await withServerErrorMessage(() =>
    client.get<{ prompts: string[] }>(`/${encodeURIComponent(id)}/prompts`),
  );
  return data.prompts;
}

/** PR/compare URL for `branch` on GitHub or Bitbucket; throws when the remote isn't recognized.
 *  `base` makes the comparison base explicit instead of the host's default branch. */
export async function fetchPrUrl(id: string, branch: string, base?: string): Promise<string> {
  const { data } = await withServerErrorMessage(() =>
    client.get<{ url: string }>(`/${encodeURIComponent(id)}/pr-url`, { params: { branch, base } }),
  );
  return data.url;
}

/** Opens an orphaned worktree session's repo root (`missingWorktreeRepoRoot`) in VS Code. */
export async function openMissingWorktreeRootInVSCode(id: string): Promise<void> {
  await withServerErrorMessage(() =>
    client.post(`/${encodeURIComponent(id)}/missing-worktree-root/vscode`),
  );
}

/** Starts a new `claude` conversation in an orphaned worktree session's repo root, seeded with
 *  that session's recap. */
export async function startFreshSessionAtMissingWorktreeRoot(
  id: string,
  layout?: TerminalLayout,
): Promise<void> {
  await withServerErrorMessage(() =>
    client.post(`/${encodeURIComponent(id)}/missing-worktree-root/resume`, { layout }),
  );
}

/** The card's "info": this session's (and its task's) history events and their summary. */
export async function fetchSessionHistory(
  id: string,
): Promise<{ events: HistoryEvent[]; summary: HistorySummary }> {
  const { data } = await withServerErrorMessage(() =>
    client.get<{ events: HistoryEvent[]; summary: HistorySummary }>(
      `/${encodeURIComponent(id)}/history`,
    ),
  );
  return data;
}
