import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildPageUrl,
  infraIncident,
  jobPageUrl,
  logExcerpt,
} from "../../services/boardWatcher/buildDiagnosis.js";

void test("the build page comes from the link Jenkins posts on the commit", () => {
  assert.equal(
    buildPageUrl("https://ci.example.test/job/web/job/env%252FDEMO-1/5/display/redirect"),
    "https://ci.example.test/job/web/job/env%252FDEMO-1/5/",
  );
});

void test("the excerpt keeps the lines around the first failure and the end of the log", () => {
  const noise = Array.from({ length: 500 }, (_, i) => `step ${i}`);
  const log = [
    ...noise.slice(0, 300),
    "npm ERR! missing script: build",
    ...noise.slice(300),
    "Finished: FAILURE",
  ].join("\n");
  const excerpt = logExcerpt(log);
  assert.match(excerpt, /npm ERR! missing script: build/);
  assert.match(excerpt, /Finished: FAILURE/);
  assert.doesNotMatch(excerpt, /^step 0$/m);
});

void test("without a failure line, the end of the log is still kept", () => {
  const excerpt = logExcerpt(["a", "b", "Finished: ABORTED"].join("\n"));
  assert.match(excerpt, /Finished: ABORTED/);
});

void test("an infra error is tied to the agent running the step that broke", () => {
  const log = [
    "Running on worker01-ci.example.test in /ws/a",
    "[2026-11-03T15:29:10Z] Running on worker02-ci.example.test in /ws/b",
    "Resolving packages...",
    "[2026-11-03T15:35:00Z] ssh: connect to host git.example.test port 22: Network unreachable\r",
  ].join("\n");
  assert.deepEqual(infraIncident(log), {
    signature: "worker02-ci|sem conexão com git.example.test:22",
    agent: "worker02-ci",
    problem: "sem conexão com git.example.test:22",
    evidence: "ssh: connect to host git.example.test port 22: Network unreachable",
  });
});

void test("a code failure has no infra incident", () => {
  assert.equal(infraIncident("Running on worker01 in /ws\nerror TS2322: bad type\n"), null);
});

void test("the job page is the build page without the build number", () => {
  assert.equal(
    jobPageUrl("https://ci.example.test/job/web/job/env%252FDEMO-1/5/"),
    "https://ci.example.test/job/web/job/env%252FDEMO-1/",
  );
});
