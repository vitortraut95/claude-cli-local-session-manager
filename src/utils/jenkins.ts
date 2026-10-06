import type { EnvPreviews } from "../services/tasksApi";

// Jenkins multibranch pipeline links. The job name matches the repo's own folder name 1:1 (e.g.
// "my-repo") one level below "job/", so `session.project` — already the repo folder's basename —
// is the job name; no per-project config needed. The base URL is per-machine config
// (`jenkinsBaseUrl` in userPreferences.json, see useTeamLinks), never hardcoded — this repo is
// public.

/** Branch prefixes teams use for Jenkins-built branches — offered as variations of the session's
 *  own ticket, since the branch that actually has a pipeline isn't always the one checked out
 *  locally (e.g. work on `feature/PROJ-1` while the preview pipeline runs on `env/PROJ-1`). */
const BRANCH_PREFIXES = ["env", "feature", "feat", "fix", "hotfix", "poc"];

/** Default branches — a "ticket" variation of these makes no sense (no `env/main`). */
const DEFAULT_BRANCHES = new Set(["main", "master"]);

export type JenkinsLink =
  | { kind: "project"; url: string }
  | { kind: "branch"; branch: string; url: string; role: "current" | "origin" | "variant" }
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
 * Every Jenkins link worth offering for a session, built purely from naming conventions — none
 * are checked for existence (there's no Jenkins API call or credential here), so the modal lets
 * the user pick whichever one makes sense. `originBranch` is the branch the task was created
 * from (see `resolveSessionBranches`), e.g. an `env/*` preview branch with its own pipeline. Null
 * when no Jenkins base URL is configured.
 */
export function getJenkinsLinks(
  jenkinsBaseUrl: string | null,
  project: string,
  branch: string | null,
  originBranch: string | null = null,
): JenkinsLink[] | null {
  if (!jenkinsBaseUrl) return null;
  const projectUrl = `${jenkinsBaseUrl.replace(/\/+$/, "")}/job/${encodeURIComponent(project)}/`;
  const links: JenkinsLink[] = [{ kind: "project", url: projectUrl }];

  if (branch) {
    links.push({ kind: "branch", branch, url: branchJobUrl(projectUrl, branch), role: "current" });
    if (!DEFAULT_BRANCHES.has(branch)) {
      // "feature/PROJ-1-foo" → "PROJ-1-foo"; a branch without "/" is already the bare ticket.
      const slash = branch.indexOf("/");
      const ticket = slash === -1 ? branch : branch.slice(slash + 1);
      // Bare ticket first — the most common pipeline branch name across teams.
      const variants = [ticket, ...BRANCH_PREFIXES.map((prefix) => `${prefix}/${ticket}`)];
      for (const variant of variants) {
        // The origin branch gets its own section below — don't list it twice.
        if (variant === branch || variant === originBranch) continue;
        links.push({
          kind: "branch",
          branch: variant,
          url: branchJobUrl(projectUrl, variant),
          role: "variant",
        });
      }
    }
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

export type EnvPreview = { label: string; url: string };
export type EnvPreviewGroup = { branch: string; previews: EnvPreview[] };

/**
 * Preview URLs for each `env/*` branch among the session's current and origin branches (a
 * `feature/*` task branched off `env/vitrine` still has that env's previews worth opening), from
 * the per-machine `envPreviews` templates of the session's project: `{env}` in each template's URL
 * becomes the branch slug (`env/PROJ-123` → `env-proj-123`). Empty for projects without templates.
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
