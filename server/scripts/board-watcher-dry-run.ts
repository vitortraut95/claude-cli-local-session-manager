/**
 * Read-only replay of the board watcher on the real board: takes the active sprint's issues that
 * sat in To Do or Wait Test since the sprint started and decides on each one as it was then
 * (status at the time, comments posted before it left), without writing anything to Jira. Prints
 * the decisions; `--send` also posts the digest (and an example of an urgent alert) to
 * `TEAMS_WEBHOOK_URL`.
 *
 * `yarn board-watcher:dry-run [--send]`. Needs `jira` in `boardWatcher.json` and
 * `JIRA_EMAIL`/`JIRA_API_TOKEN`. The current assignee and description are used, since their
 * history isn't replayed.
 */
import {
  loadBoardWatcherConfig,
  type BoardWatcherConfig,
} from "../services/boardWatcher/config.js";
import { decideIssues, type Decision } from "../services/boardWatcher/decide.js";
import { gradeDescription } from "../services/boardWatcher/descriptionGate.js";
import {
  activeSprint,
  jiraCredentialsFromEnv,
  searchIssues,
  type JiraIssue,
  type StatusStay,
} from "../services/boardWatcher/jira.js";
import {
  buildDigestCard,
  buildUrgentCard,
  postTeamsCard,
  reasonPtBr,
  type CardSection,
} from "../services/boardWatcher/teamsCards.js";
import { emptyWatcherState, type BoardIssue } from "../services/boardWatcher/types.js";

type Replayed = { issue: BoardIssue; column: "todo" | "waitTest"; at: Date; decision?: Decision };

function columnOf(stay: StatusStay, config: BoardWatcherConfig): "todo" | "waitTest" | null {
  if (config.columns.todo.includes(stay.statusId)) return "todo";
  if (config.columns.waitTest.includes(stay.statusId)) return "waitTest";
  return null;
}

/** The issue as it was at the end of its latest To Do / Wait Test stay since `since`. */
function replay(issue: JiraIssue, config: BoardWatcherConfig, since: Date): Replayed | null {
  const stay = issue.stays.findLast(
    (s) => columnOf(s, config) && (s.to === null || Date.parse(s.to) >= since.getTime()),
  );
  const column = stay && columnOf(stay, config);
  if (!stay || !column) return null;
  const at = stay.to ? new Date(Date.parse(stay.to) - 60_000) : new Date();
  const snapshot: BoardIssue = {
    ...issue,
    statusId: stay.statusId,
    statusSince: stay.from,
    comments: issue.comments.filter((c) => Date.parse(c.created) <= at.getTime()),
  };
  const [decision] = decideIssues([snapshot], emptyWatcherState(), config, at);
  return { issue: snapshot, column, at, decision };
}

function when(date: Date, config: BoardWatcherConfig): string {
  return date.toLocaleString("pt-BR", {
    timeZone: config.businessHours.timezone,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function main(): Promise<void> {
  const config = await loadBoardWatcherConfig();
  if (!config?.jira) throw new Error('boardWatcher.json needs "jira": { site, scopeJql }.');
  if (!config.jira.boardId) throw new Error('boardWatcher.json needs "jira.boardId".');
  const credentials = jiraCredentialsFromEnv(config.jira.site);
  const sprint = await activeSprint(credentials, config.jira.boardId);
  if (!sprint) throw new Error("The board has no active sprint.");
  const since = new Date(sprint.startDate);
  const issues = await searchIssues(
    credentials,
    `(${config.jira.scopeJql}) AND sprint in openSprints()`,
    300,
  );
  const replayed = issues
    .map((issue) => replay(issue, config, since))
    .filter((r): r is Replayed => r !== null)
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const link = (key: string) => `[${key}](https://${config.jira?.site}/browse/${key})`;
  const line = (r: Replayed) =>
    `${link(r.issue.key)} ${r.issue.summary} — ${when(r.at, config)}${
      r.decision ? ` · ${reasonPtBr(r.decision.reason)}` : ""
    }`;
  const by = (column: Replayed["column"], action?: string) =>
    replayed.filter((r) => r.column === column && r.decision?.action === action);

  console.log(
    `${issues.length} issues read, ${replayed.length} of ${sprint.name} passed through To Do / Wait Test\n`,
  );
  for (const r of replayed) {
    const grade =
      r.column === "todo" ? gradeDescription(r.issue, config.descriptionMinScore) : null;
    const mine =
      r.issue.assigneeId === config.me ? "mine" : r.issue.assigneeId ? "other" : "unassigned";
    console.log(
      [
        r.issue.key.padEnd(10),
        r.column.padEnd(8),
        when(r.at, config).padEnd(12),
        mine.padEnd(10),
        (r.decision?.action ?? "—").padEnd(16),
        r.decision?.reason ??
          (grade ? `(not mine) description ${grade.score}/5: ${grade.missing.join(", ")}` : ""),
      ].join(" "),
    );
  }

  const sections: CardSection[] = [
    { heading: "Entrariam na fila para desenvolver", items: by("todo", "enqueue-dev").map(line) },
    {
      heading: "Descrição insuficiente, não entrariam na fila",
      items: by("todo", "weak-description").map(line),
    },
    {
      heading: "Pegaria para testar (moveria para Testing)",
      items: by("waitTest", "claim-test").map(line),
    },
    { heading: "Esperaria", items: by("waitTest", "wait").map(line) },
    { heading: "Pularia no Wait Test", items: by("waitTest", "skip").map(line) },
  ];
  const ignored = replayed.filter((r) => !r.decision).length;
  const card = buildDigestCard({
    title: "Board watcher · resumo",
    subtitle: `SIMULAÇÃO só leitura do sprint ativo (${sprint.name}): nada foi feito no Jira. ${ignored} tarefas de outras pessoas ou sem responsável ficaram de fora, como combinado. Code review ainda não entra (Bitbucket não conectado).`,
    sections,
    link: config.jira.boardUrl ? { title: "Abrir o board", url: config.jira.boardUrl } : undefined,
  });

  if (!process.argv.includes("--send")) return;
  const webhook = process.env.TEAMS_WEBHOOK_URL;
  if (!webhook) throw new Error("TEAMS_WEBHOOK_URL isn't set.");
  await postTeamsCard(webhook, card);
  await postTeamsCard(
    webhook,
    buildUrgentCard({
      title: "EXEMPLO · Board watcher pausado",
      text: `Exemplo de aviso urgente (nada aconteceu): ${config.maxApprovesPerDay} PRs aprovados hoje, que é o limite do dia. Nada mais é aprovado nem puxado até você retomar no Session Manager.`,
    }),
  );
  console.log("\nSent the digest and the urgent example to Teams.");
}

await main();
