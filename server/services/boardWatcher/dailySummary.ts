import { execFile } from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";
import { sanitizedSpawnEnv } from "../../utils/spawnEnv.js";
import {
  bitbucketCredentialsFromEnv,
  branchBuild,
  findPullRequestsForKey,
  listOpenPullRequests,
  pullRequestsTouchedBy,
} from "./bitbucket.js";
import { localDay, previousBusinessDay } from "./businessTime.js";
import type { BoardWatcherConfig } from "./config.js";
import { jiraCredentialsFromEnv, searchIssues, statusChangesBy, statusNames } from "./jira.js";
import { buildDigestCard } from "./teamsCards.js";

/**
 * The summary for the daily meeting: what the user did on the last business day (cards moved,
 * commits, PRs opened and approved), what's on their plate today and what's stuck waiting on
 * someone, plus a short first-person text to say or paste. Read from Jira, Bitbucket and the
 * local clones; nothing is written anywhere.
 */

const execFileAsync = promisify(execFile);
const TICKET_KEY = /\b[A-Z][A-Z0-9]+-\d+\b/;

export type DailyFacts = {
  /** The last business day with activity (or just the last one), "YYYY-MM-DD". */
  day: string;
  moved: { key: string; summary: string; at: string; from: string; to: string }[];
  /** How to call `day` in the text: "ontem", or "sexta 30/10" after a holiday or a day off. */
  dayLabel: string;
  /** Commit subjects per ticket (or per repo when the subject names none). */
  commits: { group: string; subjects: string[] }[];
  opened: string[];
  approved: string[];
  today: { key: string; summary: string; status: string }[];
  stuck: string[];
};

async function git(repo: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", repo, ...args], {
    maxBuffer: 8 * 1024 * 1024,
  });
  return stdout.trim();
}

type Commit = { at: string; group: string; subject: string };

/** The user's commits since `since` in the local clones (every branch), each once. */
async function commitsSince(config: BoardWatcherConfig, since: Date): Promise<Commit[]> {
  const seen = new Set<string>();
  const commits: Commit[] = [];
  for (const [repo, repoPath] of Object.entries(config.bitbucket?.localRepos ?? {})) {
    const email = await git(repoPath, ["config", "user.email"]).catch(() => "");
    if (!email) continue;
    const log = await git(repoPath, [
      "log",
      "--all",
      `--since=${since.toISOString()}`,
      `--author=${email}`,
      "--format=%H%x09%aI%x09%s",
    ]).catch(() => "");
    for (const line of log.split("\n").filter(Boolean)) {
      const [hash = "", at = "", subject = ""] = line.split("\t");
      if (seen.has(hash)) continue;
      seen.add(hash);
      commits.push({ at, group: TICKET_KEY.exec(subject)?.[0] ?? repo, subject });
    }
  }
  return commits.sort((a, b) => a.at.localeCompare(b.at));
}

function groupCommits(commits: Commit[]): DailyFacts["commits"] {
  const groups = new Map<string, string[]>();
  for (const c of commits) groups.set(c.group, [...(groups.get(c.group) ?? []), c.subject]);
  return [...groups].map(([group, subjects]) => ({ group, subjects }));
}

/** Business days back from yesterday that the summary may go to: a holiday or a day off has no
 *  activity, so the summary covers the last day that has some. */
const MAX_DAYS_BACK = 5;

