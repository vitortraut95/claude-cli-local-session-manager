import path from "node:path";
import { forceRemoveWorktree, runGit, sanitizeWorktreeDirName } from "../../utils/git.js";
import { BadRequestError } from "../../utils/httpError.js";
import { lessonsSection } from "./feedback.js";
import { jiraCredentialsFromEnv, searchIssues } from "./jira.js";
import { prSubject, type PullRequest, type ReviewFinding, type ReviewResult } from "./types.js";

/**
 * The AI review of a PR, done by the review skill (`taskReviewSkill`) in a queued session
 * (`taskReviewService.ts`), which holds how to review. Here: a detached worktree of the PR's
 * commit in the local clone (so the skill can search the whole repo for other uses of what
 * changed), the context it's handed (merge-base, the ticket with its comments, the other open PRs
 * touching the same ticket or files, the user's lessons) and the result it sends back. It's the
 * PR's one AI review: a full one, never a follow-up round.
 */

const TICKET_KEY = /\b[A-Z][A-Z0-9]+-\d+\b/;

export type ReviewOutput = ReviewResult & {
  summary: string;
  ticketMatch: string;
  verdict: string;
  confidence: string;
};

const VERDICTS = ["approve", "comment-and-approve", "do-not-approve"];
const SEVERITIES: ReviewFinding["severity"][] = ["blocking", "major", "minor"];

/** The result the skill sends back, as the prompt describes it to the session. */
export const REVIEW_RESULT_SHAPE =
  '{ "summary": string, "ticketMatch": string, "verdict": "approve" | "comment-and-approve" | ' +
  '"do-not-approve", "confidence": string, "findings": [{ "severity": "blocking" | "major" | ' +
  '"minor", "topic": "code" | "product", "file"?: string, "line"?: number, "body": string }] }';

export type ReviewContext = {
  repoPath: string;
  jiraSite?: string;
  /** Other open PRs, to find the related ones. */
  openPrs: PullRequest[];
  /** The user's notes on earlier reviews (`feedback.ts`). */
  lessons?: string[];
};

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

function contextText(
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
  return `PR ${prSubject(pr)}: "${pr.title}"
Branch ${pr.sourceBranch} → ${pr.destinationBranch}. You are in a checkout of its commit; see the change with \`git diff ${base}...HEAD\` (merge-base already resolved).

Ticket:
${ticket}

Other open PRs on the same ticket or files:
${relatedText}`;
}

/** The PR's worktree (`.claude/worktrees/review-<repo>-<id>`, a leftover one replaced) and the
 *  context for the skill. The worktree is removed again when this fails. */
export async function prepareReview(
  pr: PullRequest,
  context: ReviewContext,
): Promise<{ worktree: string; context: string }> {
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
    sanitizeWorktreeDirName(`review-${pr.repo}-${pr.id}`),
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
    const ticket = await ticketContext(context.jiraSite, key);
    return {
      worktree,
      context:
        contextText(pr, base, ticket, relatedWithFiles) + lessonsSection(context.lessons ?? []),
    };
  } catch (err) {
    await forceRemoveWorktree(worktree).catch(() => undefined);
    throw err;
  }
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** The result the session sent, checked against `REVIEW_RESULT_SHAPE`; findings it can't use
 *  are dropped. */
export function parseReviewOutput(raw: unknown): ReviewOutput {
  const value = (raw ?? {}) as Record<string, unknown>;
  if (typeof raw !== "object" || Array.isArray(raw) || !text(value.summary)) {
    throw new BadRequestError("REVIEW_RESULT_INVALID", `Expected ${REVIEW_RESULT_SHAPE}.`);
  }
  const verdict = text(value.verdict);
  if (!VERDICTS.includes(verdict)) {
    throw new BadRequestError(
      "REVIEW_RESULT_INVALID",
      `"verdict" must be one of ${VERDICTS.join(", ")}.`,
    );
  }
  const findings = (Array.isArray(value.findings) ? value.findings : []).flatMap(
    (item): ReviewFinding[] => {
      const finding = (item ?? {}) as Record<string, unknown>;
      const severity = finding.severity as ReviewFinding["severity"];
      const body = text(finding.body);
      if (!SEVERITIES.includes(severity) || !body) return [];
      return [
        {
          severity,
          topic: finding.topic === "product" ? "product" : "code",
          body,
          ...(text(finding.file) ? { file: text(finding.file) } : {}),
          ...(Number.isInteger(finding.line) && (finding.line as number) > 0
            ? { line: finding.line as number }
            : {}),
        },
      ];
    },
  );
  return {
    summary: text(value.summary),
    ticketMatch: text(value.ticketMatch),
    verdict,
    confidence: text(value.confidence),
    findings,
  };
}
