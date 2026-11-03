import axios from "axios";
import { withServerErrorMessage } from "../utils/apiClient";
import type {
  AutomationSettings,
  AutomationSettingsInput,
  BoardWatcherStatus,
  DailyPreview,
  HistoryFilter,
  WatcherActionEntry,
  WatcherFeedback,
  WatcherHistoryPage,
} from "../../shared/boardWatcher";
export type {
  WatcherFeedback,
  WatcherScoreboard,
  AutomationFeatures,
  AutomationLimits,
  AutomationLive,
  AutomationSettings,
  AutomationSettingsInput,
  BoardWatcherStatus,
  DailyPreview,
  WatcherActionEntry,
  WatcherActionKind,
  WatcherDecision,
  WatcherHistoryGroup,
  WatcherHistoryPage,
  WatcherDecisionAction,
} from "../../shared/boardWatcher";

const client = axios.create({
  baseURL: "/board-watcher",
});

export async function fetchBoardWatcherStatus(): Promise<BoardWatcherStatus> {
  const { data } = await withServerErrorMessage(() => client.get<BoardWatcherStatus>("/status"));
  return data;
}

/** A look at the board right away, instead of waiting for the next one. */
export async function runBoardWatcherNow(): Promise<BoardWatcherStatus> {
  const { data } = await withServerErrorMessage(() => client.post<BoardWatcherStatus>("/run"));
  return data;
}

export async function pauseBoardWatcher(): Promise<BoardWatcherStatus> {
  const { data } = await withServerErrorMessage(() => client.post<BoardWatcherStatus>("/pause"));
  return data;
}

export async function resumeBoardWatcher(): Promise<BoardWatcherStatus> {
  const { data } = await withServerErrorMessage(() => client.post<BoardWatcherStatus>("/resume"));
  return data;
}

/** Sends the Teams digest now; doesn't move the scheduled ones. */
export async function sendBoardWatcherDigestNow(): Promise<void> {
  await withServerErrorMessage(() => client.post("/digest"));
}

/** The daily summary built now (takes a few seconds: it drafts the text). */
export async function fetchDailyPreview(): Promise<DailyPreview> {
  const { data } = await withServerErrorMessage(() => client.get<DailyPreview>("/daily"));
  return data;
}

export async function fetchAutomationSettings(): Promise<AutomationSettings> {
  const { data } = await withServerErrorMessage(() => client.get<AutomationSettings>("/settings"));
  return data;
}

/** Partial update; the server answers with the whole settings as saved. */
export async function saveAutomationSettings(
  input: AutomationSettingsInput,
): Promise<AutomationSettings> {
  const { data } = await withServerErrorMessage(() =>
    client.put<AutomationSettings>("/settings", input),
  );
  return data;
}

/** The latest recorded actions, newest first. */
export async function fetchWatcherActions(limit = 200): Promise<WatcherActionEntry[]> {
  const { data } = await withServerErrorMessage(() =>
    client.get<WatcherActionEntry[]>("/actions", { params: { limit } }),
  );
  return data;
}

/** One page of the history, grouped per ticket/PR (most recently active first). */
export async function fetchWatcherHistory(params: {
  filter: HistoryFilter;
  q: string;
  cursor: string | null;
  limit?: number;
}): Promise<WatcherHistoryPage> {
  const { data } = await withServerErrorMessage(() =>
    client.get<WatcherHistoryPage>("/history", {
      params: { ...params, cursor: params.cursor ?? undefined, q: params.q || undefined },
    }),
  );
  return data;
}

/** URL of one test screenshot (a `files` entry of a `tested` action). */
export function evidenceUrl(file: string): string {
  return `/board-watcher/evidence?path=${encodeURIComponent(file)}`;
}

/** The user's latest 👍/👎 per history entry (`entryKey` → verdict). */
export async function fetchWatcherFeedback(): Promise<Record<string, WatcherFeedback>> {
  const { data } = await withServerErrorMessage(() =>
    client.get<Record<string, WatcherFeedback>>("/feedback"),
  );
  return data;
}

export async function saveWatcherFeedback(
  input: Pick<WatcherFeedback, "entryKey" | "action" | "subject" | "verdict" | "note">,
): Promise<WatcherFeedback> {
  const { data } = await withServerErrorMessage(() =>
    client.post<WatcherFeedback>("/feedback", input),
  );
  return data;
}
