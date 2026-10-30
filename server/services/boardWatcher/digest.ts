import type { BoardWatcherConfig } from "./config.js";
import type { ActionEntry } from "./simulation.js";
import { buildDigestCard, reasonPtBr } from "./teamsCards.js";

/** The start/end-of-day summary card, from the actions recorded since the last one. */
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
  const product = of("notify").filter((e) => e.subject.startsWith("Product questions: "));

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
        heading: simulated ? "Revisaria" : "Revisou",
        items: of("review").map((e) => line(e, prLink)),
      },
      { heading: "Aprovou", items: of("approve").map((e) => line(e, prLink)) },
      {
        heading: "Perguntas de produto vindas dos reviews",
        items: product.map((e) => `${e.subject.replace("Product questions: ", "")}: ${e.detail}`),
      },
    ],
    link: config.jira?.boardUrl ? { title: "Abrir o board", url: config.jira.boardUrl } : undefined,
  });
}
