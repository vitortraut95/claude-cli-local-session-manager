import { getUserPreferences } from "../preferencesService.js";
import { loadBoardWatcherConfig, type BoardWatcherConfig } from "./config.js";
import { buildNoticeCard, buildNoticesCard, postTeamsCard, type Notice } from "./teamsCards.js";
import type { PullRequestNews } from "./bitbucket.js";
import type { BuildDiagnosis, RebuildOutcome } from "./buildDiagnosis.js";
import { prSubject, type BoardIssue, type PullRequest, type ReviewFinding } from "./types.js";

/**
 * Teams messages sent as things happen instead of waiting for the digest: 🔴 the user is needed
 * (a session waits for them, something failed, a pause) and 🟡 good to know (a test finished, a
 * review wouldn't approve). Each is a short card with the long part behind "Ver detalhes"; notices
 * close together go out as one card (🔴 within 30 s, 🟡 within 3 min). Best-effort: without
 * `TEAMS_WEBHOOK_URL`, or when Teams fails, it only logs (the digest still has it all).
 */

const SIMULATION = "(simulação: nada foi postado nem movido)";
const MAX_REPORT_CHARS = 2500;
const MAX_SUMMARY_CHARS = 160;
const APP_URL = "http://localhost:58230";
const BATCH_MS: Record<"urgent" | "info", number> = { urgent: 30_000, info: 3 * 60_000 };

let pending: Notice[] = [];
let flushTimer: NodeJS.Timeout | null = null;
let flushAt = 0;

function short(text: string, max = MAX_SUMMARY_CHARS): string {
  const line =
    text
      .split("\n")
      .find((l) => l.trim())
      ?.trim() ?? "";
  return line.length > max ? `${line.slice(0, max)}…` : line;
}

async function flush(): Promise<void> {
  flushTimer = null;
  const notices = pending;
  pending = [];
  const webhook = process.env.TEAMS_WEBHOOK_URL;
  if (!webhook || notices.length === 0) return;
  const config = await loadBoardWatcherConfig().catch(() => null);
  if (config?.notifications?.instant === false) return;
  const card = notices.length === 1 ? buildNoticeCard(notices[0]!) : buildNoticesCard(notices);
  await postTeamsCard(webhook, card).catch((err: unknown) =>
    console.warn("[board-watcher] Couldn't send the notice:", err),
  );
}

/** Queues a notice; the batch goes out when the earliest deadline of what's in it arrives. */
function enqueue(notice: Notice): void {
  pending.push(notice);
  const due = Date.now() + BATCH_MS[notice.level === "urgent" ? "urgent" : "info"];
  if (flushTimer && due >= flushAt) return;
  if (flushTimer) clearTimeout(flushTimer);
  flushAt = due;
  flushTimer = setTimeout(() => void flush(), due - Date.now());
}

/** Sends what's queued now (a one-off script would exit before the batch window). */
export function flushNotices(): Promise<void> {
  if (flushTimer) clearTimeout(flushTimer);
  return flush();
}

export function issueUrl(config: BoardWatcherConfig, key: string): string | null {
  return config.jira ? `https://${config.jira.site}/browse/${key}` : null;
}

export function prUrl(config: BoardWatcherConfig, pr: PullRequest): string | null {
  const workspace = config.bitbucket?.workspace;
  return workspace ? `https://bitbucket.org/${workspace}/${pr.repo}/pull-requests/${pr.id}` : null;
}

function link(title: string, url: string | null): { title: string; url: string }[] {
  return url ? [{ title, url }] : [];
}

export function noticeTestDone(
  config: BoardWatcherConfig,
  issue: BoardIssue,
  verdict: string,
  next: string,
  report: string,
  evidence: { count: number; dir: string },
): void {
  const shown = report.length > MAX_REPORT_CHARS ? `${report.slice(0, MAX_REPORT_CHARS)}…` : report;
  enqueue({
    level: "info",
    title: `${issue.key} · teste: ${verdict}`,
    summary: `${short(issue.summary, 80)}. Depois ${next} ${SIMULATION}.`,
    details: [
      { heading: "Relatório que postaria", items: [shown] },
      { heading: "Evidências", items: [`${evidence.count} prints em ${evidence.dir}`] },
    ],
    links: link("Abrir a tarefa", issueUrl(config, issue.key)),
  });
}

