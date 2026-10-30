import { getUserPreferences } from "../preferencesService.js";
import { loadBoardWatcherConfig, type BoardWatcherConfig } from "./config.js";
import { buildDigestCard, postTeamsCard } from "./teamsCards.js";
import { prSubject, type BoardIssue, type PullRequest, type ReviewFinding } from "./types.js";

/**
 * Teams messages sent right away instead of waiting for the digest: a finished test, a review
 * that wouldn't approve, a review or test that couldn't run, a pause. Best-effort: without
 * `TEAMS_WEBHOOK_URL`, or when Teams fails, it only logs (the digest still has it all).
 */

const SIMULATION_NOTE = "SIMULAÇÃO: nada foi postado nem movido.";
const MAX_REPORT_CHARS = 2500;

async function send(card: Record<string, unknown>): Promise<void> {
  const webhook = process.env.TEAMS_WEBHOOK_URL;
  if (!webhook) return;
  const config = await loadBoardWatcherConfig().catch(() => null);
  if (config?.notifications?.instant === false) return;
  await postTeamsCard(webhook, card).catch((err: unknown) =>
    console.warn("[board-watcher] Couldn't send the notice:", err),
  );
}

export function issueUrl(config: BoardWatcherConfig, key: string): string | null {
  return config.jira ? `https://${config.jira.site}/browse/${key}` : null;
}

export function prUrl(config: BoardWatcherConfig, pr: PullRequest): string | null {
  const workspace = config.bitbucket?.workspace;
  return workspace ? `https://bitbucket.org/${workspace}/${pr.repo}/pull-requests/${pr.id}` : null;
}

function openLink(title: string, url: string | null): { title: string; url: string } | undefined {
  return url ? { title, url } : undefined;
}

export async function noticeTestDone(
  config: BoardWatcherConfig,
  issue: BoardIssue,
  verdict: string,
  next: string,
  report: string,
  evidence: { count: number; dir: string },
): Promise<void> {
  const shown = report.length > MAX_REPORT_CHARS ? `${report.slice(0, MAX_REPORT_CHARS)}…` : report;
  await send(
    buildDigestCard({
      title: `Teste ${issue.key}: ${verdict}`,
      subtitle: `${issue.summary}. Depois ${next}. ${SIMULATION_NOTE}`,
      sections: [
        { heading: "Relatório que postaria", items: [shown] },
        { heading: "Evidências", items: [`${evidence.count} prints em ${evidence.dir}`] },
      ],
      link: openLink("Abrir a tarefa", issueUrl(config, issue.key)),
    }),
  );
}

export async function noticeReviewBlocked(
  config: BoardWatcherConfig,
  pr: PullRequest,
  summary: string,
  findings: ReviewFinding[],
): Promise<void> {
  const posted = findings
    .filter((f) => f.severity !== "minor" && f.topic !== "product")
    .slice(0, config.maxCommentsPerPr)
    .map((f) => {
      const where = f.file ? `${f.file.split("/").at(-1)}${f.line ? `:${f.line}` : ""} — ` : "";
      return `[${f.severity === "blocking" ? "bloqueia" : "médio"}] ${where}${f.body}`;
    });
  await send(
    buildDigestCard({
      title: `Review ${prSubject(pr)}: não aprovaria`,
      subtitle: `${pr.title}. ${SIMULATION_NOTE}`,
      sections: [
        { heading: "Resumo do review", items: [summary] },
        { heading: "Comentaria", items: posted },
      ],
      link: openLink("Abrir o PR", prUrl(config, pr)),
    }),
  );
}

export async function noticeJobFailed(
  kind: "review" | "test",
  subject: string,
  title: string,
  message: string,
  url: string | null,
): Promise<void> {
  await send(
    buildDigestCard({
      title: `${kind === "review" ? "Review" : "Teste"} de ${subject} não rodou`,
      subtitle: title,
      sections: [{ heading: "Motivo", items: [message] }],
      link: openLink(kind === "review" ? "Abrir o PR" : "Abrir a tarefa", url),
    }),
  );
}

export async function noticePause(title: string, text: string): Promise<void> {
  await send(
    buildDigestCard({
      title: `Board watcher pausaria: ${title}`,
      subtitle: SIMULATION_NOTE,
      sections: [{ heading: "Motivo", items: [text] }],
    }),
  );
}

const APP_URL = "http://localhost:58230";

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
  const phoneStep = remoteUrl
    ? `No celular: toque em "Abrir no Claude (celular)" para ir direto à sessão e responder (OK do push, decisão ou aprovação).`
    : `No celular: abra o app Claude, toque em Code e entre na sessão "${label}" (bolinha verde) para responder (OK do push, decisão ou aprovação).`;
  await send(
    buildDigestCard({
      title: `${label} está esperando você`,
      subtitle: key && name ? name : undefined,
      sections: [
        {
          heading: "O que fazer",
          items: remote
            ? [phoneStep, "No PC: abra a sessão pelo Session Manager."]
            : ["Abrir a sessão no Session Manager e responder (OK do push, decisão ou aprovação)."],
        },
      ],
      link: remote
        ? { title: "Abrir no Claude (celular)", url: remoteUrl ?? "https://claude.ai/code" }
        : appLink,
      extraLinks: remote ? [appLink] : [],
    }),
  );
}

/** A queued task couldn't be launched (red in the app's task list). */
export async function noticeQueueError(key: string, error: string): Promise<void> {
  await send(
    buildDigestCard({
      title: `${key} não conseguiu começar`,
      subtitle: "Erro ao lançar a tarefa da fila.",
      sections: [{ heading: "Motivo", items: [error] }],
      link: { title: "Abrir no Session Manager", url: `${APP_URL}/?q=${encodeURIComponent(key)}` },
    }),
  );
}
