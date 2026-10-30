import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { forceRemoveWorktree, runGit } from "../../utils/git.js";
import { sanitizedSpawnEnv } from "../../utils/spawnEnv.js";
import { jiraCredentialsFromEnv, searchIssues } from "./jira.js";
import { prSubject, type PullRequest, type ReviewFinding, type ReviewResult } from "./types.js";

/**
 * A real PR review: a detached worktree of the PR's commit in the local clone, then a
 * non-interactive `claude -p` limited to reading (Read/Grep/Glob and read-only git), given the
 * ticket with its comments and the other open PRs touching the same ticket or files. Returns
 * structured findings; posting them is up to the caller. The worktree is always removed.
 */

const execFileAsync = promisify(execFile);
const REVIEW_TIMEOUT_MS = 20 * 60_000;
const TICKET_KEY = /\b[A-Z][A-Z0-9]+-\d+\b/;

export type ReviewOutput = ReviewResult & {
  summary: string;
  ticketMatch: string;
  verdict: string;
  confidence: string;
};

export type ReviewContext = {
  repoPath: string;
  jiraSite?: string;
  /** Other open PRs, to find the related ones. */
  openPrs: PullRequest[];
  model?: string;
  maxBudgetUsd?: number;
};

const OUTPUT_SCHEMA = {
  type: "object",
  required: ["summary", "ticketMatch", "verdict", "confidence", "findings"],
  properties: {
    summary: { type: "string" },
    ticketMatch: { type: "string" },
    verdict: { type: "string", enum: ["approve", "comment-and-approve", "do-not-approve"] },
    confidence: { type: "string" },
    findings: {
      type: "array",
      items: {
        type: "object",
        required: ["severity", "topic", "body"],
        properties: {
          severity: { type: "string", enum: ["blocking", "major", "minor"] },
          topic: { type: "string", enum: ["code", "product"] },
          file: { type: "string" },
          line: { type: "integer" },
          body: { type: "string" },
        },
      },
    },
  },
};

const READ_ONLY_TOOLS = [
  "Read",
  "Grep",
  "Glob",
  "Bash(git diff:*)",
  "Bash(git log:*)",
  "Bash(git show:*)",
  "Bash(git grep:*)",
  "Bash(git ls-files:*)",
];

function ticketKeyOf(pr: PullRequest): string | null {
  return (TICKET_KEY.exec(pr.title) ?? TICKET_KEY.exec(pr.sourceBranch ?? ""))?.[0] ?? null;
}

async function ticketContext(site: string | undefined, key: string | null): Promise<string> {
  if (!site || !key) return "No ticket found in the PR title or branch.";
  try {
    const [issue] = await searchIssues(jiraCredentialsFromEnv(site), `key = ${key}`, 1);
    if (!issue) return `Ticket ${key} not found.`;
    const comments = issue.comments
      .slice(-5)
      .map((c) => `--- comment (${c.created})\n${c.body.slice(0, 1500)}`)
      .join("\n");
    return `${key}: ${issue.summary}\n\n${issue.description.slice(0, 4000)}\n\n${comments}`;
  } catch (err) {
    return `Couldn't read ${key}: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function changedFiles(cwd: string, base: string, head: string): Promise<string[]> {
  const out = await runGit(["diff", "--name-only", `${base}...${head}`], cwd).catch(() => "");
  return out.split("\n").filter(Boolean);
}

function buildPrompt(
  pr: PullRequest,
  base: string,
  ticket: string,
  related: { pr: PullRequest; files: string[] }[],
): string {
  const relatedText = related.length
    ? related
        .map(
          ({ pr: other, files }) =>
            `- ${prSubject(other)} "${other.title}" (${other.sourceBranch} → ${other.destinationBranch}, commit ${other.sourceHash}); diff with \`git diff origin/${other.destinationBranch}...${other.sourceHash}\`; shared files: ${files.join(", ") || "none (same ticket)"}`,
        )
        .join("\n")
    : "None.";
  return `You are reviewing a colleague's pull request. You are in a read-only checkout of its commit; never edit files, never run anything that writes.

PR ${prSubject(pr)}: "${pr.title}"
Branch ${pr.sourceBranch} → ${pr.destinationBranch}. See the change with \`git diff ${base}...HEAD\` (merge-base already resolved). Search the whole repo for other uses of what changed.

Ticket (what the PR should do):
${ticket}

Other open PRs on the same ticket or files (one of them may already handle something this PR seems to miss; check before flagging):
${relatedText}

Look for correctness bugs, edge cases (null/undefined, empty lists, missing countries/brands/locales), regressions in other uses of changed code, security issues and behavior that contradicts the ticket. Verify every finding in the code; drop what you can't back up.

Severity: blocking = a real bug, security issue or regression that should stop the merge; major = worth fixing but not a blocker; minor = style/nitpicks (never posted).
Topic: code = about the code; product = a question for PO/design/content (prices to confirm, copy, Figma parity). Product findings never block and are not posted.
Changes that belong to another ticket (extra commits or scope the ticket doesn't mention) are topic code, severity major: say what's extra and suggest splitting it out or naming it in the PR title/description.

Write each finding's body in Portuguese (pt-BR), short, in a suggestion tone, exactly as it would be posted as an inline comment to a colleague. summary/ticketMatch/confidence in pt-BR too. verdict: approve, comment-and-approve or do-not-approve (only with a blocking code finding).`;
}

