import type {
  BoardWatcherStatus,
  WatcherActionEntry,
  WatcherActivity,
  WatcherActivityEvent,
  WatcherActivityKind,
} from "../../shared/boardWatcher";

/**
 * A made-up busy day for the Board, to see how it reads with a lot going on: open the app with
 * `?boardDemo` (dev server only). Every Board call is answered from here, so nothing reaches the
 * server, Jira or Bitbucket, and the Board says it's a demo.
 */

export function isBoardDemo(): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    return new URLSearchParams(window.location.search).has("boardDemo");
  } catch {
    return false;
  }
}

const startedAt = Date.now();
const ago = (minutes: number) => new Date(startedAt - minutes * 60_000).toISOString();
const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

export function demoStatus(): BoardWatcherStatus {
  return {
    enabled: true,
    businessTime: true,
    nextBusinessStart: null,
    running: false,
    reviewing: true,
    lastTickAt: ago(2),
    nextLookAt: inMinutes(8),
    lastDigestAt: ago(300),
    lastError: null,
    pausedReason: null,
    pendingReviews: ["acme-web#233", "acme-checkout#87"],
    pendingTests: ["DEMO-412"],
    priority: [],
    approvalsToday: 6,
    testClaimsToday: 2,
    today: { reviews: 9, tests: 2, durationMs: 47 * 60_000, costUsd: 11.4 },
    jobsBlockedBy: null,
    calls: {
      lastLook: { jira: 3, bitbucket: 14, jenkins: 2 },
      lastLookMs: 6_400,
      retries: 0,
      lastHour: { jira: 18, bitbucket: 96, jenkins: 9 },
    },
    scoreboard: {
      days: 14,
      reviews: { up: 27, down: 2 },
      tests: { up: 6, down: 1 },
      decisions: { up: 12, down: 1 },
    },
    titles: {
      "acme-cart#131": "Coupon field validation on the cart",
      "acme-web#233": "New hero video on the home page",
      "acme-checkout#87": "Pix payment retry",
      "acme-blog#19": "Blog sitemap with categories",
      "acme-web#228": "Footer links per country",
      "acme-checkout#84": "Card form autofill",
      "acme-cart#129": "Compact add-ons layout",
      "acme-blog#17": "Blog sitemap",
      "DEMO-412": "Checkout coupon for MX",
      "DEMO-415": "Show the plan's renewal price",
      "DEMO-418": "Change the banner",
      "DEMO-407": "Hosting plans comparison table",
      "DEMO-402": "Checkout coupon for MX",
    },
    linkBases: {
      jira: "https://example.atlassian.net/browse/",
      bitbucket: "https://bitbucket.org/example/",
    },
    lastDecisions: [
      { subject: "acme-cart#131", action: "review", reason: "pushed since the user's approval" },
      {
        subject: "acme-web#233",
        action: "review",
        reason: "past Code Review without any approval",
      },
      {
        subject: "acme-blog#19",
        action: "wait",
        reason: "giving people time to review (4 of 10 business minutes)",
      },
      { subject: "acme-web#228", action: "wait", reason: "CI running" },
      { subject: "acme-checkout#84", action: "skip", reason: "CI failed" },
      { subject: "acme-cart#129", action: "skip", reason: "another reviewer requested changes" },
      { subject: "DEMO-415", action: "enqueue-dev", reason: "description scored 4/5" },
      { subject: "DEMO-412", action: "claim-test", reason: "test plan found" },
      {
        subject: "DEMO-418",
        action: "weak-description",
        reason: "description scored 2/5: no acceptance criteria, no link",
      },
    ],
  };
}

export function demoActions(): WatcherActionEntry[] {
  const entry = (
    minutes: number,
    action: WatcherActionEntry["action"],
    subject: string,
    title: string,
    detail?: string,
  ): WatcherActionEntry => ({ ts: ago(minutes), action, subject, title, detail });
  return [
    entry(240, "approve", "acme-web#221", "Remove plan P from the landing page"),
    entry(190, "reviewed", "acme-cart#126", "Compact add-ons layout", "2 findings"),
    entry(150, "build-failed", "DEMO-407", "Preview build of DEMO-407", "infra: agent offline"),
    entry(95, "tested", "DEMO-402", "Checkout coupon for MX", "reprovado, relatório comentado"),
    entry(60, "review-failed", "acme-blog#17", "Blog sitemap", "Session timed out"),
    entry(25, "comment", "acme-cart#131", "Coupon field validation", "1 comment"),
  ];
}

/** The live feed's script: one step every few seconds, looping, so the panel moves. */
const SCRIPT: { kind: WatcherActivityKind; subject?: string; detail?: string }[] = [
  { kind: "look" },
  { kind: "issues", detail: "34" },
  { kind: "prs", detail: "11" },
  { kind: "decisions", detail: "3" },
  { kind: "lookDone", detail: "6" },
  { kind: "reviewDone", subject: "acme-web#228", detail: "0 finding(s), approve" },
  { kind: "diagnose", subject: "acme-checkout#84" },
  { kind: "diagnosed", subject: "acme-checkout#84", detail: "code" },
  { kind: "testDone", subject: "DEMO-409", detail: "approved" },
  { kind: "rebuild", subject: "acme-web:4f2c1a9", detail: "done" },
  { kind: "reviewSkipped", subject: "acme-blog#18", detail: "new push" },
  { kind: "blocked", detail: "tests waiting: VPN is down" },
];
const STEP_MS = 4_000;

export function demoActivity(after: number): WatcherActivity {
  // A few steps already there when the Board opens, then one more every STEP_MS.
  const count = 8 + Math.floor((Date.now() - startedAt) / STEP_MS);
  const events: WatcherActivityEvent[] = [];
  for (let seq = 1; seq <= count; seq += 1) {
    if (seq <= after) continue;
    const step = SCRIPT[(seq - 1) % SCRIPT.length];
    if (!step) continue;
    events.push({
      seq,
      at: new Date(startedAt - (8 - seq) * STEP_MS).toISOString(),
      kind: step.kind,
      ...(step.subject ? { subject: step.subject } : {}),
      ...(step.detail ? { detail: step.detail } : {}),
    });
  }
  // A review of acme-cart#131 always running, with its timer going.
  return {
    events,
    current: {
      kind: "review",
      subject: "acme-cart#131",
      since: new Date(startedAt - 97_000).toISOString(),
    },
  };
}
