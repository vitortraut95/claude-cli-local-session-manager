import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applySwitches,
  MODE_AUTOMATIONS,
  modeOf,
  switchesForMode,
  type Switches,
} from "../../../shared/automationModes.js";
import { featuresOf, liveOf } from "../../services/boardWatcher/settings.js";

const allOff: Switches = {
  features: featuresOf({
    todo: { enabled: false },
    codeReview: { enabled: false },
    test: { enabled: false },
    rebuild: { enabled: false },
  }),
  live: liveOf({}),
};

void test("each mode reads back as itself, for every automation", () => {
  for (const automation of MODE_AUTOMATIONS) {
    for (const mode of ["off", "simulate", "live"] as const) {
      const switches = applySwitches(allOff, switchesForMode(automation, mode));
      assert.equal(modeOf(automation, switches), mode, `${automation} ${mode}`);
    }
  }
});

void test("today's combinations map to the mode they behave as", () => {
  const read = (config: Parameters<typeof featuresOf>[0]) => ({
    features: featuresOf(config),
    live: liveOf(config),
  });
  // No switch written: every automation on, nothing for real (how older files behave).
  const fresh = read({});
  for (const automation of MODE_AUTOMATIONS) assert.equal(modeOf(automation, fresh), "simulate");
  // A real action with its automation off does nothing: off.
  assert.equal(
    modeOf("codeReview", read({ codeReview: { enabled: false }, live: { approve: true } })),
    "off",
  );
  // Approving without commenting is still for real.
  assert.equal(modeOf("codeReview", read({ live: { approve: true } })), "live");
  // Moving to In Progress alone is an option, not the To Do queue for real.
  assert.equal(modeOf("devQueue", read({ live: { startProgress: true } })), "simulate");
});

void test("the code review runs its Claude session when on, and off clears its real actions", () => {
  const live = applySwitches(allOff, switchesForMode("codeReview", "live"));
  assert.equal(live.features.reviewSessions, true);
  assert.deepEqual([live.live.comments, live.live.approve], [true, true]);
  const off = applySwitches(live, switchesForMode("codeReview", "off"));
  assert.deepEqual(
    [off.features.codeReview, off.live.comments, off.live.approve],
    [false, false, false],
  );
  // Other automations' switches aren't touched.
  assert.deepEqual(off.live.testClaim, live.live.testClaim);
});
