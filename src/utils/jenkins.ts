// Exploratory/personal integration for HostGator's Jenkins (see CLAUDE.md's Jenkins to-do). The
// multibranch job name matches the repo's own folder name 1:1 (e.g. "hg-led-blog",
// "hg-led-mainsite") one level below "job/", so `session.project` — already the repo folder's
// basename — is exactly the job name; no per-project config needed.
const JENKINS_BASE_URL = "https://jenkins.hostgator.com.br";
const ENV_BRANCH_PREFIX = "env/";

/**
 * Jenkins' multibranch job URLs encode each "/" in the branch name as "%2F" (one path segment per
 * job level), and the browser's own URL-encoding then escapes that "%" to "%25" — so a branch
 * like "env/LED-54351" ends up as ".../job/env%252FLED-54351/" in the address bar. Returns null
 * for anything that isn't an `env/`-prefixed branch, so the "Open Jenkins" button only renders
 * where this convention actually applies.
 */
export function getJenkinsBranchJobUrl(branch: string, project: string): string | null {
  if (!branch.startsWith(ENV_BRANCH_PREFIX)) return null;
  const doubleEncodedBranch = encodeURIComponent(encodeURIComponent(branch));
  return `${JENKINS_BASE_URL}/job/${project}/job/${doubleEncodedBranch}/`;
}
