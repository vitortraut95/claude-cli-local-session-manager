import axios from "axios";
import { withServerErrorMessage } from "../utils/apiClient";
import { demoActions, demoActivity, demoStatus, isBoardDemo } from "../utils/boardDemo";
import type {
  WatcherActivity,
  AutomationSetupStatus,
  BitbucketRepoOption,
  BoardColumnsAnswer,
  BoardRole,
  SetupFinishInput,
  AutomationSettings,
  AutomationSettingsInput,
  BoardWatcherStatus,
  DailyPreview,
  HistoryFilter,
  HomologCandidate,
  WatcherActionEntry,
  WatcherFeedback,
  WatcherHistoryPage,
} from "../../shared/boardWatcher";
export type {
  WatcherActivity,
  WatcherActivityEvent,
  WatcherActivityKind,
  AutomationSetupStatus,
  BitbucketRepoOption,
  BoardColumn,
  BoardColumnsAnswer,
  BoardRole,
  SecretState,
  SetupFinishInput,
  WatcherFeedback,
  WatcherScoreboard,
  AutomationFeatures,
  AutomationLimits,
  AutomationLive,
  AutomationSettings,
  AutomationSettingsInput,
  BoardWatcherStatus,
  DailyPreview,
  HomologCandidate,
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
  if (isBoardDemo()) return demoStatus();
  const { data } = await withServerErrorMessage(() => client.get<BoardWatcherStatus>("/status"));
  return data;
}

/** A look at the board right away, instead of waiting for the next one. */
export async function runBoardWatcherNow(): Promise<BoardWatcherStatus> {
  if (isBoardDemo()) return demoStatus();
  const { data } = await withServerErrorMessage(() => client.post<BoardWatcherStatus>("/run"));
  return data;
}

export async function pauseBoardWatcher(): Promise<BoardWatcherStatus> {
  if (isBoardDemo()) return demoStatus();
  const { data } = await withServerErrorMessage(() => client.post<BoardWatcherStatus>("/pause"));
  return data;
}

export async function resumeBoardWatcher(): Promise<BoardWatcherStatus> {
  if (isBoardDemo()) return demoStatus();
  const { data } = await withServerErrorMessage(() => client.post<BoardWatcherStatus>("/resume"));
  return data;
}

/** Sends the Teams digest now; doesn't move the scheduled ones. */
export async function sendBoardWatcherDigestNow(): Promise<void> {
  if (isBoardDemo()) return;
  await withServerErrorMessage(() => client.post("/digest"));
}

/** A ticket's PR branches that can be pointed to homolog. */
export async function fetchHomologCandidates(key: string): Promise<HomologCandidate[]> {
  const { data } = await withServerErrorMessage(() =>
    client.get<HomologCandidate[]>("/homolog/candidates", { params: { key } }),
  );
  return data;
}

/** Replays the branch's latest build pointed at homolog; the new build's Jenkins page. */
export async function pointToHomolog(repo: string, branch: string): Promise<{ buildUrl: string }> {
  if (isBoardDemo()) throw new Error(`Demo: ${repo} ${branch} wasn't pointed to homolog.`);
  const { data } = await withServerErrorMessage(() =>
    client.post<{ buildUrl: string }>("/homolog", { repo, branch }),
  );
  return data;
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
  if (isBoardDemo()) return demoActions().slice(-limit);
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

// The automations setup panel (answers even with the beta off).

export async function fetchSetupStatus(): Promise<AutomationSetupStatus> {
  const { data } = await withServerErrorMessage(() => client.get<AutomationSetupStatus>("/setup"));
  return data;
}

export async function setupJira(input: {
  site: string;
  email: string;
  token: string;
}): Promise<{ displayName: string; accountId: string }> {
  const { data } = await withServerErrorMessage(() =>
    client.post<{ displayName: string; accountId: string }>("/setup/jira", input),
  );
  return data;
}

export async function readBoardColumns(board: string): Promise<BoardColumnsAnswer> {
  const { data } = await withServerErrorMessage(() =>
    client.post<BoardColumnsAnswer>("/setup/board/columns", { board }),
  );
  return data;
}

export async function saveBoardColumns(
  board: string,
  mapping: Partial<Record<BoardRole, string[]>>,
): Promise<AutomationSetupStatus> {
  const { data } = await withServerErrorMessage(() =>
    client.post<AutomationSetupStatus>("/setup/board", { board, mapping }),
  );
  return data;
}

export async function setupBitbucket(input: {
  workspace: string;
  email: string;
  token: string;
}): Promise<{ displayName: string }> {
  const { data } = await withServerErrorMessage(() =>
    client.post<{ displayName: string }>("/setup/bitbucket", input),
  );
  return data;
}

export async function fetchBitbucketRepos(): Promise<BitbucketRepoOption[]> {
  const { data } = await withServerErrorMessage(() =>
    client.get<BitbucketRepoOption[]>("/setup/repos"),
  );
  return data;
}

export async function saveSetupRepos(
  repos: string[],
  localRepos: Record<string, string>,
): Promise<AutomationSetupStatus> {
  const { data } = await withServerErrorMessage(() =>
    client.post<AutomationSetupStatus>("/setup/repos", { repos, localRepos }),
  );
  return data;
}

export async function saveSetupExtras(input: {
  teamsWebhook?: string;
  jenkinsUser?: string;
  jenkinsToken?: string;
}): Promise<AutomationSetupStatus> {
  const { data } = await withServerErrorMessage(() =>
    client.post<AutomationSetupStatus>("/setup/extras", input),
  );
  return data;
}

export async function finishSetup(input: SetupFinishInput): Promise<AutomationSetupStatus> {
  const { data } = await withServerErrorMessage(() =>
    client.post<AutomationSetupStatus>("/setup/finish", input),
  );
  return data;
}

/** The live feed's steps after `after` (a seq) and what's running now. */
export async function fetchWatcherActivity(after: number): Promise<WatcherActivity> {
  if (isBoardDemo()) return demoActivity(after);
  const { data } = await withServerErrorMessage(() =>
    client.get<WatcherActivity>("/activity", { params: { after } }),
  );
  return data;
}
