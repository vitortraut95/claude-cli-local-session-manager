import { runGit } from "./core.js";

type GitHostInfo = { host: "github" | "bitbucket"; slug: string };

/** `origin` URLs (SSH or HTTPS) on github.com/bitbucket.org; captures the `owner/repo` slug. */
const REMOTE_URL_PATTERNS: { host: GitHostInfo["host"]; pattern: RegExp }[] = [
  { host: "github", pattern: /^git@github\.com:([^/]+\/[^/]+?)(?:\.git)?$/ },
  { host: "github", pattern: /^https:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/ },
  { host: "bitbucket", pattern: /^git@bitbucket\.org:([^/]+\/[^/]+?)(?:\.git)?$/ },
  { host: "bitbucket", pattern: /^https:\/\/[^/@]+@bitbucket\.org\/([^/]+\/[^/]+?)(?:\.git)?$/ },
  { host: "bitbucket", pattern: /^https:\/\/bitbucket\.org\/([^/]+\/[^/]+?)(?:\.git)?$/ },
];

/** `cwd`'s `origin` as a host + `owner/repo` slug, for PR/compare URLs; null when there's no
 *  recognized github.com/bitbucket.org origin. */
export async function getGitHostInfo(cwd: string): Promise<GitHostInfo | null> {
  let remoteUrl: string;
  try {
    remoteUrl = await runGit(["remote", "get-url", "origin"], cwd);
  } catch {
    return null;
  }
  for (const { host, pattern } of REMOTE_URL_PATTERNS) {
    const match = pattern.exec(remoteUrl);
    if (match?.[1]) return { host, slug: match[1] };
  }
  return null;
}
