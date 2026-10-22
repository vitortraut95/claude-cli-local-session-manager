import { runGit } from "./core.js";

/** True if `worktreePath` has any uncommitted changes (staged, unstaged, or untracked). */
export async function hasUncommittedChanges(worktreePath: string): Promise<boolean> {
  const status = await runGit(["status", "--porcelain"], worktreePath);
  return status.length > 0;
}
