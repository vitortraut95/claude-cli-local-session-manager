import assert from "node:assert/strict";
import { test } from "node:test";
import { isBusinessDay, previousBusinessDay } from "../../services/boardWatcher/businessTime.js";
import { DEFAULT_BUSINESS_HOURS } from "../../services/boardWatcher/config.js";
import { dayLabel, sections, type DailyFacts } from "../../services/boardWatcher/dailySummary.js";

const hours = { ...DEFAULT_BUSINESS_HOURS, timezone: "America/Sao_Paulo" };
// Midday in São Paulo, so the day can't flip with the timezone.
const at = (day: string) => new Date(`${day}T15:00:00Z`);

test("the previous business day skips the weekend", () => {
  assert.equal(previousBusinessDay(at("2026-11-03"), hours), "2026-11-02"); // Tue → Mon
  assert.equal(previousBusinessDay(at("2026-11-02"), hours), "2026-10-30"); // Mon → Fri
  assert.equal(isBusinessDay(at("2026-11-01"), hours), false); // Sunday
});

test("the reported day is 'ontem' only when it's yesterday", () => {
  assert.equal(dayLabel("2026-11-02", at("2026-11-03"), hours), "ontem");
  assert.equal(dayLabel("2026-10-30", at("2026-11-03"), hours), "sexta 30/10");
});

const facts = (overrides: Partial<DailyFacts>): DailyFacts => ({
  day: "2026-10-30",
  dayLabel: "sexta 30/10",
  moved: [],
  commits: [],
  opened: [],
  approved: [],
  today: [],
  stuck: [],
  ...overrides,
});

test("a card's moves of the day become one line, from where it started to where it ended", () => {
  const { yesterday } = sections(
    facts({
      moved: [
        {
          key: "DEMO-1",
          summary: "Carrossel",
          at: "2026-10-30T15:00:00Z",
          from: "In Test",
          to: "Validation",
        },
        {
          key: "DEMO-1",
          summary: "Carrossel",
          at: "2026-10-30T11:00:00Z",
          from: "Ready for Test",
          to: "In Test",
        },
        {
          key: "DEMO-2",
          summary: "Links",
          at: "2026-10-30T12:00:00Z",
          from: "To Do",
          to: "In Progress",
        },
      ],
    }),
  );
  assert.deepEqual(yesterday, [
    "DEMO-1 · Ready for Test → Validation: Carrossel",
    "DEMO-2 · To Do → In Progress: Links",
  ]);
});

test("commits are counted per ticket with the latest subject", () => {
  const { yesterday } = sections(
    facts({
      commits: [{ group: "DEMO-3", subjects: ["DEMO-3: primeiro", "DEMO-3: ajuste final"] }],
    }),
  );
  assert.deepEqual(yesterday, ["DEMO-3 · 2 commit(s): DEMO-3: ajuste final"]);
});
