import type { BoardWatcherConfig } from "./config.js";
import type { ActionEntry } from "./simulation.js";
import { buildDigestCard, reasonPtBr } from "./teamsCards.js";

/** The start/end-of-day summary card, from the actions recorded since the last one. */
/** "src/a/b/File.tsx:12 — text" → "File.tsx:12 — text": the comment is what's being judged. */
function shortPath(detail = ""): string {
  return detail.replace(/^\S*\/([^/\s]+:\d+ — )/, "$1");
}

/** Product questions from reviews stay in the actions log only: whoever reviews the code doesn't
 *  need them (the PO/QA see copy, prices and design in testing). */
export function buildActionsDigest(
  entries: ActionEntry[],
  config: BoardWatcherConfig,
  since: Date,
  simulated: boolean,
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
  const verb = simulated ? "faria" : "fez";
  return buildDigestCard({
    title: "Board watcher · resumo",
    subtitle: `${simulated ? "SIMULAÇÃO: nada foi feito no Jira nem no Bitbucket. " : ""}Desde ${sinceText}.${
      entries.length === 0 ? ` Nada que ele ${verb} nesse período.` : ""
    }`,
    sections: [
      {
        heading: simulated ? "Entraria na fila para desenvolver" : "Entrou na fila",
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
        heading: simulated ? "Pegaria para testar" : "Pegou para testar",
        items: of("claim-test").map((e) => line(e, issueLink)),
      },
      {
        heading: "Na fila de review",
        items: of("review")
          .filter((e) => !reviewed.has(e.subject))
          .map((e) => line(e, prLink)),
      },
      {
        heading: simulated ? "Revisou (sem postar)" : "Revisou",
        items: of("reviewed").map((e) => `${line(e, prLink)} — ${short(e.detail, 300)}`),
      },
      {
        heading: simulated ? "Comentaria" : "Comentou",
        items: of("comment").map((e) => `${prLink(e.subject)}: ${shortPath(e.detail)}`),
      },
      {
        heading: simulated ? "Aprovaria" : "Aprovou",
        items: of("approve").map((e) => line(e, prLink)),
      },
      {
        heading: simulated ? "Não aprovaria" : "Não aprovou",
        items: notApproved.map((e) => prLink(e.subject.replace("Not approved: ", ""))),
      },
      {
        heading: "Review não rodou",
        items: of("review-failed").map((e) => `${prLink(e.subject)}: ${short(e.detail, 200)}`),
      },
      {
        heading: simulated ? "Pausaria" : "Pausou",
        items: urgent.map((e) => `${e.subject}: ${(e.detail ?? "").replace(/^urgent: /, "")}`),
      },
    ],
    link: config.jira?.boardUrl ? { title: "Abrir o board", url: config.jira.boardUrl } : undefined,
  });
}
