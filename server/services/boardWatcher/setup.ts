import { execFile } from "node:child_process";
import { readFile, rename, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import {
  BOARD_ROLES,
  type AutomationSetupStatus,
  type BoardColumn,
  type BoardColumnsAnswer,
  type BoardRole,
  type SecretState,
  type SetupFinishInput,
} from "../../../shared/boardWatcher.js";
import { BadRequestError } from "../../utils/httpError.js";
import { sanitizedSpawnEnv } from "../../utils/spawnEnv.js";
import { BOARD_WATCHER_CONFIG_FILE, dropSimulation, type BoardWatcherConfig } from "./config.js";
import { apiFetch } from "./http.js";
import { jiraApiBase } from "./jira.js";
import {
  saveSecrets,
  secretIsSet,
  secretShellFile,
  secretSource,
  SECRET_NAMES,
  type SecretName,
} from "./secrets.js";
import { assertReviewSkillFor, featuresOf, writeSwitches } from "./settings.js";

/**
 * The automations setup panel: each step checks what it's given against the real service (Jira,
 * Bitbucket, the local clones) before saving it to `boardWatcher.json` (ids) or
 * `boardWatcher.secrets.json` (tokens). Nothing runs until the last step turns it on, with the
 * automations the user picked (each one on acts for real).
 */

const execFileAsync = promisify(execFile);

type RawConfig = Record<string, unknown> & {
  enabled?: boolean;
  me?: string;
  columns?: Partial<Record<BoardRole, string[]>>;
  testingStatusId?: string;
  inProgressStatusId?: string;
  jira?: { site?: string; boardId?: number; boardUrl?: string; scopeJql?: string };
  bitbucket?: { workspace?: string; localRepos?: Record<string, string> };
  todo?: { enabled?: boolean };
  codeReview?: { enabled?: boolean };
  test?: { enabled?: boolean };
  notifications?: { instant?: boolean; digest?: boolean };
};

async function readRaw(): Promise<RawConfig> {
  const text = await readFile(BOARD_WATCHER_CONFIG_FILE, "utf8").catch(() => null);
  if (text === null) return {};
  try {
    const raw = JSON.parse(text) as RawConfig;
    dropSimulation(raw);
    return raw;
  } catch {
    throw new BadRequestError("BAD_SETTING", "boardWatcher.json isn't valid JSON.");
  }
}

async function patchRaw(mutate: (raw: RawConfig) => void): Promise<void> {
  const raw = await readRaw();
  mutate(raw);
  const tmp = `${BOARD_WATCHER_CONFIG_FILE}.tmp-${process.pid}`;
  await writeFile(tmp, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
  await rename(tmp, BOARD_WATCHER_CONFIG_FILE);
}

function secretState(name: SecretName): SecretState {
  return secretIsSet(name) ? secretSource(name) : "missing";
}

/** The first value that isn't empty (a blank field falls back to what's already in use). */
function firstFilled(...values: (string | undefined)[]): string {
  return values.find((value) => value?.trim())?.trim() ?? "";
}

const basicAuth = (email: string, token: string) =>
  `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;

/** What was typed, when it changes the value in use (an unchanged one stays out of the file). */
function typedChange(given: string | undefined, name: SecretName): string | undefined {
  const value = given?.trim();
  return value && value !== process.env[name] ? value : undefined;
}

/** The token given, or the one already in use when the field was left empty. */
function tokenOrCurrent(given: string | undefined, name: SecretName): string {
  const token = firstFilled(given, process.env[name]);
  if (!token) throw new BadRequestError("SETUP_MISSING_TOKEN", "Paste the API token.");
  return token;
}

function cleanSite(site: string): string {
  const host = site
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  if (!/^[\w.-]+\.[a-z]{2,}$/i.test(host)) {
    throw new BadRequestError("SETUP_BAD_SITE", "Use the Jira site, e.g. company.atlassian.net.");
  }
  return host;
}

export async function getSetupStatus(): Promise<AutomationSetupStatus> {
  const raw = await readRaw();
  const claude = await execFileAsync("claude", ["--version"], {
    timeout: 10_000,
    env: sanitizedSpawnEnv(),
  }).then(
    ({ stdout }) => ({ installed: true, version: stdout.trim() || null }),
    () => ({ installed: false, version: null }),
  );
  return {
    claude,
    jira: {
      site: raw.jira?.site ?? null,
      email: process.env.JIRA_EMAIL ?? null,
      token: secretState("JIRA_API_TOKEN"),
      me: raw.me ?? null,
    },
    board: {
      boardId: raw.jira?.boardId ?? null,
      boardUrl: raw.jira?.boardUrl ?? null,
      columns: raw.columns ?? null,
    },
    bitbucket: {
      workspace: raw.bitbucket?.workspace ?? null,
      email: process.env.BITBUCKET_EMAIL ?? null,
      token: secretState("BITBUCKET_TOKEN"),
    },
    extras: {
      teams: secretState("TEAMS_WEBHOOK_URL"),
      jenkinsUser: secretState("JENKINS_USER"),
      jenkinsUserId: process.env.JENKINS_USER ?? null,
      jenkinsToken: secretState("JENKINS_TOKEN"),
    },
    secretFiles: Object.fromEntries(
      SECRET_NAMES.flatMap((name) => {
        const file = secretShellFile(name);
        return file ? [[name, file]] : [];
      }),
    ),
    features: featuresOf(raw as Partial<BoardWatcherConfig>),
    enabled: raw.enabled === true,
  };
}

/** Step "Jira": checks the token and finds the account id (`me`). */
export async function setupJira(input: {
  site?: string;
  email?: string;
  token?: string;
}): Promise<{ displayName: string; accountId: string }> {
  const site = cleanSite(input.site ?? "");
  const email = firstFilled(input.email, process.env.JIRA_EMAIL);
  if (!email) throw new BadRequestError("SETUP_MISSING_EMAIL", "Fill in your Jira e-mail.");
  const token = tokenOrCurrent(input.token, "JIRA_API_TOKEN");
  const base = await jiraApiBase(site, email, token).catch(() => null);
  const response =
    base &&
    (await apiFetch("jira", `${base}/rest/api/3/myself`, {
      headers: { Authorization: basicAuth(email, token), Accept: "application/json" },
    }).catch(() => null));
  if (!response) throw new BadRequestError("SETUP_UNREACHABLE", `Couldn't reach ${site}.`);
  if (response.status === 401) {
    throw new BadRequestError("SETUP_BAD_CREDENTIALS", "Jira refused this e-mail and token.");
  }
  if (response.status === 403) throw missingJiraScopes();
  if (!response.ok)
    throw new BadRequestError("SETUP_UNREACHABLE", `Jira answered ${response.status}.`);
  const me = (await response.json()) as { accountId: string; displayName: string };
  // A token with scopes can read the account and still miss the issues.
  const search = await apiFetch(
    "jira",
    `${base}/rest/api/3/search/jql?jql=order%20by%20created&maxResults=1&fields=summary`,
    {
      headers: { Authorization: basicAuth(email, token), Accept: "application/json" },
    },
  ).catch(() => null);
  if (search?.status === 401 || search?.status === 403) throw missingJiraScopes();
  await saveSecrets({
    JIRA_EMAIL: typedChange(input.email, "JIRA_EMAIL"),
    JIRA_API_TOKEN: typedChange(input.token, "JIRA_API_TOKEN"),
  });
  await patchRaw((raw) => {
    raw.me = me.accountId;
    raw.jira = { scopeJql: "", ...raw.jira, site };
  });
  return { displayName: me.displayName, accountId: me.accountId };
}

const missingJiraScopes = () =>
  new BadRequestError(
    "SETUP_JIRA_SCOPES",
    "This Jira token is missing scopes the automations need.",
  );

function jiraEnvCredentials(): { email: string; token: string } {
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  if (!email || !token) throw new BadRequestError("SETUP_JIRA_FIRST", "Set up Jira first.");
  return { email, token };
}

/** Which role a column name looks like, for the first guess (the user fixes the rest). */
const ROLE_PATTERNS: [BoardRole, RegExp][] = [
  ["codeReview", /code ?review|revis/i],
  ["waitTest", /wait(ing)? ?(for )?test|aguardando ?teste|ready (for|to) test/i],
  ["testing", /^test(ing|e|ando)?$|em teste|qa\b/i],
  ["inProgress", /progress|andamento|doing|desenvolv/i],
  ["deploying", /deploy|valida|homolog|ready for (deploy|release)|release/i],
  ["todo", /to ?do|a fazer|backlog|selected/i],
];

export function guessRoles(columns: BoardColumn[]): Partial<Record<BoardRole, string[]>> {
  const suggested: Partial<Record<BoardRole, string[]>> = {};
  for (const column of columns) {
    const role = ROLE_PATTERNS.find(([, pattern]) => pattern.test(column.name))?.[0];
    if (role) suggested[role] = [...(suggested[role] ?? []), column.name];
  }
  return suggested;
}

export function boardIdOf(input: string): number {
  const match = /boards\/(\d+)/.exec(input) ?? /^\s*(\d+)\s*$/.exec(input);
  const id = Number(match?.[1]);
  if (!Number.isInteger(id) || id <= 0) {
    throw new BadRequestError("SETUP_BAD_BOARD", "Paste the board's link (…/boards/<number>).");
  }
  return id;
}

async function boardConfiguration(site: string, boardId: number) {
  const { email, token } = jiraEnvCredentials();
  const response = await jiraApiBase(site, email, token)
    .then((base) =>
      apiFetch("jira", `${base}/rest/agile/1.0/board/${boardId}/configuration`, {
        headers: { Authorization: basicAuth(email, token), Accept: "application/json" },
      }),
    )
    .catch(() => null);
  if (response?.status === 401 || response?.status === 403) throw missingJiraScopes();
  if (!response?.ok) {
    throw new BadRequestError(
      "SETUP_BAD_BOARD",
      response?.status === 404 ? "No board with this number." : "Couldn't read this board.",
    );
  }
  return (await response.json()) as {
    name: string;
    filter?: { id: string };
    columnConfig: { columns: { name: string; statuses: { id: string }[] }[] };
  };
}

/** Step "Board": its columns, with a first guess of which is which. */
export async function readBoardColumns(board: string): Promise<BoardColumnsAnswer> {
  const raw = await readRaw();
  const site = raw.jira?.site;
  if (!site) throw new BadRequestError("SETUP_JIRA_FIRST", "Set up Jira first.");
  const boardId = boardIdOf(board);
  const configuration = await boardConfiguration(site, boardId);
  const columns = configuration.columnConfig.columns.map((c) => ({
    name: c.name,
    statusIds: c.statuses.map((s) => s.id),
  }));
  // The saved mapping, when it's this board, beats the guess.
  const saved =
    raw.jira?.boardId === boardId && raw.columns
      ? Object.fromEntries(
          BOARD_ROLES.map((role) => [
            role,
            columns
              .filter((c) => c.statusIds.some((id) => raw.columns?.[role]?.includes(id)))
              .map((c) => c.name),
          ]),
        )
      : null;
  return {
    boardId,
    boardName: configuration.name,
    columns,
    suggested: saved ?? guessRoles(columns),
  };
}

export async function saveBoardColumns(input: {
  board: string;
  mapping: Partial<Record<BoardRole, string[]>>;
}): Promise<void> {
  const raw = await readRaw();
  const site = raw.jira?.site;
  if (!site) throw new BadRequestError("SETUP_JIRA_FIRST", "Set up Jira first.");
  const boardId = boardIdOf(input.board);
  const configuration = await boardConfiguration(site, boardId);
  const byName = new Map(
    configuration.columnConfig.columns.map((c) => [c.name, c.statuses.map((s) => s.id)]),
  );
  const columns = Object.fromEntries(
    BOARD_ROLES.map((role) => [
      role,
      (input.mapping[role] ?? []).flatMap((name) => byName.get(name) ?? []),
    ]),
  ) as Record<BoardRole, string[]>;
  if (columns.codeReview.length === 0) {
    throw new BadRequestError("SETUP_NO_CODE_REVIEW", "Pick the Code Review column.");
  }
  await patchRaw((next) => {
    next.columns = columns;
    next.testingStatusId = columns.testing[0] ?? "";
    if (columns.inProgress[0]) next.inProgressStatusId = columns.inProgress[0];
    else delete next.inProgressStatusId;
    const boardUrl = input.board.includes("/") ? input.board.trim() : next.jira?.boardUrl;
    next.jira = {
      ...next.jira,
      site,
      boardId,
      ...(boardUrl ? { boardUrl } : {}),
      // The board's own filter, unless a narrower one was written by hand.
      scopeJql: firstFilled(
        next.jira?.scopeJql,
        configuration.filter ? `filter = ${configuration.filter.id}` : undefined,
      ),
    };
  });
}

/** Step "Bitbucket": checks the token can read the workspace. */
export async function setupBitbucket(input: {
  workspace?: string;
  email?: string;
  token?: string;
}): Promise<{ displayName: string }> {
  const workspace = input.workspace
    ?.trim()
    .replace(/^.*bitbucket\.org\//, "")
    .replace(/\/.*$/, "");
  if (!workspace) throw new BadRequestError("SETUP_BAD_WORKSPACE", "Fill in the workspace.");
  const email = firstFilled(input.email, process.env.BITBUCKET_EMAIL, process.env.JIRA_EMAIL);
  if (!email) throw new BadRequestError("SETUP_MISSING_EMAIL", "Fill in your Bitbucket e-mail.");
  const token = tokenOrCurrent(input.token, "BITBUCKET_TOKEN");
  const headers = { Authorization: basicAuth(email, token), Accept: "application/json" };
  const user = await apiFetch("bitbucket", "https://api.bitbucket.org/2.0/user", { headers }).catch(
    () => null,
  );
  if (!user) throw new BadRequestError("SETUP_UNREACHABLE", "Couldn't reach Bitbucket.");
  if (user.status === 401 || user.status === 403) {
    throw new BadRequestError("SETUP_BAD_CREDENTIALS", "Bitbucket refused this e-mail and token.");
  }
  const access = await apiFetch(
    "bitbucket",
    `https://api.bitbucket.org/2.0/repositories/${encodeURIComponent(workspace)}?pagelen=1`,
    { headers },
  ).catch(() => null);
  if (!access?.ok) {
    throw new BadRequestError(
      "SETUP_BAD_WORKSPACE",
      `This token can't read the ${workspace} workspace.`,
    );
  }
  const me = (await user.json()) as { display_name?: string };
  await saveSecrets({
    BITBUCKET_EMAIL: typedChange(input.email, "BITBUCKET_EMAIL"),
    BITBUCKET_TOKEN: typedChange(input.token, "BITBUCKET_TOKEN"),
  });
  await patchRaw((raw) => {
    raw.bitbucket = { ...raw.bitbucket, workspace };
  });
  return { displayName: me.display_name ?? email };
}

/** Step "Notices" (optional): the Teams workflow URL and Jenkins user/token; "" removes one. */
export async function saveExtras(input: {
  teamsWebhook?: string;
  jenkinsUser?: string;
  jenkinsToken?: string;
}): Promise<void> {
  const webhook = input.teamsWebhook?.trim();
  if (webhook && !webhook.startsWith("https://")) {
    throw new BadRequestError("SETUP_BAD_WEBHOOK", "The Teams workflow URL is an https:// link.");
  }
  await saveSecrets({
    TEAMS_WEBHOOK_URL: webhook,
    JENKINS_USER: input.jenkinsUser?.trim(),
    JENKINS_TOKEN: input.jenkinsToken?.trim(),
  });
}

/** Last step: turns the watcher on with the automations chosen. */
export async function finishSetup(input: SetupFinishInput): Promise<void> {
  const raw = await readRaw();
  if (!raw.me || !raw.jira?.site)
    throw new BadRequestError("SETUP_JIRA_FIRST", "Set up Jira first.");
  if (!raw.columns?.codeReview?.length) {
    throw new BadRequestError("SETUP_NO_CODE_REVIEW", "Map the board's columns first.");
  }
  await assertReviewSkillFor(input.features);
  await patchRaw((next) => {
    next.enabled = true;
    writeSwitches(next, input.features);
  });
}
