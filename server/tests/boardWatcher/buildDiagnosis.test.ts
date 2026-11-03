import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPageUrl, logExcerpt } from "../../services/boardWatcher/buildDiagnosis.js";

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