export async function gatherDailyFacts(config: BoardWatcherConfig, now: Date): Promise<DailyFacts> {
  if (!config.jira || !config.bitbucket) throw new Error("The daily needs jira and bitbucket.");
  const { businessHours } = config;
  const since = new Date(now.getTime() - 10 * 24 * 60 * 60_000);
  const dayOf = (at: string) => localDay(new Date(at), businessHours);
  const jira = jiraCredentialsFromEnv(config.jira.site);
  const bitbucket = bitbucketCredentialsFromEnv(config.bitbucket.workspace);

  const [changes, commits, touched, mine, names, myPrs] = await Promise.all([
    statusChangesBy(jira, "status CHANGED BY currentUser() AFTER -10d", config.me),
    commitsSince(config, since),
    pullRequestsTouchedBy(bitbucket, config.bitbucket.repos, config.me, since.toISOString()),
    searchIssues(
      jira,
      `(${config.jira.scopeJql}) AND sprint in openSprints() AND assignee = currentUser() AND statusCategory != Done`,
      50,
    ),
    statusNames(jira),
    listOpenPullRequests(bitbucket, config.bitbucket.repos).then((prs) =>
      prs.filter((pr) => pr.authorId === config.me),
    ),
  ]);

  const today = localDay(now, businessHours);
  const active = new Set([
    ...changes.map((c) => dayOf(c.at)),
    ...commits.map((c) => dayOf(c.at)),
    ...touched.opened.map((pr) => dayOf(pr.at)),
    ...touched.approved.map((pr) => dayOf(pr.at)),
  ]);
  let day = previousBusinessDay(now, businessHours);
  for (let candidate = day, back = 0; back < MAX_DAYS_BACK; back += 1) {
    if (active.has(candidate)) {
      day = candidate;
      break;
    }
    candidate = previousBusinessDay(new Date(`${candidate}T12:00:00Z`), businessHours);
  }
  const onDay = (at: string) => dayOf(at) === day && day !== today;

  const stuck: string[] = [];
  for (const pr of myPrs) {
    if (pr.reviewers.some((r) => r.state === "changes_requested")) {
      stuck.push(`${pr.repo}#${pr.id} · pediram mudanças no seu PR`);
    }
  }
  for (const issue of mine) {
    if (config.columns.codeReview?.includes(issue.statusId) && dayOf(issue.statusSince) < day) {
      const [, month, date] = dayOf(issue.statusSince).split("-");
      stuck.push(`${issue.key} · em Code Review desde ${date}/${month}, sem aprovação`);
    }
    if (config.columns.todo.includes(issue.statusId)) continue;
    const previews = (
      await findPullRequestsForKey(bitbucket, config.bitbucket.repos, issue.key).catch(() => [])
    ).filter((pr) => pr.branch.startsWith("env/"));
    for (const { repo, branch } of previews) {
      const build = await branchBuild(bitbucket, repo, branch).catch(() => null);
      if (build?.ci === "failed") {
        stuck.push(`${issue.key} · build do preview falhando (${repo} ${branch})`);
      }
    }
  }

  const todo = new Set(config.columns.todo);
  const current = mine.filter((i) => !todo.has(i.statusId));
  return {
    day,
    dayLabel: dayLabel(day, now, businessHours),
    moved: changes.filter((c) => onDay(c.at)),
    commits: groupCommits(commits.filter((c) => onDay(c.at))),
    opened: touched.opened
      .filter((pr) => onDay(pr.at))
      .map((pr) => `${pr.repo}#${pr.id} ${pr.title}`),
    approved: touched.approved
      .filter((pr) => onDay(pr.at))
      .map((pr) => `${pr.repo}#${pr.id} ${pr.title}`),
    // What's under way; with nothing started, the next To Do to pick up.
    today: (current.length ? current : mine.slice(0, 1)).map((i) => ({
      key: i.key,
      summary: i.summary,
      status: names.get(i.statusId) ?? i.statusId,
    })),
    stuck,
  };
}

const WEEKDAYS_PT = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** "ontem" for yesterday, else the weekday and date ("sexta 30/10"). */
export function dayLabel(day: string, now: Date, hours: BoardWatcherConfig["businessHours"]): string {
  const yesterday = localDay(new Date(now.getTime() - 24 * 60 * 60_000), hours);
  if (day === yesterday) return "ontem";
  const [, month, date] = day.split("-");
  const weekday = WEEKDAYS_PT[new Date(`${day}T12:00:00Z`).getUTCDay()];
  return `${weekday} ${date}/${month}`;
}

/** The bullet lines of each section, in pt-BR; a card's moves of the day become one line from
 *  where it started to where it ended. */
