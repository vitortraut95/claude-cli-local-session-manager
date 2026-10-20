#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Claude CLI PreToolUse hook (matcher "Bash"), installed by the Task queue window: blocks a heavy
 * command (tests, typecheck, lint, builds, git commit) run directly and tells Claude to rerun it through `heavy-run`, which queues it among
 * every session's tests and caps its RAM/CPU. Exit 2 = the call is blocked and stderr goes back
 * to Claude; anything else (including unreadable input) lets the call through untouched.
 */

const HEAVY_RUN = path.join(path.dirname(fileURLToPath(import.meta.url)), "heavy-run");

/** Where a command starts: line start or after `;`, `&`, `|`, `(`, then any `VAR=value` prefixes. */
const COMMAND_START = String.raw`(?:^|[;&|(\n])\s*(?:\w+=\S*\s+)*`;
/** Node tools that run as the command itself — directly, by path, or via npx/yarn/pnpm. */
const HEAVY_BINARIES = ["jest", "vitest", "tsc", "vue-tsc", "eslint"];
/** Package-manager scripts (`yarn test:unit`, `npm run typecheck`…). */
const HEAVY_SCRIPTS = ["test", "typecheck", "type-check", "tsc", "lint", "build"];

/**
 * Tests, typecheck, lint, builds and `git commit` (whose pre-commit hooks — husky/lint-staged —
 * usually lint and typecheck), as the command itself; a mere mention (`cat jest.config.js`,
 * `git log --grep=lint`) doesn't count. `git commit --no-verify` runs no hooks, so it passes.
 */
const HEAVY_COMMAND = new RegExp(
  COMMAND_START +
    "(?:" +
    String.raw`(?:npx\s+|yarn\s+(?:run\s+)?|pnpm\s+(?:exec\s+|run\s+)?)?(?:\S*/)?(?:${HEAVY_BINARIES.join("|")})(?![\w.-])` +
    String.raw`|(?:yarn|npm|pnpm)\s+(?:run\s+)?(?:${HEAVY_SCRIPTS.join("|")})(?::[\w-]+)?(?![\w-])` +
    String.raw`|(?:npx\s+)?next\s+build\b` +
    String.raw`|git\s+(?:-C\s+\S+\s+)?commit\b(?!.*--no-verify)` +
    ")",
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
  `Tests, typecheck, lint, builds and git commit (its pre-commit hooks) must go through ` +
    `heavy-run so parallel sessions don't freeze the machine (it waits for a free slot and free ` +
    `RAM, caps RAM/CPU and Node's heap, and runs at low priority). Rerun it as:\n\n` +
    `  ${HEAVY_RUN} <the same command>\n\n` +
    `For a chain (a && b), wrap the whole thing: ${HEAVY_RUN} bash -c 'a && b'. Prefer the ` +
    `narrowest run (the changed files) and fewer workers (--maxWorkers=2); don't set ` +
    `--max-old-space-size yourself, heavy-run sets it. If other sessions hold every slot it ` +
    `waits; for a long run use run_in_background. Exit 137 = over the RAM cap, 134 = over the ` +
    `heap cap — neither is a failing test.\n`,
);
process.exit(2);
