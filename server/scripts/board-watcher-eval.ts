/**
 * Runs the board watcher against the fake scenarios in `server/fixtures/board-watcher/*.json`
 * and checks each tick's effects (what it would have done) and decisions against the expected
 * ones. Nothing leaves the machine. `yarn board-watcher:eval [name filter] [--verbose]`.
 *
 * Scenario: `{ name, config?, state?, ticks: [{ now, issues?, prs?, reviews?, startedDevKeys?,
 * expect }] }`. A tick without `issues`/`prs`/`startedDevKeys` keeps the previous ones (as left by the last tick's writes).
 * `expect.effects` must match exactly, in any order; `expect.decisions` maps a subject to the
 * action expected for it, or "none" for no decision at all.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_LIMITS, type BoardWatcherConfig } from "../services/boardWatcher/config.js";
import type { DecisionAction } from "../services/boardWatcher/decide.js";
import { createFakeDeps, type FakeWorld } from "../services/boardWatcher/fake.js";
import { runTick } from "../services/boardWatcher/tick.js";
import {
  emptyWatcherState,
  type BoardIssue,
  type PullRequest,
  type ReviewResult,
  type WatcherState,
} from "../services/boardWatcher/types.js";

type Tick = {
  now: string;
  issues?: Partial<BoardIssue>[];
  prs?: Partial<PullRequest>[];
  reviews?: Record<string, ReviewResult>;
  startedDevKeys?: string[];
  expect: { effects: string[]; decisions?: Record<string, DecisionAction | "none"> };
};

type Scenario = {
  name: string;
  config?: Partial<BoardWatcherConfig>;
  state?: Partial<WatcherState>;
  ticks: Tick[];
};

const FIXTURES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/board-watcher",
);

/** Same ids in every scenario: the user is "me", columns are named after themselves. */
const BASE_CONFIG: BoardWatcherConfig = {
  ...DEFAULT_LIMITS,
  me: "me",
  columns: { todo: ["todo"], waitTest: ["wait-test"], testing: ["testing"] },
  testingStatusId: "testing",
  businessHours: {
    timezone: "America/Sao_Paulo",
    days: [1, 2, 3, 4, 5],
    start: "09:00",
    end: "18:00",
  },
};

function toIssue(raw: Partial<BoardIssue>): BoardIssue {
  return {
    key: raw.key ?? "DEMO-0",
    summary: raw.summary ?? "",
    description: raw.description ?? "",
    statusId: raw.statusId ?? "todo",
    statusSince: raw.statusSince ?? "2026-01-01T00:00:00Z",
    assigneeId: raw.assigneeId ?? null,
    labels: raw.labels ?? [],
    comments: raw.comments ?? [],
  };
}

function toPullRequest(raw: Partial<PullRequest>): PullRequest {
  const lastPushAt = raw.lastPushAt ?? raw.createdAt ?? "2026-01-01T00:00:00Z";
  return {
    id: raw.id ?? "0",
    repo: raw.repo ?? "web",
    title: raw.title ?? "",
    authorId: raw.authorId ?? "ana",
    createdAt: raw.createdAt ?? lastPushAt,
    lastPushAt,
    draft: raw.draft ?? false,
    reviewers: raw.reviewers ?? [{ id: "me", state: "none" }],
    ci: raw.ci ?? "passed",
    hasConflicts: raw.hasConflicts ?? false,
    sourceBranch: raw.sourceBranch,
    destinationBranch: raw.destinationBranch,
    sourceHash: raw.sourceHash,
    approvedCommit: raw.approvedCommit,
  };
}

function diff(expected: string[], actual: string[]): { missing: string[]; extra: string[] } {
  const extra = [...actual];
  const missing: string[] = [];
  for (const item of expected) {
    const index = extra.indexOf(item);
    if (index === -1) missing.push(item);
    else extra.splice(index, 1);
  }
  return { missing, extra };
}

async function runScenario(scenario: Scenario, verbose: boolean): Promise<string[]> {
  const config = { ...BASE_CONFIG, ...scenario.config };
  const state = { ...emptyWatcherState(), ...structuredClone(scenario.state ?? {}) };
  const world: FakeWorld = { issues: [], prs: [], reviews: {} };
  const failures: string[] = [];

  for (const [index, tick] of scenario.ticks.entries()) {
    if (tick.issues) world.issues = tick.issues.map(toIssue);
    if (tick.prs) world.prs = tick.prs.map(toPullRequest);
    world.reviews = tick.reviews ?? {};
    if (tick.startedDevKeys) world.startedDevKeys = tick.startedDevKeys;
    const effects: string[] = [];
    const decisions = await runTick(
      createFakeDeps(world, config.me, effects),
      state,
      config,
      new Date(tick.now),
    );

    const label = `tick ${index + 1} (${tick.now})`;
    const { missing, extra } = diff(tick.expect.effects, effects);
    for (const item of missing) failures.push(`${label}: expected effect "${item}" didn't happen`);
    for (const item of extra) failures.push(`${label}: unexpected effect "${item}"`);
    for (const [subject, action] of Object.entries(tick.expect.decisions ?? {})) {
      const got = decisions.find((d) => d.subject === subject);
      if ((got?.action ?? "none") !== action) {
        failures.push(
          `${label}: ${subject} expected ${action}, got ${got ? `${got.action} (${got.reason})` : "none"}`,
        );
      }
    }
    if (verbose) {
      console.log(`    ${label}`);
      for (const d of decisions) console.log(`      ${d.subject}: ${d.action} — ${d.reason}`);
      for (const e of effects) console.log(`      → ${e}`);
    }
  }
  return failures;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const verbose = args.includes("--verbose");
  const filter = args.find((a) => !a.startsWith("--"))?.toLowerCase();
  const files = (await readdir(FIXTURES_DIR)).filter((f) => f.endsWith(".json")).sort();

  let passed = 0;
  let failed = 0;
  for (const file of files) {
    const scenarios = JSON.parse(
      await readFile(path.join(FIXTURES_DIR, file), "utf8"),
    ) as Scenario[];
    console.log(`\n${file}`);
    for (const scenario of scenarios) {
      if (filter && !scenario.name.toLowerCase().includes(filter)) continue;
      const failures = await runScenario(scenario, verbose);
      if (failures.length === 0) {
        passed += 1;
        console.log(`  ✓ ${scenario.name}`);
      } else {
        failed += 1;
        console.log(`  ✗ ${scenario.name}`);
        for (const failure of failures) console.log(`      ${failure}`);
      }
    }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

await main();
