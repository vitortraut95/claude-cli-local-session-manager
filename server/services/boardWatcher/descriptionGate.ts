import type { BoardIssue } from "./types.js";

/**
 * Cheap, explainable check of whether a ticket is described well enough to be worked on without
 * the user: one point per thing a developer needs, minus one for a visual change with no Figma.
 * The `missing` list is what gets reported back, so it can be passed on to whoever wrote it.
 */

export type DescriptionVerdict = { score: number; passed: boolean; missing: string[] };

const MIN_LENGTH = 40;
const DETAILED_LENGTH = 200;

const GIVEN_WHEN_THEN = /\b(dado|given)\b[\s\S]*\b(quando|when)\b[\s\S]*(\bent[ãa]o\b|\bthen\b)/i;
const ACCEPTANCE = /crit[ée]rios? de aceit[ea]|acceptance criteria/i;
const LIST_ITEM = /^\s*([-*•]|\d+[.)])\s+\S/gm;
const EXPECTED = /esperado|expected|\bdeve(m)?\b|\bshould\b|\bent[ãa]o\b|\bthen\b/i;
const LOCATION =
  /https?:\/\/|\b(p[áa]gina|page|tela|screen|rota|route|url|carrinho|cart|checkout|home|modal|menu)\b/i;
const EVIDENCE = /!\[|figma\.com|\.(png|jpe?g|gif|webp)\b|blob:/i;
const VISUAL = /\b(layout|design|visual|figma|ui|banner|estilo|style)\b/i;
const FIGMA = /figma\.com/i;

export function gradeDescription(issue: BoardIssue, minScore: number): DescriptionVerdict {
  const text = issue.description.trim();
  if (text.length < MIN_LENGTH) return { score: 0, passed: false, missing: ["no description"] };

  const missing: string[] = [];
  let score = 0;
  const check = (ok: boolean, whenMissing: string) => {
    if (ok) score += 1;
    else missing.push(whenMissing);
  };
  check(text.length >= DETAILED_LENGTH, "short description");
  check(
    GIVEN_WHEN_THEN.test(text) ||
      ACCEPTANCE.test(text) ||
      (text.match(LIST_ITEM)?.length ?? 0) >= 2,
    "no steps, acceptance criteria or Given/When/Then",
  );
  check(EXPECTED.test(text), "no expected result");
  check(LOCATION.test(text), "no page or URL");
  check(EVIDENCE.test(text), "no screenshot or Figma");

  if (VISUAL.test(`${issue.summary} ${issue.labels.join(" ")}`) && !FIGMA.test(text)) {
    score -= 1;
    missing.push("visual change without Figma");
  }
  score = Math.max(score, 0);
  return { score, passed: score >= minScore, missing };
}
