import { buildPageUrl, jobPageUrl } from "./buildDiagnosis.js";
import { apiFetch } from "./http.js";

/**
 * Points a branch's build at homolog: a Jenkins Replay of its latest build with the Jenkinsfile
 * changed the way the team does it by hand. The `when` of the "Build and Deploy" stage goes (so
 * any branch deploys) and so do the `if`s that send `env/*` to its own stage and `v*` tags to
 * prod, which leaves `deploy_stage = 'test'`. If the Jenkinsfile doesn't look as expected the
 * change is refused rather than guessed.
 */

export class HomologPatchError extends Error {}

/** The `{ … }` block starting at `open` (an index of "{"), as [start, end) with braces balanced;
 *  strings and comments aren't special-cased, which the blocks touched here don't need. */
function blockEnd(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}") {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  throw new HomologPatchError("Unbalanced braces in the Jenkinsfile.");
}

/** Removes `[start, end)` plus the indentation before it and the line break after it. */
function cut(text: string, start: number, end: number): string {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const from = /^\s*$/.test(text.slice(lineStart, start)) ? lineStart : start;
  const to = text[end] === "\n" ? end + 1 : end;
  return text.slice(0, from) + text.slice(to);
}

const DEPLOY_STAGE = /stage\(\s*['"]Build and Deploy['"]\s*\)\s*\{/;
const BRANCH_IF = /if\s*\(\s*"\$\{branch_name\}"\s*==~\s*\/\^(env|v)\(\.\*\)\/\s*\)\s*\{/g;

export function homologScript(script: string): string {
  let text = script;

  const stage = DEPLOY_STAGE.exec(text);
  if (!stage) throw new HomologPatchError('No "Build and Deploy" stage in the Jenkinsfile.');
  const stageBody = stage.index + stage[0].length;
  const when = /^\s*when\s*\{/.exec(text.slice(stageBody));
  if (when) {
    const start = stageBody + when.index + when[0].indexOf("when");
    text = cut(text, start, blockEnd(text, stageBody + when.index + when[0].length - 1));
  }

  // Each deploy group has one `if` for env/* and one for v*; only those that set deploy_stage.
  let removed = 0;
  for (;;) {
    BRANCH_IF.lastIndex = 0;
    let match: RegExpExecArray | null;
    let found = false;
    while ((match = BRANCH_IF.exec(text))) {
      const end = blockEnd(text, match.index + match[0].length - 1);
      if (!text.slice(match.index, end).includes("deploy_stage")) continue;
      text = cut(text, match.index, end);
      removed += 1;
      found = true;
      break;
    }
    if (!found) break;
  }

  if (removed === 0 || removed % 2 !== 0) {
    throw new HomologPatchError(
      `Expected an env/* and a v* deploy_stage if per deploy group, found ${removed}.`,
    );
  }
  if (/deploy_stage\s*=\s*['"]prod['"]|deploy_stage\s*=\s*"\$\{branch_name\}"/.test(text)) {
    throw new HomologPatchError("A deploy_stage other than 'test' is still set.");
  }
  if (!/deploy_stage\s*=\s*['"]test['"]/.test(text)) {
    throw new HomologPatchError("No deploy_stage = 'test' left to deploy to homolog.");
  }
  return text;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

export function unescapeHtml(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code.startsWith("#")) {
      const n = /^#x/i.test(code) ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

function jenkinsAuth(): string {
  const user = process.env.JENKINS_USER;
  const token = process.env.JENKINS_TOKEN;
  if (!user || !token) throw new Error("JENKINS_USER and JENKINS_TOKEN must be set.");
  return `Basic ${Buffer.from(`${user}:${token}`).toString("base64")}`;
}

async function jenkinsGet(url: string): Promise<Response> {
  const response = await apiFetch("jenkins", url, { headers: { Authorization: jenkinsAuth() } });
  if (!response.ok)
    throw new Error(`Jenkins answered ${response.status} for ${new URL(url).pathname}.`);
  return response;
}

/** The Jenkinsfile a build ran, as its Replay page shows it. */
export async function replayScript(buildPage: string): Promise<string> {
  const html = await (await jenkinsGet(`${buildPage}replay/`)).text();
  const match = /<textarea[^>]*name="_\.mainScript"[^>]*>([\s\S]*?)<\/textarea>/.exec(html);
  if (!match) throw new Error("No script on the build's Replay page.");
  // The textarea's first line break belongs to the markup, not the script.
  return unescapeHtml(match[1] ?? "").replace(/^\r?\n/, "");
}

async function lastBuildNumber(jobPage: string): Promise<number> {
  const data = (await (
    await jenkinsGet(`${jobPage}api/json?tree=lastBuild%5Bnumber%5D`)
  ).json()) as {
    lastBuild?: { number?: number };
  };
  return data.lastBuild?.number ?? 0;
}

/** Replays `statusUrl`'s build with the Jenkinsfile pointed at homolog; the new build's page. */
export async function replayToHomolog(statusUrl: string): Promise<string> {
  const page = buildPageUrl(statusUrl);
  const job = jobPageUrl(page);
  const script = homologScript(await replayScript(page));
  const before = await lastBuildNumber(job);
  const auth = jenkinsAuth();
  const crumb = (await (
    await jenkinsGet(`${new URL(page).origin}/crumbIssuer/api/json`)
  ).json()) as {
    crumb: string;
    crumbRequestField: string;
  };
  const form = new URLSearchParams({
    "_.mainScript": script,
    json: JSON.stringify({ mainScript: script }),
    Submit: "Run",
  });
  const response = await apiFetch("jenkins", `${page}replay/run`, {
    method: "POST",
    headers: {
      Authorization: auth,
      [crumb.crumbRequestField]: crumb.crumb,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
    redirect: "manual",
  });
  if (response.status >= 400) throw new Error(`Jenkins refused the replay (${response.status}).`);
  // The replay is queued: its build shows up as the job's next number.
  for (let i = 0; i < 30; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const number = await lastBuildNumber(job);
    if (number > before) return `${job}${number}/`;
  }
  return `${job}${before + 1}/`;
}

/** A build's result: null while it runs. */
export async function buildResult(buildPage: string): Promise<string | null> {
  const data = (await (await jenkinsGet(`${buildPage}api/json?tree=result,building`)).json()) as {
    result?: string | null;
    building?: boolean;
  };
  return data.building ? null : (data.result ?? null);
}
