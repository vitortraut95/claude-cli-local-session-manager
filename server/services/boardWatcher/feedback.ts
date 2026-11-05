import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import type {
  FeedbackScore,
  WatcherActionKind,
  WatcherFeedback,
  WatcherScoreboard,
} from "../../../shared/boardWatcher.js";
import { BadRequestError } from "../../utils/httpError.js";
import { REPO_ROOT } from "../../utils/repoRoot.js";

/**
 * The user's 👍/👎 on the watcher's history entries, in the gitignored
 * `boardWatcher-feedback.jsonl` (append-only; the latest verdict per entry wins). Feeds the hit
 * rate shown in the app and the lessons added to the next review/test sessions' prompts.
 */

const FEEDBACK_FILE = path.join(REPO_ROOT, "boardWatcher-feedback.jsonl");
const SCORE_DAYS = 14;
const MAX_LESSONS = 15;
const MAX_NOTE = 1000;

const REVIEW_ACTIONS: WatcherActionKind[] = ["reviewed", "comment", "approve"];
const TEST_ACTIONS: WatcherActionKind[] = ["tested"];

/** The latest verdict per history entry. */
export async function listFeedback(): Promise<Record<string, WatcherFeedback>> {
  const raw = await readFile(FEEDBACK_FILE, "utf8").catch(() => "");
  const latest: Record<string, WatcherFeedback> = {};
  for (const line of raw.split("\n")) {
    if (!line) continue;
    const feedback = JSON.parse(line) as WatcherFeedback;
    latest[feedback.entryKey] = feedback;
  }
  return latest;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function saveFeedback(body: unknown): Promise<WatcherFeedback> {
  const input = isRecord(body) ? body : {};
  const { entryKey, action, subject, verdict, note } = input;
  if (
    typeof entryKey !== "string" ||
    typeof action !== "string" ||
    typeof subject !== "string" ||
    (verdict !== "up" && verdict !== "down") ||
    (note !== undefined && typeof note !== "string")
  ) {
    throw new BadRequestError(
      "BAD_FEEDBACK",
      'Expected { entryKey, action, subject, verdict: "up"|"down", note? }.',
    );
  }
  const feedback: WatcherFeedback = {
    entryKey,
    action: action as WatcherActionKind,
    subject,
    verdict,
    ...(note?.trim() ? { note: note.trim().slice(0, MAX_NOTE) } : {}),
    ts: new Date().toISOString(),
  };
  await appendFile(FEEDBACK_FILE, `${JSON.stringify(feedback)}\n`, "utf8");
  return feedback;
}

export async function getScoreboard(): Promise<WatcherScoreboard> {
  const since = Date.now() - SCORE_DAYS * 24 * 60 * 60_000;
  const empty = (): FeedbackScore => ({ up: 0, down: 0 });
  const board: WatcherScoreboard = {
    days: SCORE_DAYS,
    reviews: empty(),
    tests: empty(),
    decisions: empty(),
  };
  for (const feedback of Object.values(await listFeedback())) {
    if (Date.parse(feedback.ts) < since) continue;
    const bucket = REVIEW_ACTIONS.includes(feedback.action)
      ? board.reviews
      : TEST_ACTIONS.includes(feedback.action)
        ? board.tests
        : board.decisions;
    bucket[feedback.verdict] += 1;
  }
  return board;
}

/** The user's notes on what went wrong, newest first, for the next sessions of that kind. */
export async function getLessons(kind: "review" | "test"): Promise<string[]> {
  const actions = kind === "review" ? REVIEW_ACTIONS : TEST_ACTIONS;
  return Object.values(await listFeedback())
    .filter((f) => f.verdict === "down" && f.note && actions.includes(f.action))
    .sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts))
    .slice(0, MAX_LESSONS)
    .map((f) => f.note ?? "");
}

/** The lessons as a prompt section, or "" when there are none. */
export function lessonsSection(lessons: string[]): string {
  if (lessons.length === 0) return "";
  return `\n\nLições do usuário sobre reviews/testes anteriores (siga-as; valem acima do seu julgamento):\n${lessons
    .map((lesson) => `- ${lesson}`)
    .join("\n")}`;
}
