import type { BoardIssue, IssueComment } from "./types.js";

/**
 * Finds a ticket's test plan in its comments: either a testing heading ("How to test", "Como
 * testar"…) followed by any list (numbered, bullets or numbered subheadings), or, with no
 * heading, two or more list items starting with a testing verb ("Conferir se…", "Abrir…"). A
 * test report ("Resultado: aprovado", "QA: reprovado") posted after the latest plan means it was
 * tested; a new plan after a report means it needs testing again. A report is never a plan, even
 * though it lists steps.
 */

export type TestPlanStatus =
  | { state: "none" }
  | { state: "tested"; plan: IssueComment }
  | { state: "pending"; plan: IssueComment };

const PLAN_HEADING =
  /(^|\n)\s*(\*\*|#+\s*)?\s*(como testar|como validar|pra testar|para testar|roteiro de teste|passo a passo de teste|how to test|test plan)\b/i;
const LIST_ITEM = /^\s*(#+\s*)?([-*•]|\d+[.)])\s+\S/m;
const TEST_STEP =
  /^\s*([-*•]|\d+[.)])\s+(\*\*)?(verificar|conferir|checar|testar|validar|abrir|acessar|clicar|check|verify|open|click)\b/gim;
const TEST_REPORT = [
  /\b(resultado|result)\s*:?\**\s*:?\s*(aprovado|reprovado|approved|rejected|passed|failed)/i,
  /(^|\n)\s*\**\s*QA\s*:\s*(aprovado|reprovado|approved|rejected|passed|failed)/i,
];

export function isTestReport(body: string): boolean {
  return TEST_REPORT.some((pattern) => pattern.test(body));
}

const FAILED_VERDICT = /\b(reprovado|rejected|failed)\b/i;

/** A report whose verdict is a fail ("Resultado: reprovado", "QA: failed"). */
export function isFailedTestReport(body: string): boolean {
  return TEST_REPORT.some((pattern) => FAILED_VERDICT.test(pattern.exec(body)?.[0] ?? ""));
}

export function isTestPlan(body: string): boolean {
  if (isTestReport(body)) return false;
  if (PLAN_HEADING.test(body) && LIST_ITEM.test(body)) return true;
  return (body.match(TEST_STEP)?.length ?? 0) >= 2;
}

export function testPlanStatus(comments: IssueComment[]): TestPlanStatus {
  const sorted = [...comments].sort((a, b) => Date.parse(a.created) - Date.parse(b.created));
  const plan = sorted.findLast((c) => isTestPlan(c.body));
  if (!plan) return { state: "none" };
  const testedAfter = sorted.some(
    (c) => Date.parse(c.created) > Date.parse(plan.created) && isTestReport(c.body),
  );
  return testedAfter ? { state: "tested", plan } : { state: "pending", plan };
}

/** Plan steps a browser test session can't carry out on its own, left for a person. */
const NEEDS_A_PERSON: [RegExp, string][] = [
  [/\bcurl\b/i, "runs commands (curl)"],
  [/\btags? (rc|v)\b|depois da tag|after the tag/i, "needs a release tag first"],
  [
    /\bwp-admin\b|\b(acess[ea]r?|abr[ai]r?|entr[ae]r? n)o? (cms|painel admin)|\bno cms,? (publique|suba|altere|edite|crie|cadastre)/i,
    "needs CMS/admin access",
  ],
  [
    /compra (real|em produ[çc][ãa]o)|cart[ãa]o (de cr[ée]dito )?real|real purchase/i,
    "needs a real purchase",
  ],
  [/confirmar com|alinhar com|check with/i, "depends on confirming with someone"],
];

/** Why this plan isn't for an unattended browser test, or null when it is. */
export function testabilityProblem(issue: BoardIssue, plan: IssueComment): string | null {
  for (const [pattern, problem] of NEEDS_A_PERSON) {
    if (pattern.test(plan.body)) return problem;
  }
  const links = [plan.body, ...issue.comments.map((c) => c.body), issue.description];
  if (!links.some((text) => /https?:\/\//.test(text))) return "no link to test on";
  return null;
}
