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

void test("a read is retried on a rate limit and counted per attempt", async () => {
  answers(429, 200);
  const response = await apiFetch("bitbucket", "https://api.example.test/x");
  assert.equal(response.status, 200);
  assert.deepEqual(takeCallCounts(), { calls: { jira: 0, bitbucket: 2, jenkins: 0 }, retries: 1 });
});

void test("a read gives up after three attempts and returns the last answer", async () => {
  answers(503);
  const response = await apiFetch("jira", "https://api.example.test/x");
  assert.equal(response.status, 503);
  assert.equal(takeCallCounts().calls.jira, 3);
});

void test("a write isn't retried on a server error (it may have gone through)", async () => {
  answers(502, 200);
  const response = await apiFetch("bitbucket", "https://api.example.test/x", { method: "POST" });
  assert.equal(response.status, 502);
  assert.equal(takeCallCounts().calls.bitbucket, 1);
});

void test("a client error isn't retried", async () => {
  answers(404, 200);
  const response = await apiFetch("bitbucket", "https://api.example.test/x");
  assert.equal(response.status, 404);
  assert.equal(takeCallCounts().retries, 0);
});

void test("a call that times out fails with a hint about the VPN instead of hanging", async () => {
  mock.method(globalThis, "fetch", () =>
    Promise.reject(new DOMException("The operation was aborted due to timeout", "TimeoutError")),
  );
  await assert.rejects(
    apiFetch("bitbucket", "https://api.example.test/x", { method: "POST" }),
    /bitbucket didn't answer in 30s — maybe the VPN/,
  );
  assert.equal(takeCallCounts().calls.bitbucket, 1);
});

void test("each attempt is sent with a timeout signal", async () => {
  const fetchMock = answers(200);
  await apiFetch("jira", "https://api.example.test/x");
  const init = fetchMock.mock.calls[0]?.arguments[1];
  assert.ok(init?.signal instanceof AbortSignal);
});
