import axios from "axios";
import type {
  RootStatus,
  Session,
  SessionRepoInsights,
  SubagentDetail,
  WorktreeToRootPreview,
} from "../types/session";
import { withServerErrorMessage } from "../utils/apiClient";

const client = axios.create({
  baseURL: "/sessions",
});

export async function fetchSessions(): Promise<Session[]> {
  const { data } = await client.get<Session[]>("/");
  return data;
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

/** PR/compare URL for `branch` on GitHub or Bitbucket — see server-side getSessionPrUrl. `branch`
 *  is passed from the caller's own `session.gitBranch` rather than re-derived server-side, same
 *  convention as `deleteBranch`/`stopAndCheckoutResume` above. Throws (via withServerErrorMessage)
 *  when the session's repo isn't a recognized remote — the caller decides how to surface that
 *  (a toast, in SessionCard's case) rather than this returning a silent null. */
export async function fetchPrUrl(id: string, branch: string): Promise<string> {
  const { data } = await withServerErrorMessage(() =>
    client.get<{ url: string }>(`/${encodeURIComponent(id)}/pr-url`, { params: { branch } }),
  );
  return data.url;
}

/** Read-only snapshot for the "worktree → root" modal — branches, root's dirty files, and a plain
 *  file diff between the worktree and root. Cheap enough to call again right before the final
 *  destructive confirm, to re-check root's dirty-file list hasn't changed since the modal opened. */
export async function fetchWorktreeToRootPreview(id: string): Promise<WorktreeToRootPreview> {
  const { data } = await withServerErrorMessage(() =>
    client.get<{ preview: WorktreeToRootPreview }>(
      `/${encodeURIComponent(id)}/worktree-to-root-preview`,
    ),
  );
  return data.preview;
}

/** Lighter counterpart to `fetchWorktreeToRootPreview` — just root's branch and dirty-file list,
 *  no file diff. Backs the standalone "Reset root" quick action's confirm dialog and the wizard's
 *  own final-confirm re-check, cheap enough to call right before either one commits. */
export async function fetchRootStatus(id: string): Promise<RootStatus> {
  const { data } = await withServerErrorMessage(() =>
    client.get<{ status: RootStatus }>(`/${encodeURIComponent(id)}/worktree-to-root/root-status`),
  );
  return data.status;
}

/** Opens the repo *root* (not the worktree) in VS Code — lets the "code ." button next to the
 *  root dirty-files list actually show what's about to be discarded/overwritten. */
export async function openWorktreeRootInVSCode(id: string): Promise<void> {
  await withServerErrorMessage(() =>
    client.post(`/${encodeURIComponent(id)}/worktree-to-root/vscode-root`),
  );
}

/** Step 1 (both "worktree → root" modes, and the standalone "Reset root" quick action): discards
 *  every uncommitted change in the repo's main checkout — recoverably, via `git stash` server-side
 *  (see resetRootWorkingTree in sessionService.ts) — returning the resulting stash ref (null if
 *  root had nothing dirty) so the UI can tell the user how to get it back. */
export async function resetRootWorkingTree(id: string): Promise<{ stashRef: string | null }> {
  const { data } = await withServerErrorMessage(() =>
    client.post<{ success: true; stashRef: string | null }>(
      `/${encodeURIComponent(id)}/worktree-to-root/reset-root`,
    ),
  );
  return { stashRef: data.stashRef };
}

/** Step 2 ("copy" mode): recomputes the file diff fresh and copies/deletes root's files to match
 *  the worktree — the worktree itself is left untouched. */
export async function applyWorktreeCopyToRoot(id: string): Promise<void> {
  await withServerErrorMessage(() =>
    client.post(`/${encodeURIComponent(id)}/worktree-to-root/copy`),
  );
}

/** Opens an orphaned worktree session's repo root in VS Code — its own directory is gone, see
 *  `Session.missingWorktreeRepoRoot`. */
export async function openMissingWorktreeRootInVSCode(id: string): Promise<void> {
  await withServerErrorMessage(() =>
    client.post(`/${encodeURIComponent(id)}/missing-worktree-root/vscode`),
  );
}

/** Starts a brand-new `claude` conversation (not a resume — see server-side
 *  startFreshSessionAtMissingWorktreeRoot for why) in an orphaned worktree session's repo root,
 *  seeded with that session's own recap as the first message. */
export async function startFreshSessionAtMissingWorktreeRoot(id: string): Promise<void> {
  await withServerErrorMessage(() =>
    client.post(`/${encodeURIComponent(id)}/missing-worktree-root/resume`),
  );
}

/** Step 2 ("checkout" mode): removes the worktree (keeping its branch) and checks that branch out
 *  in root, as one operation — see server-side removeWorktreeAndCheckoutRoot for why it's not two
 *  separate calls. Returns the branch root switched from/to, since nothing else records what root
 *  used to be on. */
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