export function sections(facts: DailyFacts): { yesterday: string[]; today: string[]; stuck: string[] } {
  const short = (text: string, max = 90) =>
    text.length > max ? `${text.slice(0, max - 1)}…` : text;
  const moves = new Map<string, { summary: string; from: string; to: string }>();
  for (const m of [...facts.moved].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
    const seen = moves.get(m.key);
    moves.set(m.key, seen ? { ...seen, to: m.to } : { summary: m.summary, from: m.from, to: m.to });
  }
  return {
    yesterday: [
      ...[...moves].map(([key, m]) => `${key} · ${m.from} → ${m.to}: ${short(m.summary)}`),
      ...facts.commits.map(
        (c) => `${c.group} · ${c.subjects.length} commit(s): ${short(c.subjects.at(-1) ?? "")}`,
      ),
      ...facts.opened.map((pr) => `Abriu o PR ${short(pr)}`),
      ...facts.approved.map((pr) => `Aprovou o PR ${short(pr)}`),
    ],
    today: facts.today.map((i) => `${i.key} · ${i.status}: ${short(i.summary)}`),
    stuck: facts.stuck,
  };
}

/** A few first-person lines to say in the meeting; a plain template when the session fails. */
export async function draftDailyText(facts: DailyFacts, model = "sonnet"): Promise<string> {
  const parts = sections(facts);
  const when = facts.dayLabel === "ontem" ? "Ontem" : `Na ${facts.dayLabel}`;
  const fallback = [
    parts.yesterday.length ? `${when}: ${parts.yesterday.join("; ")}.` : `${when}: sem registros.`,
    parts.today.length ? `Hoje: ${parts.today.join("; ")}.` : "",
    parts.stuck.length ? `Bloqueios: ${parts.stuck.join("; ")}.` : "Sem bloqueios.",
  ]
    .filter(Boolean)
    .join("\n");
  const prompt = `Escreva o que um dev vai falar na daily, em primeira pessoa, português do Brasil, a partir destes fatos (JSON). No máximo 4 linhas curtas: "${when}: …" (o que foi feito ${facts.dayLabel === "ontem" ? "ontem" : `na ${facts.dayLabel}, o último dia trabalhado`}), "Hoje: …" e, só se houver, "Bloqueio: …". Cite as tarefas pela chave (LED-123) e diga em palavras simples o que foi feito, sem listar commits um a um nem nomes de arquivo. Não invente nada que não esteja nos fatos. Responda só com o texto.

${JSON.stringify(parts)}`;
  try {
    const { stdout } = await execFileAsync(
      "claude",
      [
        "-p",
        prompt,
        "--output-format",
        "json",
        "--model",
        model,
        "--tools",
        "",
        "--permission-mode",
        "dontAsk",
        "--strict-mcp-config",
        "--no-session-persistence",
        "--max-budget-usd",
        "0.3",
      ],
      {
        cwd: os.tmpdir(),
        env: sanitizedSpawnEnv(),
        timeout: 2 * 60_000,
        maxBuffer: 4 * 1024 * 1024,
      },
    );
    const envelope = JSON.parse(stdout) as { is_error?: boolean; result?: string };
    return !envelope.is_error && envelope.result?.trim() ? envelope.result.trim() : fallback;
  } catch {
    return fallback;
  }
}

export function buildDailyCard(facts: DailyFacts, text: string): Record<string, unknown> {
  const parts = sections(facts);
  const card = buildDigestCard({
    title: "Daily",
    subtitle:
      facts.dayLabel === "ontem" ? undefined : `Último dia com atividade: ${facts.dayLabel}`,
    sections: [
      {
        heading: facts.dayLabel === "ontem" ? "Ontem" : `Na ${facts.dayLabel}`,
        items: parts.yesterday.length ? parts.yesterday : ["Nada registrado."],
      },
      { heading: "Hoje", items: parts.today },
      { heading: "Travado / esperando alguém", items: parts.stuck },
    ],
  });
  (card.body as Record<string, unknown>[]).push({
    type: "Container",
    separator: true,
    spacing: "Medium",
    items: [
      { type: "TextBlock", text: "Pronto pra falar ou colar", weight: "Bolder", wrap: true },
      { type: "TextBlock", text, wrap: true, spacing: "Small" },
    ],
  });
  return card;
}
