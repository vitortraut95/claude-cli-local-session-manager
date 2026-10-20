#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Claude CLI PreToolUse hook (matcher "Bash"), installed by the Task queue window: blocks a test
 * command run directly and tells Claude to rerun it through `heavy-run`, which queues it among
 * every session's tests and caps its RAM/CPU. Exit 2 = the call is blocked and stderr goes back
 * to Claude; anything else (including unreadable input) lets the call through untouched.
 */

const HEAVY_RUN = path.join(path.dirname(fileURLToPath(import.meta.url)), "heavy-run");

/** Where a command starts: line start or after `;`, `&`, `|`, `(`, then any `VAR=value` prefixes. */
const COMMAND_START = String.raw`(?:^|[;&|(\n])\s*(?:\w+=\S*\s+)*`;
/** A test runner as the command itself — directly, by path, or via npx/yarn/pnpm — or a
 *  package-manager `test` script (`yarn test:unit` included). Not a mere mention (`cat jest.config.js`). */
const HEAVY_COMMAND = new RegExp(
  COMMAND_START +
    String.raw`(?:(?:npx\s+|yarn\s+(?:run\s+)?|pnpm\s+(?:exec\s+|run\s+)?)?(?:\S*/)?(?:jest|vitest)(?![\w.-])` +
    String.raw`|(?:yarn|npm|pnpm)\s+(?:run\s+)?test(?::[\w-]+)?(?![\w-]))`,
);

let input = "";
for await (const chunk of process.stdin) input += chunk;

let command = "";
try {
  command = JSON.parse(input)?.tool_input?.command ?? "";
} catch {
  process.exit(0);
}

if (typeof command !== "string" || !HEAVY_COMMAND.test(command) || command.includes("heavy-run")) {
  process.exit(0);
}

process.stderr.write(
  `Test commands must go through heavy-run so parallel sessions don't freeze the machine (it ` +
    `waits for a free test slot and caps RAM/CPU). Rerun it as:\n\n` +
    `  ${HEAVY_RUN} <the same command>\n\n` +
    `Prefer the narrowest run (the changed test files) and fewer workers (--maxWorkers=2). If ` +
    `other sessions hold every slot it waits; for a long suite use run_in_background. Exit 137 ` +
    `means it went over the memory cap, not a failing test.\n`,
);
process.exit(2);
