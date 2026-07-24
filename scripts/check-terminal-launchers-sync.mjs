#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * `server/services/sessionService.ts`'s Linux TERMINAL_LAUNCHERS list is duplicated by hand in
 * `open-terminal.sh` (a plain Bash array) — that script has to work before Node/yarn are even
 * guaranteed to be on PATH (see CLAUDE.md), so it can't just import/call the TS implementation.
 * This catches silent drift between the two: same binaries, same order, nothing more.
 */

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sessionServicePath = path.join(rootDir, "server/services/sessionService.ts");
const openTerminalPath = path.join(rootDir, "open-terminal.sh");

function extractFromSessionService(source) {
  return [...source.matchAll(/bin:\s*"([^"]+)"/g)].map((match) => match[1]);
}

function extractFromOpenTerminal(source) {
  const match = source.match(/TERMINAL_LAUNCHERS=\(([^)]*)\)/);
  if (!match) {
    throw new Error(`Could not find a TERMINAL_LAUNCHERS=(...) array in ${openTerminalPath}`);
  }
  return match[1].trim().split(/\s+/);
}

const fromTs = extractFromSessionService(readFileSync(sessionServicePath, "utf8"));
const fromSh = extractFromOpenTerminal(readFileSync(openTerminalPath, "utf8"));

if (fromTs.length === 0) {
  throw new Error(`Could not find any TERMINAL_LAUNCHERS entries in ${sessionServicePath}`);
}

const tsList = fromTs.join(", ");
const shList = fromSh.join(", ");

if (tsList !== shList) {
  console.error("Terminal launcher lists have drifted out of sync:\n");
  console.error(`  server/services/sessionService.ts: [${tsList}]`);
  console.error(`  open-terminal.sh:                  [${shList}]`);
  console.error(
    "\nThese must stay identical (same binaries, same order) until they're unified into a " +
      "single implementation. Update whichever one is stale.",
  );
  process.exit(1);
}

console.log(`Terminal launcher lists match: [${tsList}]`);
