import axios from "axios";
import type {
  RootStatus,
  Session,
  SessionImportPreview,
  SessionImportResult,
  WorkStatus,
  WorktreeToRootPreview,
} from "../types/session";
import { type ApiError, withServerErrorMessage } from "../utils/apiClient";

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

export type ScanProgress = { total: number; done: number; scanning: boolean };

/** Scan progress, polled while the initial `fetchSessions()` is in flight. Best-effort: callers
 *  swallow errors. */
export async function fetchScanProgress(): Promise<ScanProgress> {
  const { data } = await client.get<ScanProgress>("/scan-progress");
  return data;
}

export async function deleteSession(id: string): Promise<void> {
  await withServerErrorMessage(() => client.delete(`/${encodeURIComponent(id)}`));
}

export async function continueSession(id: string): Promise<void> {
  await withServerErrorMessage(() => client.post(`/${encodeURIComponent(id)}/continue`));
}

/** Shows the Limux grid pane already running this session; false when the grid isn't the layout
 *  or no pane runs it. */
export async function focusSessionInGrid(id: string): Promise<boolean> {
  const { data } = await withServerErrorMessage(() =>
    client.post<{ focused: boolean }>(`/${encodeURIComponent(id)}/grid-focus`),
  );
  return data.focused;
}

export type ResumeOpenResult = {
  resumed: { id: string; taskKey: string | null }[];
  skippedForLimit: number;
  failed: { id: string; message: string }[];
};

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
export async function createWorktree(id: string, name: string): Promise<void> {
  await withServerErrorMessage(() => client.post(`/${encodeURIComponent(id)}/worktree`, { name }));
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
): Promise<void> {
  await withServerErrorMessage(() =>
    client.post(`/${encodeURIComponent(id)}/checkout-and-resume`, { siblingSessionId, branch }),
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

/** Read-only snapshot for the "worktree → root" modal: branches, root's dirty files and a file
 *  diff between the worktree and root. */
export async function fetchWorktreeToRootPreview(id: string): Promise<WorktreeToRootPreview> {
  const { data } = await withServerErrorMessage(() =>
    client.get<{ preview: WorktreeToRootPreview }>(
      `/${encodeURIComponent(id)}/worktree-to-root-preview`,
    ),
  );
  return data.preview;
}

/** Root's branch, dirty files and app stashes — `fetchWorktreeToRootPreview` without the diff. */
export async function fetchRootStatus(id: string): Promise<RootStatus> {
  const { data } = await withServerErrorMessage(() =>
    client.get<{ status: RootStatus }>(`/${encodeURIComponent(id)}/worktree-to-root/root-status`),
  );
  return data.status;
}

/** Opens the repo *root* (not the worktree) in VS Code. */
export async function openWorktreeRootInVSCode(id: string): Promise<void> {
  await withServerErrorMessage(() =>
    client.post(`/${encodeURIComponent(id)}/worktree-to-root/vscode-root`),
  );
}

/** Stashes every uncommitted change in the repo's main checkout; returns the stash ref (null if
 *  nothing was dirty). */
/** `force` (the standalone "Reset root") also frees a root another task holds; without it the
 *  server refuses with `ROOT_IN_USE`. */
export async function resetRootWorkingTree(
  id: string,
  force = false,
): Promise<{ stashRef: string | null }> {
  const { data } = await withServerErrorMessage(() =>
    client.post<{ success: true; stashRef: string | null }>(
      `/${encodeURIComponent(id)}/worktree-to-root/reset-root`,
      { force },
    ),
  );
  return { stashRef: data.stashRef };
}

/** "Copy" mode: copies/deletes root's files to match the worktree (worktree left untouched). */
export async function applyWorktreeCopyToRoot(id: string): Promise<void> {
  await withServerErrorMessage(() =>
    client.post(`/${encodeURIComponent(id)}/worktree-to-root/copy`),
  );
}

/** Opens an orphaned worktree session's repo root (`missingWorktreeRepoRoot`) in VS Code. */
export async function openMissingWorktreeRootInVSCode(id: string): Promise<void> {
  await withServerErrorMessage(() =>
    client.post(`/${encodeURIComponent(id)}/missing-worktree-root/vscode`),
  );
}

/** Starts a new `claude` conversation in an orphaned worktree session's repo root, seeded with
 *  that session's recap. */
export async function startFreshSessionAtMissingWorktreeRoot(id: string): Promise<void> {
  await withServerErrorMessage(() =>
    client.post(`/${encodeURIComponent(id)}/missing-worktree-root/resume`),
  );
}

/** "Checkout" mode: removes the worktree (keeping its branch) and checks that branch out in root.
 *  Returns the branches root switched from/to. */
export async function removeWorktreeAndCheckoutRoot(
  id: string,
): Promise<{ previousRootBranch: string | null; newBranch: string }> {
  const { data } = await withServerErrorMessage(() =>
    client.post<{ success: true; previousRootBranch: string | null; newBranch: string }>(
      `/${encodeURIComponent(id)}/worktree-to-root/remove-and-checkout`,
    ),
  );
  return { previousRootBranch: data.previousRootBranch, newBranch: data.newBranch };
}

/** `withServerErrorMessage` for a `responseType: "blob"` request, whose JSON error body also
 *  arrives as a Blob. */
async function withBlobServerErrorMessage<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.data instanceof Blob) {
      const body = await err.response.data
        .text()
        .then((text) => JSON.parse(text) as { error?: unknown; code?: unknown })
        .catch(() => null);
      if (typeof body?.error === "string") {
        const apiError: ApiError = new Error(body.error, { cause: err });
        if (typeof body.code === "string") apiError.code = body.code;
        throw apiError;
      }
    }
    throw err;
  }
}