export function noticeReviewBlocked(
  config: BoardWatcherConfig,
  pr: PullRequest,
  summary: string,
  findings: ReviewFinding[],
): void {
  const posted = findings
    .filter((f) => f.severity !== "minor" && f.topic !== "product")
    .slice(0, config.maxCommentsPerPr)
    .map((f) => {
      const where = f.file ? `${f.file.split("/").at(-1)}${f.line ? `:${f.line}` : ""} — ` : "";
      return `[${f.severity === "blocking" ? "bloqueia" : "médio"}] ${where}${f.body}`;
    });
  // An approval of an earlier commit stays on the PR: it's up to the user to take it back.
  const staleApproval = pr.approvedCommit
    ? " Problema no push feito depois do seu aprove, que continua no PR: veja se tira o aprove."
    : "";
  enqueue({
    level: pr.approvedCommit ? "urgent" : "info",
    title: `${prSubject(pr)} · review: ${config.live?.approve ? "não aprovou" : "não aprovaria"}`,
    summary: config.live?.comments
      ? `${short(pr.title, 80)}. Comentou no PR; o aprove fica com você.${staleApproval}`
      : `${short(pr.title, 80)} ${SIMULATION}.${staleApproval}`,
    details: [
      { heading: "Resumo do review", items: [summary] },
      { heading: config.live?.comments ? "Comentou" : "Comentaria", items: posted },
    ],
    links: link("Abrir o PR", prUrl(config, pr)),
  });
}

export function noticeJobFailed(
  kind: "review" | "test",
  subject: string,
  title: string,
  message: string,
  url: string | null,
): void {
  enqueue({
    level: "urgent",
    title: `${subject} · ${kind === "review" ? "review" : "teste"} não rodou`,
    summary: short(message),
    details: [{ heading: title, items: [message] }],
    links: link(kind === "review" ? "Abrir o PR" : "Abrir a tarefa", url),
  });
}

/** The watcher paused itself (a limit tripped): nothing runs until resumed in the Board panel. */
export function noticePause(title: string, text: string): void {
  enqueue({
    level: "urgent",
    title: `Board watcher · pausou: ${title}`,
    summary: `${short(text)}. Retome no painel Board do Session Manager.`,
  });
}

/** Something done for real (a comment, an approval, a card moved, a task queued), so the user
 *  sees every visible action as it happens. */
export function noticeLiveAction(
  title: string,
  text: string,
  url: string | null,
  level: "urgent" | "info" = "info",
): void {
  enqueue({
    level,
    title,
    summary: short(text),
    links: link(url?.includes("/pull-requests/") ? "Abrir o PR" : "Abrir a tarefa", url),
  });
}

/** The look at the board failed (token, VPN, network). */
export function noticeWatcherError(message: string): void {
  enqueue({
    level: "urgent",
    title: "Board watcher · não conseguiu olhar o board",
    summary: short(message),
    details: [
      {
        heading: "O que fazer",
        items: [
          "Ele tenta de novo sozinho. Se for token vencido, VPN fora ou login do Claude, precisa de você.",
        ],
      },
    ],
  });
}

/** One of the user's To Do tickets has too weak a description for the dev queue: what's missing
 *  and, when they could be drafted, the questions to forward to whoever decides. */
export function noticeWeakDescription(
  config: BoardWatcherConfig,
  issue: BoardIssue,
  missing: string,
  messages: { to: string; text: string }[],
): void {
  enqueue({
    level: "info",
    title: `${issue.key} · descrição fraca, não entrou na fila`,
    summary: messages.length
      ? `Falta: ${short(missing, 100)}. Perguntas prontas para encaminhar em "Ver detalhes".`
      : `Falta: ${short(missing, 120)}.`,
    details: messages.map((m) => ({ heading: `Para ${m.to}`, items: [m.text] })),
    links: link("Abrir a tarefa", issueUrl(config, issue.key)),
  });
}

