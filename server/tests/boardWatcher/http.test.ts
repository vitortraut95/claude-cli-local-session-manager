import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { apiFetch, takeCallCounts } from "../../services/boardWatcher/http.js";

const answers = (...statuses: number[]) => {
  let call = 0;
  return mock.method(globalThis, "fetch", () => {
    const status = statuses[Math.min(call, statuses.length - 1)] ?? 200;
    call += 1;
    // Retry-After: 0 isn't honored (falls back to the backoff), so tests pass a tiny one.
    return Promise.resolve(new Response("{}", { status, headers: { "retry-after": "0.001" } }));
  });
};

afterEach(() => {
  mock.restoreAll();
  takeCallCounts();
});

test("a read is retried on a rate limit and counted per attempt", async () => {
  answers(429, 200);
  const response = await apiFetch("bitbucket", "https://api.example.test/x");
  assert.equal(response.status, 200);
  assert.deepEqual(takeCallCounts(), { calls: { jira: 0, bitbucket: 2, jenkins: 0 }, retries: 1 });
});

test("a read gives up after three attempts and returns the last answer", async () => {
  answers(503);
  const response = await apiFetch("jira", "https://api.example.test/x");
  assert.equal(response.status, 503);
  assert.equal(takeCallCounts().calls.jira, 3);
});

test("a write isn't retried on a server error (it may have gone through)", async () => {
  answers(502, 200);
  const response = await apiFetch("bitbucket", "https://api.example.test/x", { method: "POST" });
  assert.equal(response.status, 502);
  assert.equal(takeCallCounts().calls.bitbucket, 1);
});

test("a client error isn't retried", async () => {
  answers(404, 200);
  const response = await apiFetch("bitbucket", "https://api.example.test/x");
  assert.equal(response.status, 404);
  assert.equal(takeCallCounts().retries, 0);
});
