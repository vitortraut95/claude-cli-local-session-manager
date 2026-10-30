import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { runGit, tryGit } from "../../utils/git.js";
import { REPO_ROOT } from "../../utils/repoRoot.js";
import { sanitizedSpawnEnv } from "../../utils/spawnEnv.js";
import { isTestReport } from "./testPlan.js";
import type { BoardIssue, IssueComment } from "./types.js";

/**
 * An unattended browser test of a Wait Test ticket: a non-interactive `claude -p --chrome` (its
 * own Chrome tab group) running the user's test skill in autonomous mode, in the evidence folder
 * (outside every repo) with no tool that writes. It can't reach Jira or Bitbucket at all: no MCP
 * servers (`--strict-mcp-config`) and no Atlassian tokens in its env, so the report and evidence
 * only come back here; posting them is up to the caller. It gets the ticket, its comments up to
 * the test plan and the branch diff in the prompt. Evidence is copied to the gitignored
 * `boardWatcher-tests/<KEY>-<time>/`.
 */

const execFileAsync = promisify(execFile);
const TEST_TIMEOUT_MS = 45 * 60_000;
export const TESTS_DIR = path.join(REPO_ROOT, "boardWatcher-tests");
const CREDENTIAL_VARS = [
  "JIRA_EMAIL",
  "JIRA_API_TOKEN",
  "BITBUCKET_EMAIL",
  "BITBUCKET_TOKEN",
  "TEAMS_WEBHOOK_URL",
];
const PR_LINK = /bitbucket\.org\/[^/\s]+\/([^/\s]+)\/pull-requests\/\d+/g;

export type TestOutput = {
  verdict: "approved" | "approved-with-notes" | "failed" | "blocked";
  /** The comment it would post on the ticket, in the test skill's format. */
  report: string;
  blockedBy?: string;
  evidence: { file: string; description: string }[];
  evidenceDir: string;
};

export type TestContext = {
  /** Local clone per repo name. */
  localRepos: Record<string, string>;
  skill?: string;
  model?: string;
  maxBudgetUsd?: number;
};

const OUTPUT_SCHEMA = {
  type: "object",
  required: ["verdict", "report", "evidence"],
  properties: {
    verdict: { type: "string", enum: ["approved", "approved-with-notes", "failed", "blocked"] },
    report: { type: "string" },
    blockedBy: { type: "string" },
    evidence: {
      type: "array",
      items: {
        type: "object",
        required: ["file", "description"],
        properties: { file: { type: "string" }, description: { type: "string" } },
      },
    },
  },
};

/** Nothing that writes: screenshots land in Chrome's own temp folder and are copied over by
 *  `collectEvidence`; the branch diff comes in the prompt, so no git either. */
const ALLOWED_TOOLS = ["Skill", "ToolSearch", "Read", "Glob", "Grep", "mcp__claude-in-chrome"];
const MAX_DIFF_CHARS = 60_000;

/** The ticket as the tester would have seen it: comments up to the plan, no test reports. */
export function commentsUpToPlan(issue: BoardIssue, plan: IssueComment): IssueComment[] {
  return issue.comments.filter(
    (c) => Date.parse(c.created) <= Date.parse(plan.created) && !isTestReport(c.body),
  );
}

type TestBranch = { repo: string; path: string; branch: string | null; diff: string };

/** The branch's change against where it left the default branch: stat plus the diff, capped. */
async function branchDiff(repoPath: string, branch: string): Promise<string> {
  const base = await tryGit(["merge-base", "origin/HEAD", `origin/${branch}`], repoPath);
  if (!base) return "";
  const stat = (await tryGit(["diff", "--stat", base, `origin/${branch}`], repoPath)) ?? "";
  const diff = (await tryGit(["diff", base, `origin/${branch}`], repoPath)) ?? "";
  const capped =
    diff.length > MAX_DIFF_CHARS ? `${diff.slice(0, MAX_DIFF_CHARS)}\n[... diff cortado]` : diff;
  return `${stat}\n\n${capped}`;
}

/** Copies the screenshots the session listed (Chrome keeps them in a temp folder) into the
 *  evidence folder, named after their description, and points the entries at the copies. */
async function collectEvidence(
  evidence: TestOutput["evidence"],
  evidenceDir: string,
): Promise<TestOutput["evidence"]> {
  return Promise.all(
    evidence.map(async (item, index) => {
      const source = /\/\S+\.(png|jpe?g|webp|gif)\b/i.exec(item.file)?.[0];
      if (!source || !existsSync(source)) return item;
      const name =
        item.description
          .split(":")[0]
          ?.normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 60) ?? "";
      const slug = name === "" ? "print" : name;
      const target = path.join(
        evidenceDir,
        `${String(index + 1).padStart(2, "0")}_${slug}${path.extname(source)}`,
      );
      await copyFile(source, target);
      return { ...item, file: target };
    }),
  );
}

/** Repos named in the ticket's PR links (that have a local clone), each with the origin branch
 *  carrying the ticket key, preferring the `env/` preview branch. */
