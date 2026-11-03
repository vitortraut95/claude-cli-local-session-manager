import { execFile } from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";
import { sanitizedSpawnEnv } from "../../utils/spawnEnv.js";
import { apiFetch } from "./http.js";

/**
 * Why a preview build failed: the Jenkins log of the build (read with the user's API token,
 * `JENKINS_USER`/`JENKINS_TOKEN`) narrowed to where it broke, read by a short `claude -p` (no
 * tools, a quick model) that tells an infra hiccup (run it again) from a code error (where, why
 * and how to fix). Without the token there's no diagnosis, only the failure.
 */

const execFileAsync = promisify(execFile);
const LOG_CONTEXT_LINES = 60;
const MAX_LOG_CHARS = 15_000;

export type BuildDiagnosis = {
  kind: "infra" | "code" | "unknown";
  stage: string;
  cause: string;
  fix: string;
};

const OUTPUT_SCHEMA = {
  type: "object",
  required: ["kind", "stage", "cause", "fix"],
  properties: {
    kind: { type: "string", enum: ["infra", "code", "unknown"] },
    stage: { type: "string" },
    cause: { type: "string" },
    fix: { type: "string" },
  },
};

/** The build's page from the link Jenkins posts on the commit (`…/5/display/redirect`). */
export function buildPageUrl(statusUrl: string): string {
  return statusUrl.replace(/display\/redirect\/?$/, "");
}

/** The lines around the first failure and the end of the log, where a build says why it broke. */
export function logExcerpt(log: string): string {
  const lines = log.split("\n");
  const first = lines.findIndex((l) =>
    /exit code [1-9]|ERROR|Error:|FAILED|Failed in branch|npm ERR!|error TS\d+/.test(l),
  );
  const around =
    first >= 0
      ? lines.slice(Math.max(0, first - LOG_CONTEXT_LINES), first + LOG_CONTEXT_LINES)
      : [];
  const tail = lines.slice(-40);
  return [...around, "[…]", ...tail].join("\n").slice(-MAX_LOG_CHARS);
}

async function fetchLog(statusUrl: string): Promise<string | null> {
  const user = process.env.JENKINS_USER;
  const token = process.env.JENKINS_TOKEN;
  if (!user || !token) return null;
  const response = await apiFetch("jenkins", `${buildPageUrl(statusUrl)}consoleText`, {
    headers: { Authorization: `Basic ${Buffer.from(`${user}:${token}`).toString("base64")}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Jenkins answered ${response.status}.`);
  return response.text();
}

/** Null without the Jenkins token or when the log can't be read or understood. */
export async function diagnoseBuild(
  statusUrl: string,
  model = "sonnet",
): Promise<BuildDiagnosis | null> {
  const log = await fetchLog(statusUrl);
  if (!log) return null;
  const prompt = `O build de preview de um front-end (Jenkins) falhou. Leia o trecho do log e diga, em português do Brasil e em uma ou duas frases cada:
- kind: "infra" quando não é culpa do código (agente fora, timeout de rede/registry, cache, build abortado por outro build, falta de espaço), "code" quando é o código (teste, lint, tipo, build, dependência declarada errada), "unknown" se não der pra saber.
- stage: o estágio que quebrou.
- cause: a causa provável, citando arquivo e linha quando aparecem.
- fix: o que fazer (infra: normalmente rodar o build de novo; código: a correção sugerida).
Não invente o que não está no log.

Log:
${logExcerpt(log)}`;
  try {
    const { stdout } = await execFileAsync(
      "claude",
      [
        "-p",
        prompt,
        "--output-format",
        "json",
        "--json-schema",
        JSON.stringify(OUTPUT_SCHEMA),
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
    const envelope = JSON.parse(stdout) as { is_error?: boolean; structured_output?: unknown };
    return envelope.is_error ? null : ((envelope.structured_output as BuildDiagnosis) ?? null);
  } catch {
    return null;
  }
}