/** Downloads the session as a `.claude-session.json.gz` file. Fetched via axios (not
 *  `<a download>`) so a server error becomes a toast, not a downloaded error file. */
export async function exportSession(id: string): Promise<void> {
  const response = await withBlobServerErrorMessage(() =>
    client.get<Blob>(`/${encodeURIComponent(id)}/export`, { responseType: "blob" }),
  );
  const disposition = String(response.headers["content-disposition"] ?? "");
  const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `${id}.claude-session.json.gz`;
  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const RAW_BUNDLE_HEADERS = { "Content-Type": "application/octet-stream" };

/** Reports an exported session file's contents and local candidates; writes nothing. */
export async function inspectSessionImport(file: Blob): Promise<SessionImportPreview> {
  const { data } = await withServerErrorMessage(() =>
    client.post<{ preview: SessionImportPreview }>("/import/inspect", file, {
      headers: RAW_BUNDLE_HEADERS,
    }),
  );
  return data.preview;
}

export type ImportConflictResolution = "overwrite" | "copy";

/** `onConflict` is required by the server only when the session id already exists locally
 *  (`SessionImportPreview.existingSession`); null otherwise. */
export async function importSession(
  file: Blob,
  targetDir: string,
  checkoutBranch: boolean,
  onConflict: ImportConflictResolution | null,
): Promise<SessionImportResult> {
  const { data } = await withServerErrorMessage(() =>
    client.post<SessionImportResult & { success: true }>("/import", file, {
      headers: RAW_BUNDLE_HEADERS,
      params: { targetDir, checkoutBranch, ...(onConflict ? { onConflict } : {}) },
    }),
  );
  return data;
}

/** One `history.jsonl` line: `{ ts, type, ...data }` (see server/utils/history.ts). */
export type HistoryEvent = { ts: string; type: string } & Record<string, unknown>;

export type HistorySummary = {
  queuedMs: number | null;
  queueBlocks: { reason: string; durationMs: number }[];
  statusMs: Record<string, number>;
  currentStatus: string | null;
  totalMs: number | null;
  heavyRuns: number;
  heavyFailed: number;
  heavyOverCap: number;
  heavySlotWaitS: number;
  heavyMemoryWaitS: number;
  heavyDurationS: number;
  heavyBlocked: number;
  rootHeldMs: number;
  rootRefused: number;
  errors: { ts: string; type: string; message: string }[];
};

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
