// Exploratory/personal integration for one specific pipeline (see CLAUDE.md's Jenkins to-do) —
// hardcoded rather than a preference for now, since only one project/job is in play. Revisit if
// this ever needs to cover more than one env/*-branched repo.
const JENKINS_BASE_URL = "https://jenkins.hostgator.com.br";
const JENKINS_JOB_NAME = "hg-led-mainsite";
const ENV_BRANCH_PREFIX = "env/";

/**
 * Jenkins' multibranch job URLs encode each "/" in the branch name as "%2F" (one path segment per
 * job level), and the browser's own URL-encoding then escapes that "%" to "%25" — so a branch
 * like "env/LED-54351" ends up as ".../job/env%252FLED-54351/" in the address bar. Returns null
 * for anything that isn't an `env/`-prefixed branch, so the "Open Jenkins" button only renders
 * where this convention actually applies.
 */
export function getJenkinsBranchJobUrl(branch: string): string | null {
  if (!branch.startsWith(ENV_BRANCH_PREFIX)) return null;
  const doubleEncodedBranch = encodeURIComponent(encodeURIComponent(branch));
  return `${JENKINS_BASE_URL}/job/${JENKINS_JOB_NAME}/job/${doubleEncodedBranch}/`;
}
