import { getUserPreferences } from "../preferencesService.js";
import { loadBoardWatcherConfig, type BoardWatcherConfig } from "./config.js";
import { buildNoticeCard, buildNoticesCard, postTeamsCard, type Notice } from "./teamsCards.js";
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
  enqueue({
    level: "info",
    title: `${prSubject(pr)} · review: não aprovaria`,
    summary: `${short(pr.title, 80)} ${SIMULATION}.`,
    details: [
      { heading: "Resumo do review", items: [summary] },
      { heading: "Comentaria", items: posted },
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

export function noticePause(title: string, text: string): void {
  enqueue({
    level: "urgent",
    title: `Board watcher · pausaria: ${title}`,
    summary: `${short(text)} ${SIMULATION}.`,
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
