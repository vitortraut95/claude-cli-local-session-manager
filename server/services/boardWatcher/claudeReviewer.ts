import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { isInstalled } from "../installedSkillService.js";
import { forceRemoveWorktree, runGit } from "../../utils/git.js";
import { sanitizedSpawnEnv } from "../../utils/spawnEnv.js";
import { lessonsSection } from "./feedback.js";
import { jiraCredentialsFromEnv, searchIssues } from "./jira.js";
import { prSubject, type PullRequest, type ReviewFinding, type ReviewResult } from "./types.js";

/**
 * A real PR review: a detached worktree of the PR's commit in the local clone, then a
 * non-interactive `claude -p` limited to reading (Read/Grep/Glob and read-only git) running the
 * review skill (`review.skill`), which holds how to review. This file only gathers the context
 * (merge-base, the ticket with its comments, the other open PRs touching the same ticket or
 * files, the user's lessons) and asks for the skill's result format. It's the PR's one AI review:
 * a full one, never a follow-up round. Returns structured findings; posting them is up to the
 * caller. The worktree is always removed; the session stays in the session list.
 */

const execFileAsync = promisify(execFile);
const REVIEW_TIMEOUT_MS = 20 * 60_000;
const TICKET_KEY = /\b[A-Z][A-Z0-9]+-\d+\b/;
/** Up to this, a PR counts as small (a quicker, cheaper model reviews it). */
const SMALL_PR = { maxFiles: 5, maxLines: 150 };
export const DEFAULT_REVIEW_SKILL = "automated-code-review";

export type ReviewOutput = ReviewResult & {
  summary: string;
  ticketMatch: string;
  verdict: string;
  confidence: string;
  /** The model it ran with ("default" = the CLI's) and the PR's size. */
  model: string;
  size: { files: number; lines: number };
  /** As the CLI reports them. */
  costUsd?: number;
  durationMs?: number;
};

export type ReviewContext = {
  repoPath: string;
  /** The PR's page, what the skill is called with (its `repo#id` without one). */
  prUrl: string | null;
  /** The installed skill that reviews; default `DEFAULT_REVIEW_SKILL`. */
  skill?: string;
  /** Kills the session (the automations switch went off). */
  signal?: AbortSignal;
  jiraSite?: string;
  /** Other open PRs, to find the related ones. */
  openPrs: PullRequest[];
  model?: string;
  /** For a PR within `smallPr`; null = always `model`. */
  smallModel?: string | null;
  smallPr?: { maxFiles?: number; maxLines?: number };
  maxBudgetUsd?: number;
  /** The user's notes on earlier reviews (`feedback.ts`), added to the prompt. */
  lessons?: string[];
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
  "Skill",
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

/** Files and lines (added + removed) the PR changes. */
async function diffSize(cwd: string, base: string): Promise<{ files: number; lines: number }> {
  const stat = await runGit(["diff", "--shortstat", `${base}...HEAD`], cwd).catch(() => "");
  const count = (pattern: RegExp) => Number(pattern.exec(stat)?.[1] ?? 0);
  return {
    files: count(/(\d+) files? changed/),
    lines: count(/(\d+) insertions?/) + count(/(\d+) deletions?/),
  };
}

async function changedFiles(cwd: string, base: string, head: string): Promise<string[]> {
  const out = await runGit(["diff", "--name-only", `${base}...${head}`], cwd).catch(() => "");
  return out.split("\n").filter(Boolean);
}

function buildPrompt(
  skill: string,
  prUrl: string,
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
  return `/${skill} ${prUrl}

Unattended run for the board automations: no questions, read-only, never post or approve anything (the caller posts the result).

PR ${prSubject(pr)}: "${pr.title}"
Branch ${pr.sourceBranch} → ${pr.destinationBranch}. You are in a checkout of its commit; see the change with \`git diff ${base}...HEAD\` (merge-base already resolved).

Ticket:
${ticket}

Other open PRs on the same ticket or files:
${relatedText}

Return the skill's result (summary, ticketMatch, verdict, confidence, findings) as the structured output.`;
}

export async function runClaudeReview(
  pr: PullRequest,
  context: ReviewContext,
): Promise<ReviewOutput> {
  if (!pr.sourceHash || !pr.sourceBranch || !pr.destinationBranch) {
    throw new Error(`${prSubject(pr)} has no source commit or branches.`);
  }
  const skill = context.skill ?? DEFAULT_REVIEW_SKILL;
  if (!(await isInstalled(skill))) {
    throw new Error(`The review skill "${skill}" isn't installed in ~/.claude/skills.`);
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

    const prompt =
      buildPrompt(
        skill,
        context.prUrl ?? prSubject(pr),
        pr,
        base,
        await ticketContext(context.jiraSite, key),
        relatedWithFiles,
      ) +
      lessonsSection(context.lessons ?? []);
    const size = await diffSize(worktree, base);
    const small =
      context.smallModel !== null &&
      size.files <= (context.smallPr?.maxFiles ?? SMALL_PR.maxFiles) &&
      size.lines <= (context.smallPr?.maxLines ?? SMALL_PR.maxLines);
    const model = small ? (context.smallModel ?? "sonnet") : context.model;
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
      "--name",
      `Review ${prSubject(pr)}`,
      ...(model ? ["--model", model] : []),
      ...(context.maxBudgetUsd ? ["--max-budget-usd", String(context.maxBudgetUsd)] : []),
    ];
    const { stdout } = await execFileAsync("claude", args, {
      cwd: worktree,
      env: sanitizedSpawnEnv(),
      timeout: REVIEW_TIMEOUT_MS,
      signal: context.signal,
      maxBuffer: 32 * 1024 * 1024,
    });
    return { ...parseOutput(stdout), model: model ?? "default", size };
  } finally {
    await forceRemoveWorktree(worktree).catch((err: unknown) =>
      console.warn(`[board-watcher] Couldn't remove ${worktree}:`, err),
    );
  }
}

function parseOutput(stdout: string): Omit<ReviewOutput, "model" | "size"> {
  const envelope = JSON.parse(stdout) as {
    is_error?: boolean;
    result?: string;
    structured_output?: unknown;
    total_cost_usd?: number;
    duration_ms?: number;
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
    costUsd: envelope.total_cost_usd,
    durationMs: envelope.duration_ms,
    findings: (output.findings ?? []).filter(
      (f): f is ReviewFinding => typeof f.body === "string" && Boolean(f.severity),
    ),
  };
}