/** Someone commented on, or asked for changes in, one of the user's PRs. */
export function noticeNewsOnMyPr(
  config: BoardWatcherConfig,
  pr: PullRequest,
  news: PullRequestNews,
): void {
  const authors = [...new Set(news.comments.map((c) => c.author))];
  const what = [
    news.changesRequested.length && `${news.changesRequested.join(", ")} pediu mudanças`,
    news.comments.length && `${news.comments.length} comentário(s) de ${authors.join(", ")}`,
  ].filter(Boolean);
  enqueue({
    level: news.changesRequested.length ? "urgent" : "info",
    title: `${prSubject(pr)} · seu PR: ${what.join(" e ")}`,
    summary: short(pr.title, 100),
    details: [
      {
        heading: "Comentários",
        items: news.comments.map((c) => {
          const where = c.file ? `${c.file.split("/").at(-1)}${c.line ? `:${c.line}` : ""} — ` : "";
          return `${c.author}: ${where}${short(c.body, 300)}`;
        }),
      },
    ],
    links: link("Abrir o PR", prUrl(config, pr)),
  });
}

const REBUILD_SUMMARY: Record<RebuildOutcome, string> = {
  done: "Rodei o build de novo; se falhar de novo, te aviso.",
  would: 'Rodaria o build de novo (a chave "Rodar build de novo" está desligada).',
  again: "Já rodei de novo uma vez neste commit e falhou de novo: precisa de alguém.",
  refused: "Tentei rodar o build de novo, mas o Jenkins recusou.",
};

/** A preview build of a ticket the user cares about (theirs, or a test it claimed) failed, with
 *  why when the log could be read and whether it was run again. */
export function noticePreviewFailed(
  config: BoardWatcherConfig,
  issue: BoardIssue,
  repo: string,
  branch: string,
  buildUrl: string | null,
  diagnosis: BuildDiagnosis | null,
  rebuild: RebuildOutcome | null = null,
): void {
  const kind =
    diagnosis?.kind === "infra" ? " (infra)" : diagnosis?.kind === "code" ? " (código)" : "";
  const what = diagnosis
    ? `${repo} ${branch}, em ${diagnosis.stage}: ${short(diagnosis.cause, 160)}`
    : `${short(issue.summary, 80)}. O build de ${repo} ${branch} falhou.`;
  enqueue({
    level: rebuild === "done" ? "info" : "urgent",
    title: `${issue.key} · build do preview falhou${kind}`,
    summary: rebuild ? `${what} ${REBUILD_SUMMARY[rebuild]}` : what,
    details: diagnosis
      ? [
          { heading: "Causa provável", items: [diagnosis.cause] },
          { heading: "O que fazer", items: [diagnosis.fix] },
        ]
      : [],
    links: [
      ...link("Abrir no Jenkins", buildUrl),
      ...link("Abrir a tarefa", issueUrl(config, issue.key)),
    ],
  });
}

/** How a "point to homolog" build ended: deployed (with the homolog pages) or failed (with why). */
export function noticeHomologDone(
  repo: string,
  branch: string,
  buildUrl: string,
  result: string,
  urls: string[],
  diagnosis: BuildDiagnosis | null,
): void {
  const ok = result === "SUCCESS";
  enqueue({
    level: ok ? "info" : "urgent",
    title: `Homolog · ${repo} ${ok ? "atualizado com" : "não subiu"} ${branch}`,
    summary: ok
      ? "O build terminou: homolog está com essa branch."
      : diagnosis
        ? `O build terminou com ${result}, em ${diagnosis.stage}: ${short(diagnosis.cause, 160)}`
        : `O build terminou com ${result}.`,
    highlights: ok && urls.length ? { heading: "Homolog", items: urls } : undefined,
    details: !ok && diagnosis ? [{ heading: "O que fazer", items: [diagnosis.fix] }] : [],
    links: link("Abrir no Jenkins", buildUrl),
  });
}

