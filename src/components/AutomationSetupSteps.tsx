import {
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Info,
  Loader2,
  Search,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLanguage } from "../hooks/useLanguage";
import type { TranslationKey } from "../i18n/translations";
import * as boardWatcherApi from "../services/boardWatcherApi";
import * as preferencesApi from "../services/preferencesApi";
import type {
  AutomationSetupStatus,
  BitbucketRepoOption,
  BoardColumnsAnswer,
  BoardRole,
  SecretState,
} from "../services/boardWatcherApi";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { jenkinsBase } from "../utils/jenkins";
import { Button } from "./Button";
import { Input } from "./Input";
import {
  applySwitches,
  MODE_AUTOMATIONS,
  switchesForMode,
  type ModeAutomation,
  type Switches,
} from "../../shared/automationModes";
import { AutomationModesEditor } from "./AutomationModesEditor";

type StepProps = {
  status: AutomationSetupStatus;
  onDone: () => Promise<void>;
  onBack?: () => void;
};

const ATLASSIAN_TOKENS_URL = "https://id.atlassian.com/manage-profile/security/api-tokens";

const ROLES: BoardRole[] = ["todo", "inProgress", "codeReview", "waitTest", "testing", "deploying"];

const ROLE_LABELS: Record<BoardRole, TranslationKey> = {
  todo: "automationSetup.role.todo",
  inProgress: "automationSetup.role.inProgress",
  codeReview: "automationSetup.role.codeReview",
  waitTest: "automationSetup.role.waitTest",
  testing: "automationSetup.role.testing",
  deploying: "automationSetup.role.deploying",
};

/** Runs a step's save with its loading and error state. */
function useStepAction() {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(resolveApiErrorMessage(err, t, "automationSetup.saveError"));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

function Description({ children }: { children: ReactNode }) {
  return <p className="text-sm text-gray-600 dark:text-gray-400">{children}</p>;
}

function Field({
  id,
  label,
  help,
  children,
}: {
  id: string;
  label: string;
  help?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      {children}
      {help && <div className="text-xs text-gray-500 dark:text-gray-400">{help}</div>}
    </div>
  );
}

function HowTo({ text, href }: { text: string; href?: string }) {
  const { t } = useLanguage();
  return (
    <span className="flex items-start gap-1">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>
        {text}{" "}
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 font-medium text-violet-600 underline-offset-2 hover:underline dark:text-violet-400"
          >
            {t("automationSetup.howTo")}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        )}
      </span>
    </span>
  );
}

const TEAMS_STEPS: TranslationKey[] = [
  "automationSetup.extras.teamsHelp.step1",
  "automationSetup.extras.teamsHelp.step2",
  "automationSetup.extras.teamsHelp.step3",
  "automationSetup.extras.teamsHelp.step4",
  "automationSetup.extras.teamsHelp.step5",
];

const JENKINS_STEPS: TranslationKey[] = [
  "automationSetup.extras.jenkinsHelp.step1",
  "automationSetup.extras.jenkinsHelp.step2",
  "automationSetup.extras.jenkinsHelp.step3",
  "automationSetup.extras.jenkinsHelp.step4",
  "automationSetup.extras.jenkinsHelp.step5",
];

/** A numbered how-to, folded until asked for. */
function StepsHowTo({
  title,
  intro,
  steps,
  after,
  link,
  warning,
}: {
  title: string;
  intro: string;
  steps: string[];
  after?: string;
  link?: { href: string; label: string } | null;
  warning?: string;
}) {
  return (
    <details className="group mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs dark:border-gray-800 dark:bg-gray-800/50">
      <summary className="flex cursor-pointer list-none items-center gap-1 font-medium text-violet-600 dark:text-violet-400 [&::-webkit-details-marker]:hidden">
        <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {title}
        <ChevronDown
          className="h-3.5 w-3.5 transition-transform group-open:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </summary>
      <div className="mt-2 flex flex-col gap-2 text-gray-600 dark:text-gray-400">
        <p>{intro}</p>
        <ol className="list-decimal space-y-1 pl-4">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        {link && (
          <a
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 self-start font-medium text-violet-600 underline-offset-2 hover:underline dark:text-violet-400"
          >
            {link.label}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        )}
        {after && <p>{after}</p>}
        {warning && <p className="text-amber-700 dark:text-amber-400">{warning}</p>}
      </div>
    </details>
  );
}

