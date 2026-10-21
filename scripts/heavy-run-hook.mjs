#!/usr/bin/env node
import { appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Claude CLI PreToolUse hook (matcher "Bash"), installed by the Task queue window: blocks a heavy
 * command (tests, typecheck, lint, builds, git commit) run directly and tells Claude to rerun it
 * through `heavy-run`, which queues it among every session's tests and caps its RAM/CPU; and a
 * dev-server container (`docker run … next dev`), to be started with `heavy-run --preview`, which
 * caps how many run at once and each one's RAM/CPU. Exit 2 = the call is blocked and stderr goes back
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

/** `docker run` of a dev server (next dev, yarn/npm/pnpm dev, vite, storybook) — the command may
 *  be quoted for the container's shell (`sh -c "yarn && yarn dev"`). */
const PREVIEW_COMMAND = new RegExp(
  COMMAND_START +
    String.raw`docker\s+run\b[\s\S]*?(?:\bnext\s+dev\b|\b(?:yarn|npm|pnpm)\s+(?:run\s+)?dev\b|\bvite\b|\bstorybook\b)`,
);

let input = "";
for await (const chunk of process.stdin) input += chunk;

let command = "";
let hookInput = {};
try {
  hookInput = JSON.parse(input) ?? {};
  command = hookInput.tool_input?.command ?? "";
} catch {
  process.exit(0);
}

if (typeof command !== "string" || command.includes("heavy-run")) process.exit(0);
const isPreview = PREVIEW_COMMAND.test(command);
if (!isPreview && !HEAVY_COMMAND.test(command)) process.exit(0);

// For the app's history (server/utils/history.ts); best-effort.
try {
  appendFileSync(
    path.join(path.dirname(HEAVY_RUN), "..", "history.jsonl"),
    `${JSON.stringify({
      ts: new Date().toISOString(),
      type: "heavy.blocked",
      mode: isPreview ? "preview" : "test",
      command: command.slice(0, 300),
      cwd: hookInput.cwd ?? null,
      sessionId: hookInput.session_id ?? null,
    })}\n`,
  );
} catch {
  // Never let the history break the hook.
}

if (isPreview) {
  process.stderr.write(
    `Dev-server containers (previews) must be started through heavy-run so parallel sessions ` +
      `don't freeze the machine: it waits while too many previews already run across sessions, ` +
      `and caps each one's RAM/CPU. Rerun it as:\n\n` +
      `  ${HEAVY_RUN} --preview docker run <the same options, image and command>\n\n` +
      `Don't set --memory/--cpus yourself. Keep one preview per task running when you're done — ` +
      `the task's main country/site, on a free port — since that's how the user validates the ` +
      `worktree, and say its URL; the app removes it when the task is marked done. Never stop it ` +
      `to free memory for tests (heavy-run already caps those). Extra previews (other ` +
      `countries): start, check, then stop them (docker stop <name>, not rm). Exit 75 = gave up ` +
      `waiting for a free preview slot; nothing started.\n`,
  );
  process.exit(2);
}

process.stderr.write(
  `Tests, typecheck, lint, builds and git commit (its pre-commit hooks) must go through ` +
    `heavy-run so parallel sessions don't freeze the machine (it waits for a free slot and free ` +
    `RAM, caps RAM/CPU and Node's heap, and runs at low priority). Rerun it as:\n\n` +
    `  ${HEAVY_RUN} <the same command>\n\n` +
    `For a chain (a && b), wrap the whole thing: ${HEAVY_RUN} bash -c 'a && b'. Prefer the ` +
    `narrowest run (the changed files) and fewer workers (--maxWorkers=2); don't set ` +
    `--max-old-space-size yourself, heavy-run sets it. If other sessions hold every slot it ` +
    `waits (up to 15 min, then exit 75 with nothing run — retry later); for a long run use ` +
    `run_in_background. Exit 137 = over the RAM cap, 134 = over the heap cap — neither is a ` +
    `failing test.\n`,
);
process.exit(2);
