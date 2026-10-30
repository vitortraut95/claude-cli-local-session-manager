import type { BoardWatcherConfig } from "./config.js";
import type { ActionEntry } from "./simulation.js";
import { buildNoticeCard, reasonPtBr, type CardSection } from "./teamsCards.js";

const MAX_DETAIL_ITEMS = 5;

/** "src/a/b/File.tsx:12 — text" → "File.tsx:12 — text": the comment is what's being judged. */
function shortPath(detail = ""): string {
  return detail.replace(/^\S*\/([^/\s]+:\d+ — )/, "$1");
}

/**
 * The start/end-of-day summary, from the actions recorded since the last one: the counts and up
 * to 3 things that need a look, everything else behind "Ver detalhes". Product questions from
 * reviews stay in the actions log only: whoever reviews the code doesn't need them (the PO/QA see
 * copy, prices and design in testing).
 */
export function buildActionsDigest(
  entries: ActionEntry[],
  config: BoardWatcherConfig,
  since: Date,
): Record<string, unknown> {
  const site = config.jira?.site;
  const issueLink = (key: string) => (site ? `[${key}](https://${site}/browse/${key})` : key);
  const prLink = (subject: string) => {
    const [repo, id] = subject.split("#");
    const workspace = config.bitbucket?.workspace;
    return workspace && repo && id
      ? `[${subject}](https://bitbucket.org/${workspace}/${repo}/pull-requests/${id})`
      : subject;
  };
  const line = (entry: ActionEntry, link: (subject: string) => string) =>
    `${link(entry.subject)} ${entry.title}`.trim();
  const of = (action: ActionEntry["action"]) => entries.filter((e) => e.action === action);
  // Wording per kind of write: "aprovou" once approvals are real, "aprovaria" while simulated.
  const live = config.live ?? {};
  const sim = {
    devQueue: !live.devQueue && !of("enqueue-dev").some((e) => e.live),
    testClaim: !live.testClaim && !of("claim-test").some((e) => e.live),
    comments: !live.comments && !of("comment").some((e) => e.live),
    approve: !live.approve && !of("approve").some((e) => e.live),
  };
  const simulated = Object.values(sim).every(Boolean);
  const weak = of("notify").filter((e) => e.subject.startsWith("Weak description: "));
  const notApproved = of("notify").filter((e) => e.subject.startsWith("Not approved: "));
  const urgent = of("notify").filter((e) => e.detail?.startsWith("urgent: "));
  const reviewed = new Set(of("reviewed").map((e) => e.subject));
  const short = (text = "", max = 400) => (text.length > max ? `${text.slice(0, max)}…` : text);

  const sinceText = since.toLocaleString("pt-BR", {
    timeZone: config.businessHours.timezone,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const count = (action: ActionEntry["action"]) => of(action).length;
  const headline = [
    [count("enqueue-dev"), "na fila de dev"],
    [count("claim-test") + count("queued-test"), "testes pegos"],
    [count("retest"), "retestes"],
    [count("reviewed"), "revisados"],
    [count("approve"), sim.approve ? "aprovaria" : "aprovados"],
    [notApproved.length, sim.approve ? "não aprovaria" : "não aprovados"],
    [count("review-failed") + count("test-failed"), "falhas"],
  ]
    .filter(([n]) => Number(n) > 0)
    .map(([n, label]) => `${n} ${label}`)
    .join(" · ");
  const attention = [
    ...notApproved.map(
      (e) =>
        `${prLink(e.subject.replace("Not approved: ", ""))} ${sim.approve ? "não aprovaria" : "não aprovado"}`,
    ),
    ...[...of("review-failed"), ...of("test-failed")].map(
      (e) =>
        `${e.action === "review-failed" ? prLink(e.subject) : issueLink(e.subject)} ${e.action === "review-failed" ? "review" : "teste"} não rodou`,
    ),
    ...weak.map((e) => `${issueLink(e.subject.replace("Weak description: ", ""))} descrição fraca`),
    ...urgent.map((e) => `${e.subject}`),
  ];
  const shownAttention = attention.slice(0, 3);
  if (attention.length > shownAttention.length) {
    shownAttention.push(`+${attention.length - shownAttention.length} em "Ver detalhes"`);
  }
  const sections: CardSection[] = [
    {
      heading: sim.devQueue ? "Entraria na fila para desenvolver" : "Entrou na fila de dev",
      items: of("enqueue-dev").map((e) => line(e, issueLink)),
    },
    {
      heading: "Descrição insuficiente, não entraria na fila",
      items: weak.map((e) => {
        const key = e.subject.replace("Weak description: ", "");
        const reason = reasonPtBr((e.detail ?? "").replace(/^digest: /, ""));
        return `${issueLink(key)} ${reason}`;
      }),
    },
    {
      heading: sim.testClaim ? "Pegaria para testar" : "Moveu para Testing",
      items: of("claim-test").map((e) => line(e, issueLink)),
    },
    {
      heading: "Voltou para reteste (correção depois do teste reprovado)",
      items: of("retest").map((e) => line(e, issueLink)),
    },
    {
      heading: "Colocou na fila de teste do app",
      items: of("queued-test").map((e) => `${line(e, issueLink)} — ${short(e.detail, 200)}`),
    },
    {
      heading: simulated ? "Testou (sem postar)" : "Testou",
      items: of("tested").map(
        (e) => `${line(e, issueLink)} — ${short(e.detail?.split("\n")[0], 300)}`,
      ),
    },
    {
      heading: "Teste não rodou",
      items: of("test-failed").map((e) => `${issueLink(e.subject)}: ${short(e.detail, 200)}`),
    },
    {
      heading: "Na fila de review",
      items: of("review")
        .filter((e) => !reviewed.has(e.subject))
        .map((e) => line(e, prLink)),
    },
    {
      heading: sim.comments ? "Revisou (sem postar)" : "Revisou",
      items: of("reviewed").map((e) => `${line(e, prLink)} — ${short(e.detail, 300)}`),
    },
    {
      heading: sim.comments ? "Comentaria" : "Comentou",
      items: of("comment").map((e) => `${prLink(e.subject)}: ${shortPath(e.detail)}`),
    },
    {
      heading: sim.approve ? "Aprovaria" : "Aprovou",
      items: of("approve").map((e) => line(e, prLink)),
    },
    {
      heading: sim.approve ? "Não aprovaria" : "Não aprovou",
      items: notApproved.map((e) => prLink(e.subject.replace("Not approved: ", ""))),
    },
    {
      heading: "Review não rodou",
      items: of("review-failed").map((e) => `${prLink(e.subject)}: ${short(e.detail, 200)}`),
    },
    {
      heading: "Pausou",
      items: urgent.map((e) => `${e.subject}: ${(e.detail ?? "").replace(/^urgent: /, "")}`),
    },
  ];
  return buildNoticeCard({
    level: "digest",
    title: `Resumo${simulated ? " (simulação)" : ""}`,
    summary: headline ? `Desde ${sinceText}: ${headline}.` : `Nada desde ${sinceText}.`,
    highlights: { heading: "Precisa de atenção", items: shownAttention },
    details: sections.map((section) => {
      const shown = section.items.slice(0, MAX_DETAIL_ITEMS);
      const more = section.items.length - shown.length;
      return {
        heading: `${section.heading} (${section.items.length})`,
        items: more > 0 ? [...shown, `… e mais ${more} (veja no Board do Session Manager)`] : shown,
      };
    }),
    links: config.jira?.boardUrl ? [{ title: "Abrir o board", url: config.jira.boardUrl }] : [],
  });
}
