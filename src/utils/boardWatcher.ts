import type {
  AutomationLimits,
  WatcherActionEntry,
  WatcherActionKind,
  WatcherDecisionAction,
} from "../../shared/boardWatcher";
import type { Language } from "../i18n/translations";

/** Same bounds the server accepts (`LIMIT_RANGES` in `server/services/boardWatcher/settings.ts`). */
export const LIMIT_BOUNDS: Record<keyof AutomationLimits, [number, number]> = {
  waitTestGraceMinutes: [0, 1440],
  maxClaimedTests: [1, 10],
  maxClaimsPerDay: [1, 50],
  maxDevTasks: [1, 10],
  maxApprovesPerDay: [1, 100],
  maxCommentsPerPr: [0, 20],
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
  [/test failed; waiting for a fix push/, "teste reprovou; esperando push com a correção"],
  [/fix pushed after the failed test \(\S+\)/, "correção subiu depois do teste reprovado"],
  [/already tested since the last plan/, "já testada depois do último plano"],
  [/outside business hours/, "fora do horário comercial"],
  [/(\d+) tests already claimed/, "já há $1 testes em andamento"],
  [/test plan in comment \S+/, "tem plano de teste"],
  [/(\d+) tests claimed today/, "$1 testes pegos hoje"],
  [/(\d+) of my tasks already in development/, "já há $1 tarefa(s) suas em desenvolvimento"],
  [/ticket (.+) isn't in Code Review yet/, "$1 ainda não está em Code Review"],
  [/^draft$/, "rascunho"],
  [/has conflicts/, "tem conflitos"],
  [/CI failed/, "CI falhou"],
  [/another reviewer requested changes/, "outro revisor pediu mudanças"],
  [/already reviewed by AI/, "já teve o review por IA"],
  [/CI running/, "CI rodando"],
  [/ready for review/, "pronta pra review"],
  [/^started by hand$/, "iniciada à mão"],
  [/past Code Review without any approval/, "em Validation/Wait Deploy sem nenhuma aprovação"],
  [/left for a person:/, "deixada pra uma pessoa:"],
  [/^Paused from the app$/, "pausado pelo app"],
  [/^plan usage at (\d+)% \(limit (\d+)%\)$/, "uso do plano em $1% (limite $2%)"],
  [/^tests waiting: /, "testes esperando: "],
  [/^(\S+) is In Progress$/, "$1 está em In Progress"],
  [/started, and none of yours is In Progress/, "sessão iniciada e nenhuma sua em In Progress"],
  [/VPN disconnected/, "VPN desconectada"],
  [/IPv6 on/, "IPv6 ligado"],
  [/ and IPv6/, " e IPv6"],
  [/^(\d+) approvals today \(limit (\d+)\)$/, "$1 aprovações hoje (limite $2)"],
  // Review and test outcomes, skips and rebuilds (the live feed).
  [/^(\d+) finding\(s\), approve$/, "$1 achado(s), aprovou"],
  [/^(\d+) finding\(s\), comment-and-approve$/, "$1 achado(s), comentou e aprovou"],
  [/^(\d+) finding\(s\), do-not-approve$/, "$1 achado(s), não aprovou"],
  [/^approved-with-notes$/, "aprovado com ressalvas"],
  [/^approved$/, "aprovado"],
  [/^failed$/, "reprovado"],
  [/^blocked$/, "não conseguiu testar"],
  [/^queued$/, "na fila de teste"],
  [/^already queued$/, "já estava na fila de teste"],
  [/^new push$/, "push novo"],
  [/^MERGED$/, "mergeado"],
  [/^DECLINED$/, "recusado"],
  [/^SUPERSEDED$/, "substituído"],
  [/^done$/, "feito"],
  [/^look$/, "olhada"],
  [/^review$/, "review"],
  [/^test$/, "teste"],
  [/VPN is down/, "VPN desligada"],
  [/test plan found/, "plano de teste encontrado"],
  [/no acceptance criteria/, "sem critérios de aceite"],
  [/no link/, "sem link"],
];

export type SubjectKind = "pr" | "task" | "build";

/** A PR is `repo#id`, a rebuild `repo:hash`, anything else a ticket key. */
export function subjectKind(subject: string): SubjectKind {
  if (/^[^#\s]+#\d+$/.test(subject)) return "pr";
  if (/^[^:\s]+:[0-9a-f]{6,}$/i.test(subject)) return "build";
  return "task";
}

/** The PR or ticket page of a subject, from the status' link bases. */
export function subjectLinks(
  subject: string,
  bases: { jira: string | null; bitbucket: string | null } | undefined,
): { kind: "pr" | "issue"; url: string }[] {
  const pr = /^([^#\s]+)#(\d+)$/.exec(subject);
  if (pr)
    return bases?.bitbucket
      ? [{ kind: "pr", url: `${bases.bitbucket}${pr[1]}/pull-requests/${pr[2]}` }]
      : [];
  // Only a ticket key opens in Jira ("Infra: …" and the like have no page).
  if (!/^[A-Z][A-Z0-9]+-\d+$/.test(subject)) return [];
  return bases?.jira ? [{ kind: "issue", url: `${bases.jira}${subject}` }] : [];
}

/** A server reason or pause text in the UI language (English stays as the server wrote it). */
export function translateServerText(text: string, language: Language): string {
  if (language !== "pt") return text;
  return SERVER_TEXT_PT.reduce((current, [pattern, pt]) => current.replace(pattern, pt), text);
}

export const DECISION_ACTION_KEYS = {
  "enqueue-dev": "board.decisionAction.enqueue-dev",
  "weak-description": "board.decisionAction.weak-description",
  "claim-test": "board.decisionAction.claim-test",
  retest: "board.decisionAction.retest",
  "start-progress": "board.decisionAction.start-progress",
  review: "board.decisionAction.review",
  skip: "board.decisionAction.skip",
  wait: "board.decisionAction.wait",
} as const satisfies Record<WatcherDecisionAction, string>;

export const ACTION_KIND_KEYS = {
  "enqueue-dev": "board.kind.enqueue-dev",
  "claim-test": "board.kind.claim-test",
  retest: "board.kind.retest",
  "start-progress": "board.kind.start-progress",
  "queued-test": "board.kind.queued-test",
  review: "board.kind.review",
  reviewed: "board.kind.reviewed",
  "review-failed": "board.kind.review-failed",
  tested: "board.kind.tested",
  "test-failed": "board.kind.test-failed",
  comment: "board.kind.comment",
  approve: "board.kind.approve",
  notify: "board.kind.notify",
  "build-failed": "board.kind.build-failed",
  "pr-news": "board.kind.pr-news",
  homolog: "board.kind.homolog",
} as const satisfies Record<WatcherActionKind, string>;

export {
  HISTORY_FILTERS,
  matchesHistoryFilter,
  type HistoryFilter,
} from "../../shared/boardWatcher";

/** What the user can judge: the watcher's own calls, not its bookkeeping (started, failed). */
const RATEABLE: WatcherActionEntry["action"][] = [
  "reviewed",
  "comment",
  "approve",
  "tested",
  "enqueue-dev",
  "claim-test",
  "retest",
  "start-progress",
  "queued-test",
  "notify",
];

export function isRateable(entry: WatcherActionEntry): boolean {
  return RATEABLE.includes(entry.action);
}