export async function runClaudeReview(
  pr: PullRequest,
  context: ReviewContext,
): Promise<ReviewOutput> {
  if (!pr.sourceHash || !pr.sourceBranch || !pr.destinationBranch) {
    throw new Error(`${prSubject(pr)} has no source commit or branches.`);
  }
  const related = context.openPrs.filter(
    (other) => prSubject(other) !== prSubject(pr) && other.repo === pr.repo && other.sourceHash,
  );
  const branches = [
    pr.sourceBranch,
    pr.destinationBranch,
    ...related.flatMap((o) => [o.sourceBranch ?? "", o.destinationBranch ?? ""]),
  ].filter((b, i, all) => b && all.indexOf(b) === i);
  await runGit(["fetch", "origin", ...branches], context.repoPath, {
    nonInteractive: true,
    timeoutMs: 180_000,
  });

  const worktree = path.join(
    context.repoPath,
    ".claude",
    "worktrees",
    `review-${pr.repo}-${pr.id}-${pr.sourceHash.slice(0, 8)}`,
  );
  await forceRemoveWorktree(worktree).catch(() => undefined);
  await runGit(["worktree", "add", "--detach", worktree, pr.sourceHash], context.repoPath);
  try {
    const base = await runGit(["merge-base", `origin/${pr.destinationBranch}`, "HEAD"], worktree);
    const files = new Set(await changedFiles(worktree, base, "HEAD"));
    const key = ticketKeyOf(pr);
    const relatedWithFiles = (
      await Promise.all(
        related.map(async (other) => {
          const theirs = await changedFiles(
            worktree,
            `origin/${other.destinationBranch}`,
            other.sourceHash ?? "",
          );
          return { pr: other, files: theirs.filter((f) => files.has(f)) };
        }),
      )
    ).filter(
      ({ pr: other, files: shared }) => shared.length > 0 || (key && ticketKeyOf(other) === key),
    );

    const prompt = buildPrompt(
      pr,
      base,
      await ticketContext(context.jiraSite, key),
      relatedWithFiles,
    );
    const args = [
      "-p",
      prompt,
      "--output-format",
      "json",
      "--json-schema",
      JSON.stringify(OUTPUT_SCHEMA),
      "--allowedTools",
      READ_ONLY_TOOLS.join(" "),
      "--disallowedTools",
      "Edit Write NotebookEdit",
      "--permission-mode",
      "dontAsk",
      "--strict-mcp-config",
      "--no-session-persistence",
      ...(context.model ? ["--model", context.model] : []),
      ...(context.maxBudgetUsd ? ["--max-budget-usd", String(context.maxBudgetUsd)] : []),
    ];
    const { stdout } = await execFileAsync("claude", args, {
      cwd: worktree,
      env: sanitizedSpawnEnv(),
      timeout: REVIEW_TIMEOUT_MS,
      maxBuffer: 32 * 1024 * 1024,
    });
    return parseOutput(stdout);
  } finally {
    await forceRemoveWorktree(worktree).catch((err: unknown) =>
      console.warn(`[board-watcher] Couldn't remove ${worktree}:`, err),
    );
  }
}

function parseOutput(stdout: string): ReviewOutput {
  const envelope = JSON.parse(stdout) as {
    is_error?: boolean;
    result?: string;
    structured_output?: unknown;
  };
  if (envelope.is_error)
    throw new Error(`Review session failed: ${envelope.result ?? "no detail"}`);
  const raw: unknown =
    envelope.structured_output ??
    JSON.parse(/\{[\s\S]*\}/.exec(envelope.result ?? "")?.[0] ?? "null");
  if (!raw || typeof raw !== "object") throw new Error("Review session returned no findings JSON.");
  const output = raw as ReviewOutput;
  return {
    ...output,
    findings: (output.findings ?? []).filter(
      (f): f is ReviewFinding => typeof f.body === "string" && Boolean(f.severity),
    ),
  };
}
