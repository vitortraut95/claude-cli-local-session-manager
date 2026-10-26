#!/usr/bin/env node

/**
 * Claude CLI hook installed by the Task queue window (`usagePauseService.ts`); the app's API port
 * is its only argument.
 * - PreToolUse: while the app says the plan is near its limit, waits (asking again every minute)
 *   instead of letting the tool run, then lets it through. The session spends nothing meanwhile.
 * - UserPromptSubmit: the prompt "destravar" unlocks this session until the limit resets; the
 *   prompt itself never reaches Claude.
 * The app not answering never blocks anything.
 */

const PORT = process.argv[2] ?? "58231";
const POLL_MS = 60_000;
const UNLOCK_WORD = "destravar";

let input = "";
for await (const chunk of process.stdin) input += chunk;

let hook;
try {
  hook = JSON.parse(input) ?? {};
} catch {
  process.exit(0);
}
const sessionId = typeof hook.session_id === "string" ? hook.session_id : "";
if (!sessionId) process.exit(0);

const GATE_URL = `http://localhost:${PORT}/sessions/${encodeURIComponent(sessionId)}/usage-gate`;

async function call(method, suffix = "") {
  try {
    const response = await fetch(`${GATE_URL}${suffix}`, {
      method,
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

if (hook.hook_event_name === "UserPromptSubmit") {
  const prompt = String(hook.prompt ?? hook.prompt_text ?? "")
    .trim()
    .toLowerCase();
  if (prompt !== UNLOCK_WORD) process.exit(0);
  const done = await call("POST", "/unlock");
  process.stdout.write(
    JSON.stringify({
      decision: "block",
      reason: done
        ? "Limites destravados nesta sessão até a cota resetar. Mande o que quiser agora."
        : "O Claude Session Manager não respondeu; a sessão não está sendo pausada por ele.",
    }),
  );
  process.exit(0);
}

for (;;) {
  const gate = await call("GET");
  if (!gate?.pause) process.exit(0);
  await new Promise((resolve) => setTimeout(resolve, POLL_MS));
}