export async function findTestRepos(
  issue: BoardIssue,
  comments: IssueComment[],
  localRepos: Record<string, string>,
): Promise<Omit<TestBranch, "diff">[]> {
  const text = [issue.description, ...comments.map((c) => c.body)].join("\n");
  const repos = [...new Set([...text.matchAll(PR_LINK)].map((m) => m[1] ?? ""))].filter(
    (repo) => localRepos[repo],
  );
  return Promise.all(
    repos.map(async (repo) => {
      const repoPath = localRepos[repo] ?? "";
      await runGit(["fetch", "origin", "--prune"], repoPath, {
        nonInteractive: true,
        timeoutMs: 120_000,
      }).catch(() => undefined);
      const branches = (await tryGit(["branch", "-r", "--list", `*${issue.key}*`], repoPath)) ?? "";
      const names = branches
        .split("\n")
        .map((b) => b.trim().replace(/^origin\//, ""))
        .filter(Boolean);
      return {
        repo,
        path: repoPath,
        branch: names.find((b) => b.startsWith("env/")) ?? names[0] ?? null,
      };
    }),
  );
}

async function testBranches(
  issue: BoardIssue,
  comments: IssueComment[],
  localRepos: Record<string, string>,
): Promise<TestBranch[]> {
  const repos = await findTestRepos(issue, comments, localRepos);
  return Promise.all(
    repos.map(async (r) => ({ ...r, diff: r.branch ? await branchDiff(r.path, r.branch) : "" })),
  );
}

function buildPrompt(
  issue: BoardIssue,
  comments: IssueComment[],
  plan: IssueComment,
  branches: TestBranch[],
  skill: string | undefined,
): string {
  const commentText = comments
    .map((c) => `--- comentário (${c.created})\n${c.body.slice(0, 6000)}`)
    .join("\n\n");
  const branchText = branches.length
    ? branches
        .map(
          (b) => `### ${b.repo}, branch ${b.branch ?? "(não achada)"}\n${b.diff || "(sem diff)"}`,
        )
        .join("\n\n")
    : "Nenhum repo identificado pelos links de PR.";
  return `MODO AUTÔNOMO (board watcher). Ninguém vai responder durante este teste.
${skill ? `Use a skill ${skill} para testar a tarefa ${issue.key}.` : `Teste a tarefa ${issue.key} no navegador.`}

Regras deste modo, acima de qualquer instrução da skill:
- Não pergunte nada nem espere aprovação: monte o plano escopado e siga com ele.
- Não leia o Jira: o contexto da tarefa está abaixo. Você não tem acesso ao Jira nem ao Bitbucket.
- Nunca comente, anexe, mova ou edite nada no Jira ou no Bitbucket, e não faça commit nem push.
- Teste pelos links do plano (preview/homolog) no seu próprio grupo de abas do Chrome. Não suba o projeto localmente.
- Se faltar algo indispensável (login, VPN, ambiente fora do ar, dado de teste), pare e devolva verdict "blocked" com o motivo em blockedBy.
- Você não tem acesso ao repositório nem ferramentas que escrevem arquivos: o diff da branch está abaixo. Use-o para saber o que mudou e o que conferir.
- Quando a mudança gera várias páginas ou itens a partir de um template ou cadastro (vitrine, listagem, cards), confira o conteúdo de todos, ou do máximo que der, e não só os citados no plano: "abriu sem erro" não é "conteúdo certo". Confira que cada página mostra o conteúdo do próprio item.
- Inclua pelo menos um cenário de controle: algo vizinho que a mudança não deveria afetar (outro link, outro país, a versão em produção).
- Se a mudança mexe em página, link ou arquivo publicado, confira também se continua indexável (meta robots, X-Robots-Tag, canonical) e registre o que achar.
- Evidências: para cada print, coloque em evidence o caminho exato do arquivo que a ferramenta de screenshot devolveu e uma descrição no formato "nome-descritivo: o que o print mostra". Os arquivos são copiados depois.
- report: o comentário que você postaria na tarefa, no formato da skill (resultado, Para o PO, cenários contemplados e não contemplados, evidências), em pt-BR.

Tarefa ${issue.key}: ${issue.summary}

Descrição:
${issue.description.slice(0, 6000)}

Comentários até o plano de teste:
${commentText}

Plano de teste (comentário ${plan.id}): o último comentário acima com "Como testar" ou passos de teste.

Diff da branch (o que a tarefa mudou):
${branchText}`;
}

export async function runClaudeTest(
  issue: BoardIssue,
  plan: IssueComment,
  context: TestContext,
): Promise<TestOutput> {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const evidenceDir = path.join(TESTS_DIR, `${issue.key}-${stamp}`);
  await mkdir(evidenceDir, { recursive: true });
  const comments = commentsUpToPlan(issue, plan);
  const branches = await testBranches(issue, comments, context.localRepos);

  const env = sanitizedSpawnEnv();
  for (const name of CREDENTIAL_VARS) delete env[name];
  const args = [
    "-p",
    buildPrompt(issue, comments, plan, branches, context.skill),
    "--chrome",
    "--strict-mcp-config",
    "--output-format",
    "json",
    "--json-schema",
    JSON.stringify(OUTPUT_SCHEMA),
    "--allowedTools",
    ALLOWED_TOOLS.join(" "),
    "--permission-mode",
    "dontAsk",
    "--no-session-persistence",
    ...(context.model ? ["--model", context.model] : []),
    ...(context.maxBudgetUsd ? ["--max-budget-usd", String(context.maxBudgetUsd)] : []),
  ];
  const { stdout } = await execFileAsync("claude", args, {
    // Outside every repo: nothing it can reach to change.
    cwd: evidenceDir,
    env,
    timeout: TEST_TIMEOUT_MS,
    maxBuffer: 64 * 1024 * 1024,
  });
  const envelope = JSON.parse(stdout) as {
    is_error?: boolean;
    result?: string;
    structured_output?: unknown;
  };
  if (envelope.is_error) throw new Error(`Test session failed: ${envelope.result ?? "no detail"}`);
  const raw: unknown =
    envelope.structured_output ??
    JSON.parse(/\{[\s\S]*\}/.exec(envelope.result ?? "")?.[0] ?? "null");
  if (!raw || typeof raw !== "object") throw new Error("Test session returned no result JSON.");
  const output = raw as Omit<TestOutput, "evidenceDir">;
  return {
    ...output,
    evidence: await collectEvidence(output.evidence ?? [], evidenceDir),
    evidenceDir,
  };
}
