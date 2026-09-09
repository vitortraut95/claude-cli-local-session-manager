// Exploratory/personal integration for a Jenkins multibranch pipeline. The job name matches the
// repo's own folder name 1:1 (e.g. "my-app-blog", "my-app-mainsite") one level below "job/", so
// `session.project` — already the repo folder's basename — is exactly the job name; no
// per-project config needed. Base URL is per-machine config, not shared project content — see
// .env.example.
const JENKINS_BASE_URL = import.meta.env.VITE_JENKINS_BASE_URL as string | undefined;
const ENV_BRANCH_PREFIX = "env/";

/**
 * Jenkins' multibranch job URLs encode each "/" in the branch name as "%2F" (one path segment per
 * job level), and the browser's own URL-encoding then escapes that "%" to "%25" — so a branch
 * like "env/LED-54351" ends up as ".../job/env%252FLED-54351/" in the address bar. Returns null
 * for anything that isn't an `env/`-prefixed branch, so the "Open Jenkins" button only renders
 * where this convention actually applies.
 */
export function getJenkinsBranchJobUrl(branch: string, project: string): string | null {
  if (!JENKINS_BASE_URL) return null;
  if (!branch.startsWith(ENV_BRANCH_PREFIX)) return null;
  const doubleEncodedBranch = encodeURIComponent(encodeURIComponent(branch));
  return `${JENKINS_BASE_URL}/job/${project}/job/${doubleEncodedBranch}/`;
}

const ENV_BRANCH_IN_TEXT = /env\/[\w.-]+/;

/**
 * Fallback for sessions whose `env/*` branch was created and pushed outside of any Claude Code
 * turn in that session (e.g. work done ahead on the base branch, then manually committed to an
 * `env/*` branch afterward) — `session.gitBranch` only reflects the last branch recorded in the
 * transcript, which never advances past whatever it was when the session's last message was
 * written, so it stays stuck on the original branch forever. Nicknames for exactly this case
 * already tend to contain the real `env/*` branch name (either the raw branch as the whole
 * nickname, or the "<source> -> <dest>" auto-nickname format), so scavenging one out of free-form
 * nickname text is a pragmatic way to recover the link without needing live git state.
 */
export function extractEnvBranchFromNickname(nickname: string | null): string | null {
  if (!nickname) return null;
  return ENV_BRANCH_IN_TEXT.exec(nickname)?.[0] ?? null;
}
