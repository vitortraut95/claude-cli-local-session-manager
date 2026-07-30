import axios from "axios";
import type { Session, SessionRepoInsights, SubagentDetail } from "../types/session";

const client = axios.create({
  baseURL: "/sessions",
});

export async function fetchSessions(): Promise<Session[]> {
  const { data } = await client.get<Session[]>("/");
  return data;
}

type ErrorResponseBody = { error?: unknown };

/**
 * Re-throws with the server's specific error message (e.g. "session is active") instead of
 * axios's generic "Request failed with status code 409", so callers' existing
 * `err instanceof Error ? err.message : ...` catch blocks surface something actually useful.
 */
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

export async function deleteSession(id: string): Promise<void> {
  await withServerErrorMessage(() => client.delete(`/${encodeURIComponent(id)}`));
}

export async function continueSession(id: string): Promise<void> {
  await withServerErrorMessage(() => client.post(`/${encodeURIComponent(id)}/continue`));
}

export async function openInVSCode(id: string): Promise<void> {
  await withServerErrorMessage(() => client.post(`/${encodeURIComponent(id)}/vscode`));
}

/** Runs `claude --worktree <name>` for this session's project (see server-side
 *  createSessionWorktree for why it's not `--resume`d). */
export async function createWorktree(id: string, name: string): Promise<void> {
  await withServerErrorMessage(() => client.post(`/${encodeURIComponent(id)}/worktree`, { name }));
}

export async function deleteWorktree(id: string): Promise<void> {
  await withServerErrorMessage(() => client.delete(`/${encodeURIComponent(id)}/worktree`));
}

/** Deletes `branch` in the session's own working directory (git branch -D) — offered alongside
 *  session deletion for non-worktree sessions (see server-side deleteSessionBranch for why
 *  worktree-backed ones don't need this: their own worktree cleanup already deletes the branch). */
export async function deleteBranch(id: string, branch: string): Promise<void> {
  await withServerErrorMessage(() =>
    client.delete(`/${encodeURIComponent(id)}/branch`, { params: { branch } }),
  );
}

/** Ends `siblingSessionId`'s terminal process, checks out `branch` in the shared directory, and
 *  resumes `id` there (see server-side stopSiblingAndResume for why this is one call). */
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

/** Full, untruncated prompts for one session — see PromptPreviewModal for why this is fetched
 *  separately from `Session.prompts` rather than reused (that copy is capped for the list payload). */
export async function fetchSessionPrompts(id: string): Promise<string[]> {
  const { data } = await withServerErrorMessage(() =>
    client.get<{ prompts: string[] }>(`/${encodeURIComponent(id)}/prompts`),
  );
  return data.prompts;
}

/** Per-subagent detail (type, task description, result, cost) — fetched on demand, see SubagentsModal. */
export async function fetchSessionSubagents(id: string): Promise<SubagentDetail[]> {
  const { data } = await withServerErrorMessage(() =>
    client.get<{ subagents: SubagentDetail[] }>(`/${encodeURIComponent(id)}/subagents`),
  );
  return data.subagents;
}

/** Repo-side facts (CLAUDE.md presence, Explore-subagent topics) for the Insights panel — see
 *  sessionInsights.ts for how these combine with the already-loaded Session into actual tips. */
export async function fetchSessionRepoInsights(id: string): Promise<SessionRepoInsights> {
  const { data } = await withServerErrorMessage(() =>
    client.get<{ insights: SessionRepoInsights }>(`/${encodeURIComponent(id)}/insights`),
  );
  return data.insights;
}
