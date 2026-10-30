/**
 * Runs the unattended test session on one ticket now, outside the board rules, to compare its
 * verdict with the one a person gave. Uses the plan as it was before the first test report, and
 * the session never sees that report. Nothing is posted: prints the verdict, the report it would
 * post and where the evidence is. `yarn board-watcher:test-run KEY`.
 */
import { loadBoardWatcherConfig } from "../services/boardWatcher/config.js";
import { runClaudeTest } from "../services/boardWatcher/claudeTester.js";
import { jiraCredentialsFromEnv, searchIssues } from "../services/boardWatcher/jira.js";
import { isTestPlan, isTestReport } from "../services/boardWatcher/testPlan.js";

async function main(): Promise<void> {
  const key = process.argv[2];
  const config = await loadBoardWatcherConfig();
  if (!key || !config?.jira || !config.bitbucket?.localRepos) {
    throw new Error("Usage: board-watcher:test-run KEY (needs jira and bitbucket.localRepos).");
  }
  const [issue] = await searchIssues(jiraCredentialsFromEnv(config.jira.site), `key = ${key}`, 1);
  if (!issue) throw new Error(`${key} not found.`);
  const sorted = [...issue.comments].sort((a, b) => Date.parse(a.created) - Date.parse(b.created));
  const firstReport = sorted.find((c) => isTestReport(c.body));
  const plan = sorted.findLast(
    (c) =>
      isTestPlan(c.body) &&
      (!firstReport || Date.parse(c.created) < Date.parse(firstReport.created)),
  );
  if (!plan) throw new Error(`${key} has no test plan.`);

  const started = Date.now();
  const output = await runClaudeTest(issue, plan, {
    localRepos: config.bitbucket.localRepos,
    skill: config.test?.skill,
    model: config.test?.model,
    maxBudgetUsd: config.test?.maxBudgetUsd,
  });
  console.log(`Verdict: ${output.verdict} (${Math.round((Date.now() - started) / 60_000)} min)`);
  if (output.blockedBy) console.log(`Blocked by: ${output.blockedBy}`);
  console.log(`Evidence (${output.evidence.length}) in ${output.evidenceDir}`);
  for (const item of output.evidence) console.log(`  ${item.file} — ${item.description}`);
  console.log(`\n--- Report it would post\n${output.report}`);
  if (firstReport) console.log(`\n--- Report a person posted\n${firstReport.body.slice(0, 3000)}`);
}

await main();
