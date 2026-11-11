import path from "node:path";
import { forceRemoveWorktree, runGit, sanitizeWorktreeDirName } from "../../utils/git.js";
import { BadRequestError } from "../../utils/httpError.js";
import { prSubject, type PullRequest, type ReviewFinding, type ReviewResult } from "./types.js";

/**
 * The AI review of a PR, done by the review skill (`taskReviewSkill`) in a queued session
 * (`taskReviewService.ts`). The skill gathers its own context (diff, ticket, related PRs); here
 * only the detached worktree of the PR's commit in the local clone (so it can search the whole
 * repo for other uses of what changed) and the result it sends back. It's the PR's one AI review:
 * a full one, never a follow-up round.
 */

export type ReviewOutput = ReviewResult & {
  summary: string;
  ticketMatch: string;
  verdict: string;
  confidence: string;
};

const VERDICTS = ["approve", "comment-and-approve", "do-not-approve"];
const SEVERITIES: ReviewFinding["severity"][] = ["blocking", "major", "minor"];

/** The result the skill sends back, for the error of a result that doesn't fit. */
export const REVIEW_RESULT_SHAPE =
  '{ "summary": string, "ticketMatch": string, "verdict": "approve" | "comment-and-approve" | ' +
  '"do-not-approve", "confidence": string, "findings": [{ "severity": "blocking" | "major" | ' +
  '"minor", "topic": "code" | "product", "file"?: string, "line"?: number, "body": string }] }';

/** Fetches origin (the skill diffs against the target branch and the related PRs' commits) and
 *  checks out the PR's commit in `.claude/worktrees/review-<repo>-<id>`, a leftover one replaced. */
export async function prepareReviewWorktree(pr: PullRequest, repoPath: string): Promise<string> {
  if (!pr.sourceHash) throw new Error(`${prSubject(pr)} has no source commit.`);
  await runGit(["fetch", "origin"], repoPath, { nonInteractive: true, timeoutMs: 180_000 });
  const worktree = path.join(
    repoPath,
    ".claude",
    "worktrees",
    sanitizeWorktreeDirName(`review-${pr.repo}-${pr.id}`),
  );
  await forceRemoveWorktree(worktree).catch(() => undefined);
  await runGit(["worktree", "add", "--detach", worktree, pr.sourceHash], repoPath);
  return worktree;
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
