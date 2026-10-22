import type { EnvPreviews } from "../services/preferencesApi";
import type { Session } from "../types/session";

// Jenkins multibranch pipeline links. The job name is the repo folder name (`session.project`);
// the base URL is per-machine config (`jenkinsBaseUrl` in userPreferences.json).

export type JenkinsLink =
  | { kind: "project"; url: string }
  | { kind: "branch"; branch: string; url: string; role: "current" | "origin" }
  | { kind: "pullRequests"; url: string }
  | { kind: "tags"; url: string };

/**
 * Jenkins' multibranch job URLs encode each "/" in the branch name as "%2F" (one path segment per
 * job level), and the browser's own URL-encoding then escapes that "%" to "%25" — so a branch
 * like "feature/PROJ-123" ends up as ".../job/feature%252FPROJ-123/" in the address bar.
 */
function branchJobUrl(projectUrl: string, branch: string): string {
  return `${projectUrl}job/${encodeURIComponent(encodeURIComponent(branch))}/`;
}

/**
 * Candidate Jenkins links for a session, built from naming conventions only (none checked for
 * existence). `originBranch` is the task's base branch. Null when no base URL is configured.
 */
export function getJenkinsLinks(
  jenkinsBaseUrl: string | null,
  project: string,
  branch: string | null,
  originBranch: string | null,
): JenkinsLink[] | null {
  if (!jenkinsBaseUrl) return null;
  const projectUrl = `${jenkinsBaseUrl.replace(/\/+$/, "")}/job/${encodeURIComponent(project)}/`;
  const links: JenkinsLink[] = [{ kind: "project", url: projectUrl }];

  if (branch) {
    links.push({ kind: "branch", branch, url: branchJobUrl(projectUrl, branch), role: "current" });
  }
  if (originBranch && originBranch !== branch) {
    links.push({
      kind: "branch",
      branch: originBranch,
      url: branchJobUrl(projectUrl, originBranch),
      role: "origin",
    });
  }

  links.push({ kind: "pullRequests", url: `${projectUrl}view/change-requests/` });
  links.push({ kind: "tags", url: `${projectUrl}view/tags/` });
  return links;
}

type EnvPreview = { label: string; url: string };
export type EnvPreviewGroup = { branch: string; previews: EnvPreview[] };

/**
 * Preview URLs for each `env/*` branch among a repo's task and origin branches, from the
 * project's `envPreviews` templates: `{env}` becomes the branch slug (`env/PROJ-123` →
 * `env-proj-123`). Empty for projects without templates.
 */
export function getEnvPreviewGroups(
  envPreviews: EnvPreviews,
  project: string,
  branches: (string | null)[],
): EnvPreviewGroup[] {
  const templates = Object.hasOwn(envPreviews, project) ? envPreviews[project] : undefined;
  if (!templates || templates.length === 0) return [];
  const envBranches = [...new Set(branches)].filter(
    (b): b is string => typeof b === "string" && b.startsWith("env/"),
  );
  return envBranches.map((branch) => {
    const slug = branch.replace(/\//g, "-").toLowerCase();
    return {
      branch,
      previews: templates.map((template) => ({
        label: template.label,
        url: template.url.replaceAll("{env}", slug),
      })),
    };
  });
}

export type JenkinsRepoGroup = {
  project: string;
  links: JenkinsLink[];
  envPreviews: EnvPreviewGroup[];
};

/**
 * Jenkins links and env previews of the session's repo and, for a multi-repo task, of every other
 * repo in the task (its task branch and base), so one modal covers the whole task. Null when no
 * base URL is configured.
 */
export function getTaskJenkinsGroups(
  jenkinsBaseUrl: string | null,
  envPreviews: EnvPreviews,
  session: Session,
  branch: string | null,
  originBranch: string | null,
): JenkinsRepoGroup[] | null {
  const repos = [{ project: session.project, branch, originBranch }];
  const seen = new Set([session.repoRoot]);
  for (const repo of session.taskRepos ?? []) {
    if (seen.has(repo.repoRoot)) continue;
    seen.add(repo.repoRoot);
    repos.push({
      project: repo.project,
      branch: repo.branch,
      originBranch: repo.baseBranch ?? repo.defaultBranch ?? null,
    });
  }
  const groups: JenkinsRepoGroup[] = [];
  for (const repo of repos) {
    const links = getJenkinsLinks(jenkinsBaseUrl, repo.project, repo.branch, repo.originBranch);
    if (!links) return null;
    groups.push({
      project: repo.project,
      links,
      envPreviews: getEnvPreviewGroups(envPreviews, repo.project, [repo.branch, repo.originBranch]),
    });
  }
  return groups;
}