function TeamsHowTo() {
  const { t } = useLanguage();
  return (
    <StepsHowTo
      title={t("automationSetup.extras.teamsHelp.title")}
      intro={t("automationSetup.extras.teamsHelp.intro")}
      steps={TEAMS_STEPS.map((key) => t(key))}
      after={t("automationSetup.extras.teamsHelp.lost")}
      warning={t("automationSetup.extras.teamsHelp.secret")}
    />
  );
}

/**
 * A token field: says where the one in use comes from; empty keeps it, anything pasted replaces
 * it (saved by the panel, which wins over the environment and the shell files).
 */
function SecretField({
  id,
  label,
  state,
  variable,
  file,
  value,
  onChange,
  help,
}: {
  id: string;
  label: string;
  state: SecretState;
  /** The environment variable it's read from (`JIRA_API_TOKEN`…). */
  variable: string;
  /** The shell file it was read from, when `state` is `shell`. */
  file?: string;
  value: string;
  onChange: (value: string) => void;
  help?: ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <Field
      id={id}
      label={label}
      help={
        <>
          {state === "saved" && <p>{t("automationSetup.secret.saved")}</p>}
          {state === "environment" && (
            <p>{t("automationSetup.secret.environment", { variable })}</p>
          )}
          {state === "shell" && (
            <p>{t("automationSetup.secret.shell", { variable, file: file ?? "~/.zshrc" })}</p>
          )}
          {help}
        </>
      }
    >
      <Input
        id={id}
        type="password"
        autoComplete="off"
        spellCheck={false}
        value={value}
        placeholder={state === "missing" ? "" : "••••••••"}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

function Feedback({ error, ok }: { error: string | null; ok?: string | null }) {
  if (error) {
    return (
      <p role="alert" className="flex items-start gap-1.5 text-sm text-red-600 dark:text-red-400">
        <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {error}
      </p>
    );
  }
  if (ok) {
    return (
      <p className="flex items-start gap-1.5 text-sm text-green-700 dark:text-green-400">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {ok}
      </p>
    );
  }
  return null;
}

function Actions({
  onBack,
  primaryLabel,
  onPrimary,
  busy,
  disabled,
  extra,
}: {
  onBack?: () => void;
  primaryLabel: string;
  onPrimary: () => void;
  busy: boolean;
  disabled?: boolean;
  extra?: ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
      <div>
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack} disabled={busy}>
            {t("automationSetup.back")}
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {extra}
        <Button
          size="sm"
          onClick={onPrimary}
          disabled={busy || disabled}
          icon={busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : undefined}
        >
          {primaryLabel}
        </Button>
      </div>
    </div>
  );
}

export function ClaudeStep({
  status,
  onDone,
  onBack,
  onRecheck,
}: StepProps & { onRecheck: () => void }) {
  const { t } = useLanguage();
  const { installed, version } = status.claude;
  return (
    <div className="flex flex-col gap-3">
      <Description>{t("automationSetup.claude.description")}</Description>
      <Feedback
        error={installed ? null : t("automationSetup.claude.missing")}
        ok={installed ? t("automationSetup.claude.ok", { version: version ?? "claude" }) : null}
      />
      <Actions
        onBack={onBack}
        primaryLabel={installed ? t("automationSetup.next") : t("automationSetup.claude.recheck")}
        onPrimary={() => (installed ? void onDone() : onRecheck())}
        busy={false}
      />
    </div>
  );
}

export function JiraStep({ status, onDone, onBack }: StepProps) {
  const { t } = useLanguage();
  const [site, setSite] = useState(status.jira.site ?? "");
  const [email, setEmail] = useState(status.jira.email ?? "");
  const [token, setToken] = useState("");
  const [connectedAs, setConnectedAs] = useState<string | null>(null);
  const { busy, error, run } = useStepAction();

  const submit = () =>
    void run(async () => {
      const me = await boardWatcherApi.setupJira({ site, email, token });
      setConnectedAs(me.displayName);
      setToken("");
      await onDone();
    });

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Description>{t("automationSetup.jira.description")}</Description>
      <Field id="setup-jira-site" label={t("automationSetup.jira.site")}>
        <Input
          id="setup-jira-site"
          value={site}
          placeholder="empresa.atlassian.net"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setSite(event.target.value)}
        />
      </Field>
      <Field id="setup-jira-email" label={t("automationSetup.jira.email")}>
        <Input
          id="setup-jira-email"
          type="email"
          value={email}
          autoComplete="email"
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>
      <SecretField
        id="setup-jira-token"
        label={t("automationSetup.jira.token")}
        state={status.jira.token}
        variable="JIRA_API_TOKEN"
        file={status.secretFiles?.JIRA_API_TOKEN}
        value={token}
        onChange={setToken}
        help={<HowTo text={t("automationSetup.jira.tokenHelp")} href={ATLASSIAN_TOKENS_URL} />}
      />
      <Feedback
        error={error}
        ok={connectedAs ? t("automationSetup.jira.ok", { name: connectedAs }) : null}
      />
      <Actions
        onBack={onBack}
        primaryLabel={t("automationSetup.saveAndContinue")}
        onPrimary={submit}
        busy={busy}
        disabled={
          !site.trim() || !email.trim() || (status.jira.token === "missing" && !token.trim())
        }
      />
    </form>
  );
}

