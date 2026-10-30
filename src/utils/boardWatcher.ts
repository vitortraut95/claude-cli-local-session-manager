import type {
  AutomationLimits,
  WatcherActionEntry,
  WatcherActionKind,
  WatcherDecision,
  WatcherDecisionAction,
} from "../../shared/boardWatcher";
import type { Language } from "../i18n/translations";

/** Same bounds the server accepts (`LIMIT_RANGES` in `server/services/boardWatcher/settings.ts`). */
export const LIMIT_BOUNDS: Record<keyof AutomationLimits, [number, number]> = {
  approveDelayHours: [0, 48],
  waitTestGraceMinutes: [0, 1440],
  maxClaimedTests: [1, 10],
  maxClaimsPerDay: [1, 50],
  maxApprovesPerDay: [1, 100],
  maxCommentsPerPr: [0, 20],
  maxReviewRounds: [1, 20],
  descriptionMinScore: [0, 5],
};

/** Same format the server accepts for business hours. */
export const HHMM_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The server writes these in English (`decide.ts`, `teamsCards.ts`, `tick.ts`). Patterns are
 *  applied in order, so the specific ones come first. Unknown text stays as it is. */
const SERVER_TEXT_PT: [RegExp, string][] = [
  [/^description scored (\d)\/5/, "nota $1/5"],
  [/no description/, "sem descrição"],
  [/short description/, "descrição curta"],
  [
    /no steps, acceptance criteria or Given\/When\/Then/,
    "sem passos, critérios de aceite ou Dado/Quando/Então",
  ],
  [/no expected result/, "sem resultado esperado"],
  [/no page or URL/, "sem página ou URL"],
  [/no screenshot or Figma/, "sem print ou Figma"],
  [/visual change without Figma/, "mudança visual sem Figma"],
  [/the user developed it/, "você é o dev"],
  [/no test plan in the comments/, "sem plano de teste nos comentários"],
  [/already tested since the last plan/, "já testada depois do último plano"],
  [/outside business hours/, "fora do horário comercial"],
  [/(\d+) tests already claimed/, "já há $1 testes em andamento"],
  [/test plan in comment \S+/, "tem plano de teste"],
  [/(\d+) tests claimed today/, "$1 testes pegos hoje"],
  [/no ticket in the PR title or branch/, "sem LED no título ou na branch do PR"],
  [/ticket (.+) isn't in Code Review yet/, "$1 ainda não está em Code Review"],
  [/^draft$/, "rascunho"],
  [/has conflicts/, "tem conflitos"],
  [/CI failed/, "CI falhou"],
  [/another reviewer requested changes/, "outro revisor pediu mudanças"],
  [/(\d+) review rounds already/, "já são $1 rodadas de review"],
  [/CI running/, "CI rodando"],
  [
    /giving people time to review \((\d+) of (\d+) business minutes\)/,
    "dando tempo pro time revisar ($1 de $2 minutos úteis)",
  ],
  [/ready for review/, "pronta pra review"],
  [/left for a person:/, "deixada pra uma pessoa:"],
  [/^Paused from the app$/, "pausado pelo app"],
  [/^plan usage at (\d+)% \(limit (\d+)%\)$/, "uso do plano em $1% (limite $2%)"],
  [/^(\d+) approvals today \(limit (\d+)\)$/, "$1 aprovações hoje (limite $2)"],
];

/** A server reason or pause text in the UI language (English stays as the server wrote it). */
export function translateServerText(text: string, language: Language): string {
  if (language !== "pt") return text;
  return SERVER_TEXT_PT.reduce((current, [pattern, pt]) => current.replace(pattern, pt), text);
}

export type DecisionColumn = "todo" | "waitTest" | "codeReview";

/** Subjects with a `#` are PRs (`repo#id`); the rest are ticket keys. */
export function decisionColumn(decision: WatcherDecision): DecisionColumn {
  if (decision.subject.includes("#")) return "codeReview";
  if (decision.action === "enqueue-dev" || decision.action === "weak-description") return "todo";
  return "waitTest";
}

export const DECISION_ACTION_KEYS = {
  "enqueue-dev": "board.decisionAction.enqueue-dev",
  "weak-description": "board.decisionAction.weak-description",
  "claim-test": "board.decisionAction.claim-test",
  review: "board.decisionAction.review",
  skip: "board.decisionAction.skip",
  wait: "board.decisionAction.wait",
} as const satisfies Record<WatcherDecisionAction, string>;

export const ACTION_KIND_KEYS = {
  "enqueue-dev": "board.kind.enqueue-dev",
  "claim-test": "board.kind.claim-test",
  "queued-test": "board.kind.queued-test",
  review: "board.kind.review",
  reviewed: "board.kind.reviewed",
  "review-failed": "board.kind.review-failed",
  tested: "board.kind.tested",
  "test-failed": "board.kind.test-failed",
  comment: "board.kind.comment",
  approve: "board.kind.approve",
  notify: "board.kind.notify",
} as const satisfies Record<WatcherActionKind, string>;

export const HISTORY_FILTERS = ["all", "reviews", "tests", "queue", "notices"] as const;
export type HistoryFilter = (typeof HISTORY_FILTERS)[number];

const HISTORY_FILTER_KINDS: Record<Exclude<HistoryFilter, "all">, WatcherActionKind[]> = {
  reviews: ["review", "reviewed", "review-failed", "approve", "comment"],
  tests: ["claim-test", "tested", "test-failed"],
  queue: ["enqueue-dev", "queued-test"],
  notices: ["notify"],
};

export function matchesHistoryFilter(entry: WatcherActionEntry, filter: HistoryFilter): boolean {
  return filter === "all" || HISTORY_FILTER_KINDS[filter].includes(entry.action);
}