/** One infra problem behind several failed builds: told once, with a message for DevOps. */
export function noticeInfraIncident(
  incident: NonNullable<BuildDiagnosis["incident"]>,
  builds: { subject: string; url: string }[],
): void {
  const list = builds.map((b) => b.subject).join(", ");
  const message = [
    `Oi! O agente ${incident.agent} do Jenkins está com ${incident.problem}: ${builds.length} builds falharam no mesmo ponto (${list}).`,
    `Erro: ${incident.evidence}`,
    `Exemplo: ${builds[0]?.url ?? ""}`,
    "Conseguem dar uma olhada?",
  ].join("\n");
  enqueue({
    level: "urgent",
    title: `Infra · ${incident.agent}: ${incident.problem}`,
    summary: `${builds.length} builds falharam pelo mesmo motivo (${short(list, 120)}). Não é código: rodar de novo deve passar quando a infra voltar.`,
    details: [
      { heading: "Builds", items: builds.map((b) => `${b.subject}: ${b.url}`) },
      { heading: "Mensagem pronta pro DevOps", items: [message] },
    ],
  });
}

/** Tests are waiting because the network isn't as they need it (VPN, IPv6). */
export function noticeTestsNeedNetwork(problem: string): void {
  const vpn = problem.includes("VPN");
  const ipv6 = problem.includes("IPv6");
  enqueue({
    level: "urgent",
    title: `Testes esperando: ${[vpn && "VPN desconectada", ipv6 && "IPv6 ligado"].filter(Boolean).join(" e ")}`,
    summary: "Os testes da fila só começam com a rede pronta; o resto continua rodando.",
    details: [
      {
        heading: "O que fazer",
        items: [
          ...(vpn ? ["Conecte a VPN (GlobalProtect)."] : []),
          ...(ipv6 || vpn
            ? [
                "Desative o IPv6 (reconectar a VPN reativa ele): `sudo sysctl -w net.ipv6.conf.all.disable_ipv6=1` e `sudo sysctl -w net.ipv6.conf.default.disable_ipv6=1`",
              ]
            : []),
          "Na próxima olhada (até 10 min) os testes começam sozinhos.",
        ],
      },
    ],
  });
}

/** One of the user's sessions stopped to wait for them (an OK to push, a decision, a test plan
 *  to approve). */
export async function noticeWaitingForYou(
  key: string | null,
  name: string,
  /** The session's Remote Control link, when it has one: opens it right in the Claude app. */
  remoteUrl: string | null = null,
): Promise<void> {
  const label = key ?? name;
  const appLink = {
    title: "Abrir no Session Manager (PC)",
    url: `${APP_URL}/?q=${encodeURIComponent(label)}`,
  };
  // With Remote Control on, the session can be answered from the phone: point there first.
  const remote = remoteUrl !== null || (await getUserPreferences()).remoteControl;
  enqueue({
    level: "urgent",
    title: `${label} · esperando você`,
    summary: remote
      ? `Responda pelo celular em "Abrir no Claude"${key && name ? ` (sessão ${name})` : ""}.`
      : "Abra a sessão no Session Manager para responder.",
    links: remote
      ? [
          { title: "Abrir no Claude (celular)", url: remoteUrl ?? "https://claude.ai/code" },
          appLink,
        ]
      : [appLink],
  });
}

/** A queued task couldn't be launched (red in the app's task list). */
export function noticeQueueError(key: string, error: string): void {
  enqueue({
    level: "urgent",
    title: `${key} · não conseguiu começar`,
    summary: short(error),
    details: [{ heading: "Erro ao lançar a tarefa da fila", items: [error] }],
    links: [{ title: "Abrir no Session Manager", url: `${APP_URL}/?q=${encodeURIComponent(key)}` }],
  });
}