export function BoardStep({ status, onDone, onBack }: StepProps) {
  const { t } = useLanguage();
  const [board, setBoard] = useState(
    status.board.boardUrl ?? (status.board.boardId ? String(status.board.boardId) : ""),
  );
  const [answer, setAnswer] = useState<BoardColumnsAnswer | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<BoardRole, string[]>>>({});
  const reading = useStepAction();
  const saving = useStepAction();

  const read = () =>
    void reading.run(async () => {
      const next = await boardWatcherApi.readBoardColumns(board);
      setAnswer(next);
      setMapping(next.suggested);
    });

  // A board already saved: its columns come back with the saved mapping.
  useEffect(() => {
    if (status.board.boardId) read();
    // Only on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (role: BoardRole, name: string) =>
    setMapping((current) => {
      const list = current[role] ?? [];
      return {
        ...current,
        [role]: list.includes(name) ? list.filter((n) => n !== name) : [...list, name],
      };
    });

  const save = () =>
    void saving.run(async () => {
      await boardWatcherApi.saveBoardColumns(board, mapping);
      await onDone();
    });

  return (
    <div className="flex flex-col gap-3">
      <Description>{t("automationSetup.board.description")}</Description>
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          read();
        }}
      >
        <div className="min-w-0 flex-1">
          <Field id="setup-board" label={t("automationSetup.board.link")}>
            <Input
              id="setup-board"
              value={board}
              placeholder="https://empresa.atlassian.net/jira/software/c/projects/ABC/boards/123"
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setBoard(event.target.value)}
            />
          </Field>
        </div>
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={reading.busy || !board.trim()}
          icon={reading.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : undefined}
        >
          {t("automationSetup.board.read")}
        </Button>
      </form>
      <Feedback error={reading.error} />

      {answer && (
        <>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t("automationSetup.board.found", {
              name: answer.boardName,
              count: answer.columns.length,
            })}
          </p>
          <ul className="flex flex-col gap-2">
            {ROLES.map((role) => (
              <li key={role} className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {t(ROLE_LABELS[role])}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {answer.columns.map((column) => {
                    const on = mapping[role]?.includes(column.name) ?? false;
                    return (
                      <button
                        key={column.name}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggle(role, column.name)}
                        className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 ${
                          on
                            ? "border-violet-500 bg-violet-50 font-medium text-violet-700 dark:border-violet-400 dark:bg-violet-950/50 dark:text-violet-300"
                            : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                        }`}
                      >
                        {column.name}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <Feedback error={saving.error} />
      <Actions
        onBack={onBack}
        primaryLabel={t("automationSetup.saveAndContinue")}
        onPrimary={save}
        busy={saving.busy}
        disabled={!answer || !mapping.codeReview?.length}
      />
    </div>
  );
}

export function BitbucketStep({ status, onDone, onBack }: StepProps) {
  const { t } = useLanguage();
  const [workspace, setWorkspace] = useState(status.bitbucket.workspace ?? "");
  const [email, setEmail] = useState(status.bitbucket.email ?? status.jira.email ?? "");
  const [token, setToken] = useState("");
  const [connectedAs, setConnectedAs] = useState<string | null>(null);
  const { busy, error, run } = useStepAction();

  const submit = () =>
    void run(async () => {
      const me = await boardWatcherApi.setupBitbucket({ workspace, email, token });
      setConnectedAs(me.displayName);
      setToken("");
      await onDone();
    });

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Description>{t("automationSetup.bitbucket.description")}</Description>
      <Field id="setup-bb-workspace" label={t("automationSetup.bitbucket.workspace")}>
        <Input
          id="setup-bb-workspace"
          value={workspace}
          placeholder="empresa"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setWorkspace(event.target.value)}
        />
      </Field>
      <Field id="setup-bb-email" label={t("automationSetup.bitbucket.email")}>
        <Input
          id="setup-bb-email"
          type="email"
          value={email}
          autoComplete="email"
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>
      <SecretField
        id="setup-bb-token"
        label={t("automationSetup.bitbucket.token")}
        state={status.bitbucket.token}
        variable="BITBUCKET_TOKEN"
        file={status.secretFiles?.BITBUCKET_TOKEN}
        value={token}
        onChange={setToken}
        help={<HowTo text={t("automationSetup.bitbucket.tokenHelp")} href={ATLASSIAN_TOKENS_URL} />}
      />
      <Feedback
        error={error}
        ok={connectedAs ? t("automationSetup.bitbucket.ok", { name: connectedAs }) : null}
      />
      <Actions
        onBack={onBack}
        primaryLabel={t("automationSetup.saveAndContinue")}
        onPrimary={submit}
        busy={busy}
        disabled={
          !workspace.trim() ||
          !email.trim() ||
          (status.bitbucket.token === "missing" && !token.trim())
        }
      />
    </form>
  );
}

export function ReposStep({ status, onDone, onBack }: StepProps) {
  const { t } = useLanguage();
  const [options, setOptions] = useState<BitbucketRepoOption[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set(status.bitbucket.repos));
  const [paths, setPaths] = useState<Record<string, string>>(status.bitbucket.localRepos);
  const [filter, setFilter] = useState("");
  const loading = useStepAction();
  const saving = useStepAction();

  useEffect(() => {
    void loading.run(async () => {
      const list = await boardWatcherApi.fetchBitbucketRepos();
      setOptions(list);
      setPaths((current) => {
        const next = { ...current };
        for (const option of list) {
          if (!next[option.slug] && option.localPath) next[option.slug] = option.localPath;
        }
        return next;
      });
    });
    // Only on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(() => {
    const query = filter.trim().toLowerCase();
    const list = options ?? [];
    // Selected first, then the ones with a clone here, then the rest (most recent first).
    const rank = (o: BitbucketRepoOption) => (selected.has(o.slug) ? 0 : o.localPath ? 1 : 2);
    return list
      .filter((o) => !query || o.slug.toLowerCase().includes(query))
      .sort((a, b) => rank(a) - rank(b));
  }, [options, filter, selected]);

  const toggle = (slug: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

  const save = () =>
    void saving.run(async () => {
      const repos = [...selected];
      await boardWatcherApi.saveSetupRepos(
        repos,
        Object.fromEntries(repos.map((repo) => [repo, paths[repo] ?? ""])),
      );
      await onDone();
    });

  const missingPath = [...selected].some((repo) => !paths[repo]?.trim());

  return (
    <div className="flex flex-col gap-3">
      <Description>{t("automationSetup.repos.description")}</Description>
      {loading.busy && (
        <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("automationSetup.repos.loading")}
        </p>
      )}
      <Feedback error={loading.error} />
      {options && (
        <>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <Input
                aria-label={t("automationSetup.repos.filter")}
                placeholder={t("automationSetup.repos.filter")}
                icon={<Search className="h-4 w-4" />}
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              />
            </div>
            <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
              {t("automationSetup.repos.selected", { count: selected.size })}
            </span>
          </div>
          <ul className="max-h-72 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
            {visible.map((option) => {
              const on = selected.has(option.slug);
              const id = `setup-repo-${option.slug}`;
              return (
                <li key={option.slug} className="px-3 py-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(option.slug)}
                      className="h-4 w-4 rounded border-gray-300 accent-violet-600 dark:border-gray-600"
                    />
                    <span className="font-mono text-xs">{option.slug}</span>
                  </label>
                  {on && (
                    <div className="mt-1.5 pl-6">
                      <Input
                        id={id}
                        aria-label={`${t("automationSetup.repos.localPath")}: ${option.slug}`}
                        placeholder={t("automationSetup.repos.localPath")}
                        className="py-1 font-mono text-xs"
                        value={paths[option.slug] ?? ""}
                        spellCheck={false}
                        onChange={(event) =>
                          setPaths((current) => ({ ...current, [option.slug]: event.target.value }))
                        }
                      />
                      {!paths[option.slug]?.trim() && (
                        <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                          {t("automationSetup.repos.notFound")}
                        </p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
      <Feedback error={saving.error} />
      <Actions
        onBack={onBack}
        primaryLabel={t("automationSetup.saveAndContinue")}
        onPrimary={save}
        busy={saving.busy}
        disabled={!options || selected.size === 0 || missingPath}
      />
    </div>
  );
}

export function ExtrasStep({ status, onDone, onBack, onSkip }: StepProps & { onSkip: () => void }) {
  const { t } = useLanguage();
  const [teamsWebhook, setTeamsWebhook] = useState("");
  const savedJenkinsUser = status.extras.jenkinsUserId ?? "";
  const [jenkinsUser, setJenkinsUser] = useState(savedJenkinsUser);
  const [jenkinsBaseUrl, setJenkinsBaseUrl] = useState<string | null>(null);
  const jenkinsUserChanged = jenkinsUser.trim() !== savedJenkinsUser;

  useEffect(() => {
    let cancelled = false;
    void preferencesApi
      .fetchPreferences()
      .then((prefs) => {
        if (!cancelled) setJenkinsBaseUrl(jenkinsBase(prefs.jenkinsBaseUrl));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  const [jenkinsToken, setJenkinsToken] = useState("");
  const { busy, error, run } = useStepAction();
  const nothingTyped = !teamsWebhook.trim() && !jenkinsUserChanged && !jenkinsToken.trim();

  const submit = () =>
    void run(async () => {
      await boardWatcherApi.saveSetupExtras({
        ...(teamsWebhook.trim() ? { teamsWebhook } : {}),
        ...(jenkinsUserChanged ? { jenkinsUser } : {}),
        ...(jenkinsToken.trim() ? { jenkinsToken } : {}),
      });
      await onDone();
    });

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Description>{t("automationSetup.extras.description")}</Description>
      <SecretField
        id="setup-teams"
        label={t("automationSetup.extras.teams")}
        state={status.extras.teams}
        variable="TEAMS_WEBHOOK_URL"
        file={status.secretFiles?.TEAMS_WEBHOOK_URL}
        value={teamsWebhook}
        onChange={setTeamsWebhook}
        help={<TeamsHowTo />}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          id="setup-jenkins-user"
          label={t("automationSetup.extras.jenkinsUser")}
          help={
            status.extras.jenkinsUser === "environment"
              ? t("automationSetup.secret.environment", { variable: "JENKINS_USER" })
              : t("automationSetup.extras.jenkinsUser.help")
          }
        >
          <Input
            id="setup-jenkins-user"
            value={jenkinsUser}
            autoComplete="username"
            spellCheck={false}
            placeholder="seu.id"
            onChange={(event) => setJenkinsUser(event.target.value)}
          />
        </Field>
        <SecretField
          id="setup-jenkins-token"
          label={t("automationSetup.extras.jenkinsToken")}
          state={status.extras.jenkinsToken}
          variable="JENKINS_TOKEN"
          file={status.secretFiles?.JENKINS_TOKEN}
          value={jenkinsToken}
          onChange={setJenkinsToken}
        />
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400">
        <StepsHowTo
          title={t("automationSetup.extras.jenkinsHelp.title")}
          intro={t("automationSetup.extras.jenkinsHelp.intro")}
          steps={JENKINS_STEPS.map((key) => t(key))}
          link={
            jenkinsBaseUrl
              ? { href: jenkinsBaseUrl, label: t("automationSetup.extras.jenkinsHelp.open") }
              : null
          }
          warning={t("automationSetup.extras.jenkinsHelp.secret")}
        />
      </div>
      <Feedback error={error} />
      <Actions
        onBack={onBack}
        primaryLabel={
          nothingTyped ? t("automationSetup.next") : t("automationSetup.saveAndContinue")
        }
        onPrimary={nothingTyped ? onSkip : submit}
        busy={busy}
      />
    </form>
  );
}

export function FinishStep({
  status,
  onDone,
  onBack,
  allDone,
  onClose,
}: StepProps & { allDone: Record<string, boolean>; onClose: () => void }) {
  const { t } = useLanguage();
  // What an automation needs from the steps before; without it, it stays off.
  const unavailable: Partial<Record<ModeAutomation | "notices", string>> = {
    ...(status.board.columns?.todo?.length ? {} : { devQueue: t("automationSetup.needs.todo") }),
    ...(status.board.columns?.waitTest?.length && status.board.columns.testing?.length
      ? {}
      : { testQueue: t("automationSetup.needs.testColumns") }),
    ...(status.extras.jenkinsUser !== "missing" && status.extras.jenkinsToken !== "missing"
      ? {}
      : { rebuild: t("automationSetup.needs.jenkins") }),
    ...(status.extras.teams !== "missing" ? {} : { notices: t("automationSetup.needs.teams") }),
  };
  // A first setup starts with only the code review, in simulation; later visits show what's saved.
  const [draft, setDraft] = useState<Switches>(() => {
    const saved = { features: status.features, live: status.live };
    if (status.enabled) return saved;
    let first = saved;
    for (const automation of MODE_AUTOMATIONS) {
      first = applySwitches(
        first,
        switchesForMode(automation, automation === "codeReview" ? "simulate" : "off"),
      );
    }
    const notices = status.extras.teams !== "missing";
    return applySwitches(first, {
      features: { instantNotices: notices, digest: notices, reviewUnapprovedDeploying: false },
      live: {},
    });
  });
  const [finished, setFinished] = useState(false);
  const [betaOn, setBetaOn] = useState(true);
  const { busy, error, run } = useStepAction();
  const requiredDone = ["claude", "jira", "board", "bitbucket", "repos"].every((s) => allDone[s]);

  const submit = () =>
    void run(async () => {
      // What isn't available is saved off, whatever the draft says.
      let chosen = draft;
      for (const automation of MODE_AUTOMATIONS) {
        if (unavailable[automation]) {
          chosen = applySwitches(chosen, switchesForMode(automation, "off"));
        }
      }
      if (unavailable.notices) {
        chosen = applySwitches(chosen, {
          features: { instantNotices: false, digest: false },
          live: {},
        });
      }
      await boardWatcherApi.finishSetup(chosen);
      const watcher = await boardWatcherApi.fetchBoardWatcherStatus().catch(() => null);
      setBetaOn(watcher !== null);
      setFinished(true);
      await onDone();
    });

  return (
    <div className="flex flex-col gap-3">
      <Description>{t("automationSetup.finish.description")}</Description>
      <AutomationModesEditor
        switches={draft}
        unavailable={unavailable}
        disabled={finished}
        onChange={(input) => setDraft((current) => applySwitches(current, input))}
      />
      <Feedback
        error={error}
        ok={
          finished
            ? betaOn
              ? t("automationSetup.finish.done")
              : t("automationSetup.finish.betaOff")
            : null
        }
      />
      <Actions
        onBack={onBack}
        primaryLabel={
          finished
            ? t("automationSetup.close")
            : status.enabled
              ? t("automationSetup.finish.save")
              : t("automationSetup.finish.turnOn")
        }
        onPrimary={finished ? onClose : submit}
        busy={busy}
        disabled={!finished && !requiredDone}
      />
    </div>
  );
}
