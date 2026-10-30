import { execFile } from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";
import { sanitizedSpawnEnv } from "../../utils/spawnEnv.js";
import type { BoardIssue } from "./types.js";

/**
 * When one of the user's To Do tickets can't go to the dev queue for a weak description, a short
 * `claude -p` (no tools at all, a quick model) turns what's missing into questions for whoever
 * decides (product, design, tech lead), ready to forward: one message per person, each question
 * with its context, lettered options with their consequence and a recommendation, in business
 * language and without tables.
 */

const execFileAsync = promisify(execFile);
const TIMEOUT_MS = 3 * 60_000;

const OUTPUT_SCHEMA = {
  type: "object",
  required: ["messages"],
  properties: {
    messages: {
      type: "array",
      items: {
        type: "object",
        required: ["to", "text"],
        properties: { to: { type: "string" }, text: { type: "string" } },
      },
    },
  },
};

function buildPrompt(issue: BoardIssue, missing: string, url: string | null): string {
  return `Uma tarefa ainda não tem descrição suficiente para começar o desenvolvimento. Escreva as perguntas que o dev mandaria para quem decide, para destravar a tarefa.

Tarefa ${issue.key}: ${issue.summary}
Link: ${url ?? "(sem link)"}
O que falta na descrição (avaliação automática): ${missing}

Descrição atual:
${issue.description.slice(0, 6000) || "(vazia)"}

Comentários:
${issue.comments.map((c) => `--- ${c.created}\n${c.body.slice(0, 1500)}`).join("\n\n") || "(nenhum)"}

Formato (vai ser colado num chat, então sem tabelas, sem títulos de markdown e sem blocos de código; só **negrito**, listas simples e uma linha "—" entre blocos):
- Uma mensagem por responsável que tem pergunta (Produto, Design ou Tech lead), completa sozinha. No campo "to", o papel; no "text", a mensagem.
- A mensagem abre com uma linha em negrito "**${issue.key} — <o que está em jogo>**" e, na linha seguinte, o link completo da tarefa.
- Cada pergunta numerada: contexto em 1 a 3 linhas (como é hoje e por que surgiu a dúvida), opções com letra (a, b, c) e a consequência de cada uma para o cliente ou a operação, a recomendação ("Sugestão: b") e, no fim, a pergunta em uma frase em negrito.
- Linguagem de negócio: nada de nome de arquivo, função ou componente. Só pergunte o que precisa de resposta de fora; no máximo 5 perguntas no total. Não invente valores, preços ou textos que não estão na tarefa.
Tudo em português do Brasil.`;
}

/** The messages, one per person; empty when the session fails (the notice says only what's
 *  missing then). */
export async function draftPoQuestions(
  issue: BoardIssue,
  missing: string,
  url: string | null,
  model = "sonnet",
): Promise<{ to: string; text: string }[]> {
  const args = [
    "-p",
    buildPrompt(issue, missing, url),
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
    "0.5",
  ];
  const { stdout } = await execFileAsync("claude", args, {
    cwd: os.tmpdir(),
    env: sanitizedSpawnEnv(),
    timeout: TIMEOUT_MS,
    maxBuffer: 8 * 1024 * 1024,
  });
  const envelope = JSON.parse(stdout) as { is_error?: boolean; structured_output?: unknown };
  if (envelope.is_error) return [];
  const output = envelope.structured_output as { messages?: { to: string; text: string }[] } | null;
  return (output?.messages ?? []).filter((m) => m.text?.trim());
}
