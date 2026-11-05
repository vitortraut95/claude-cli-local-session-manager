import assert from "node:assert/strict";
import { test } from "node:test";
import {
  automationSignal,
  automationsStopped,
  guardDeps,
  rearmAutomations,
  stopAutomations,
} from "../../services/boardWatcher/beta.js";

void test("switching off stops the next write of a look under way, and back on runs again", async () => {
  rearmAutomations();
  const calls: string[] = [];
  const deps = guardDeps(
    { board: { comment: (key: string) => Promise.resolve(void calls.push(key)) } },
    automationSignal(),
  );
  await deps.board.comment("LED-1");
  stopAutomations();
  assert.equal(automationsStopped(), true);
  await assert.rejects(async () => deps.board.comment("LED-2"), /turned off/);
  assert.deepEqual(calls, ["LED-1"]);

  rearmAutomations();
  assert.equal(automationsStopped(), false);
  const again = guardDeps(
    { board: { comment: (key: string) => Promise.resolve(void calls.push(key)) } },
    automationSignal(),
  );
  await again.board.comment("LED-3");
  assert.deepEqual(calls, ["LED-1", "LED-3"]);
});
