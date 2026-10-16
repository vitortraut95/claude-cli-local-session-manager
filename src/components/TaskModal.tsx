import {
  Check,
  Copy,
  ExternalLink,
  GitBranch,
  Layers,
  Link2,
  Loader2,
  Plus,
  Tag,
  Unlink,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useCopyFeedback } from "../hooks/useCopyFeedback";
import { useLanguage } from "../hooks/useLanguage";
import { useProjectFolders } from "../hooks/useProjectFolders";
import { useToast } from "../hooks/useToast";
import type { TranslationKey } from "../i18n/translations";
import * as sessionsApi from "../services/sessionsApi";
import * as tasksApi from "../services/tasksApi";
import type { Session } from "../types/session";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { resolveSessionBranches } from "../utils/sessionBranches";
import { Button } from "./Button";
import { Input } from "./Input";
import { Modal } from "./Modal";
import { ProjectFolderField } from "./ProjectFolderField";

type TaskModalProps = {
  session: Session;
  /** Opens with the "add repo" form already expanded (the card's "+" next to the task line). */
  startAddingRepo?: boolean;
  onClose: () => void;
  /** Something about the task changed — the session list should refetch. */
  onChanged: () => void;
  onSetNickname: (nickname: string) => void;
  onSetBranches: (origin: string, destination: string) => void;
};

const SECTION_CLASSNAME = "rounded-lg border border-gray-200 p-3 dark:border-gray-800 [&+&]:mt-4";
const SECTION_TITLE_CLASSNAME =
  "mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-gray-200";
const LABEL_CLASSNAME = "flex flex-col gap-1 text-xs font-medium text-gray-500 dark:text-gray-400";
const CHECKBOX_CLASSNAME = "mt-0.5 h-4 w-4 shrink-0 accent-gray-900 dark:accent-gray-100";
const TEXTAREA_CLASSNAME =
  "w-full rounded-lg border border-gray-300 bg-white p-2 text-sm text-gray-900 placeholder:text-gray-400 " +
  "focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 " +
  "dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:ring-gray-100/10";

const STEP_LABEL_KEYS: Record<tasksApi.AddRepoStep, TranslationKey> = {
  repo: "newTaskModal.step.repo",
  base: "newTaskModal.step.base",
  worktree: "newTaskModal.step.worktree",
  link: "taskModal.step.link",
  launch: "newTaskModal.step.launch",
};

type AddRepoOutcome =
  | { ok: true; result: tasksApi.AddRepoResult }
  | {
      ok: false;
      message: string;
      failedStep?: tasksApi.AddRepoStep;
      completedSteps: tasksApi.AddRepoStep[];
    };

/**
 * Everything this app keeps about a session's task, editable in one place (all of it lives in
 * `tasks.json`): the task key/link, the session's nickname and base/task branches, the task's
 * repos (unlink, copy an `/add-dir` command) and adding another repo to it — the same
 * `POST /tasks/by-key/:key/repos` a CLI skill calls. Mounted only while open, like NicknameModal,
 * so every field starts fresh from the session.
 */
export function TaskModal({
  session,
  startAddingRepo = false,
  onClose,
  onChanged,
  onSetNickname,
  onSetBranches,
}: TaskModalProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { copiedKey, copy } = useCopyFeedback();
  const branches = resolveSessionBranches(session);

  // The key in effect right now — the session prop only catches up after the list refetches.
  const [taskKey, setTaskKey] = useState<string | null>(session.taskKey ?? null);
  const [task, setTask] = useState<tasksApi.TaskDetails | null>(null);
  const [loadingTask, setLoadingTask] = useState(false);

  const [keyInput, setKeyInput] = useState(session.taskKey ?? "");
  const [linkInput, setLinkInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);

  const [nickname, setNickname] = useState(session.nickname ?? "");
  const [origin, setOrigin] = useState(branches.origin ?? "");
  const [destination, setDestination] = useState(branches.destination ?? "");

  const loadTask = useCallback(
    async (key: string | null) => {
      if (!key) {
        setTask(null);
        return;
      }
      setLoadingTask(true);
      try {
        const details = await tasksApi.fetchTask(key);
        setTask(details);
        setLinkInput((current) => current || (details.link ?? ""));
      } catch (err) {
        showToast(resolveApiErrorMessage(err, t, "taskModal.loadError"), "error");
      } finally {
        setLoadingTask(false);
      }
    },
    [showToast, t],
  );

  useEffect(() => {
    const timer = setTimeout(() => void loadTask(session.taskKey ?? null), 0);
    return () => clearTimeout(timer);
  }, [loadTask, session.taskKey]);

  const saveTaskKey = async (value: string | null) => {
    setSavingKey(true);
    try {
      await sessionsApi.setSessionTask(session.id, value, linkInput.trim());
      const nextKey = value === null ? null : value.trim() ? value.trim().toUpperCase() : null;
      // A pasted URL is normalized server-side; the refetched list has the canonical key.
      setTaskKey(nextKey && /^[A-Z][A-Z0-9]+-\d+$/.test(nextKey) ? nextKey : null);
      showToast(t("taskModal.taskSaved"), "success");
      onChanged();
      if (nextKey && /^[A-Z][A-Z0-9]+-\d+$/.test(nextKey)) await loadTask(nextKey);
      else setTask(null);
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "taskModal.saveError"), "error");
    } finally {
      setSavingKey(false);
    }
  };

  const saveSessionFields = () => {
    if (nickname.trim() !== (session.nickname ?? "")) onSetNickname(nickname);
    if (
      origin.trim() !== (branches.origin ?? "") ||
      destination.trim() !== (branches.destination ?? "")
    ) {
      onSetBranches(origin, destination);
    }
  };

  const unlinkRepo = async (repo: tasksApi.TaskRepo) => {
    if (!taskKey) return;
    try {
      await tasksApi.unlinkTaskRepo(taskKey, repo.repoRoot, repo.branch);
      onChanged();
      await loadTask(taskKey);
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "taskModal.saveError"), "error");
    }
  };

  const copyText = async (text: string) => {
    try {
      await copy(text);
    } catch {
      showToast(t("sessionCard.copyCommand.error"), "error");
    }
  };

  const otherRepos = (task?.repos ?? []).filter(
    (repo) => !(repo.repoRoot === session.repoRoot && repo.branch === session.gitBranch),
  );

  return (
    <Modal
      open
      title={t("taskModal.title")}
      icon={<Layers className="h-5 w-5" />}
      onClose={onClose}
      size="lg"
    >
      <section className={SECTION_CLASSNAME}>
        <h3 className={SECTION_TITLE_CLASSNAME}>
          <Tag className="h-4 w-4" /> {t("taskModal.taskSection")}
        </h3>
        {session.taskKeyInferred && taskKey === session.taskKey && (
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
            {t("taskModal.inferredNote")}
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={LABEL_CLASSNAME}>
            {t("taskModal.keyLabel")}
            <Input
              type="text"
              icon={<Tag className="h-4 w-4" />}
              value={keyInput}
              onChange={(event) => setKeyInput(event.target.value)}
              placeholder="PROJ-123"
            />
          </label>
          <label className={LABEL_CLASSNAME}>
            {t("taskModal.linkLabel")}
            <Input
              type="text"
              icon={<Link2 className="h-4 w-4" />}
              value={linkInput}
              onChange={(event) => setLinkInput(event.target.value)}
              placeholder="https://jira.example.com/browse/PROJ-123"
            />
          </label>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => void saveTaskKey(keyInput)}
            disabled={savingKey || !keyInput.trim()}
            icon={savingKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : undefined}
          >
            {t("taskModal.saveTask")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void saveTaskKey("")}
            disabled={savingKey}
          >
            {t("taskModal.noTask")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void saveTaskKey(null)}
            disabled={savingKey}
          >
            {t("taskModal.inferTask")}
          </Button>
        </div>
      </section>

      <section className={SECTION_CLASSNAME}>
        <h3 className={SECTION_TITLE_CLASSNAME}>
          <GitBranch className="h-4 w-4" /> {t("taskModal.sessionSection")}
        </h3>
        <div className="grid gap-2">
          <label className={LABEL_CLASSNAME}>
            {t("taskModal.nicknameLabel")}
            <Input
              type="text"
              value={nickname}
              onChange={(event) => setNickname(event.target.value.replace(/\s*[\r\n]+\s*/g, " "))}
            />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className={LABEL_CLASSNAME}>
              {t("sessionBranchesModal.origin")}
              <Input
                type="text"
                icon={<GitBranch className="h-4 w-4" />}
                value={origin}
                onChange={(event) => setOrigin(event.target.value)}
              />
            </label>
            <label className={LABEL_CLASSNAME}>
              {t("sessionBranchesModal.destination")}
              <Input
                type="text"
                icon={<GitBranch className="h-4 w-4" />}
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
              />
            </label>
          </div>
        </div>
        <div className="mt-2">
          <Button size="sm" onClick={saveSessionFields}>
            {t("taskModal.saveSession")}
          </Button>
        </div>
      </section>

      {taskKey && (
        <section className={SECTION_CLASSNAME}>
          <h3 className={SECTION_TITLE_CLASSNAME}>
            <Layers className="h-4 w-4" /> {t("taskModal.reposSection", { key: taskKey })}
            {loadingTask && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
          </h3>
          {task?.repos.length === 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{t("taskModal.noRepos")}</p>
          )}
          <ul className="space-y-2">
            {(task?.repos ?? []).map((repo) => {
              const id = `${repo.repoRoot}\0${repo.branch}`;
              const isThis =
                repo.repoRoot === session.repoRoot && repo.branch === session.gitBranch;
              const location = repo.worktreePath ?? repo.repoRoot;
              const addDir = `/add-dir ${location}`;
              return (
                <li
                  key={id}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-md bg-gray-50 px-2 py-1.5 text-xs dark:bg-gray-800/50"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 dark:text-gray-200">
                      {repo.project} · <span className="font-mono">{repo.branch}</span>
                      {isThis && (
                        <span className="ml-1 text-gray-500 dark:text-gray-400">
                          ({t("taskModal.thisSession")})
                        </span>
                      )}
                    </p>
                    <p className="text-gray-500 dark:text-gray-400">
                      {t("sessionCard.branches.originLabel")}{" "}
                      {repo.baseBranch ?? repo.defaultBranch ?? "—"} ·{" "}
                      {repo.sessionIds.length === 1
                        ? t("taskModal.sessionCount.one", { count: 1 })
                        : t("taskModal.sessionCount.many", { count: repo.sessionIds.length })}
                    </p>
                    <p className="break-all font-mono text-[11px] text-gray-400 dark:text-gray-500">
                      {location}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!isThis && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void copyText(addDir)}
                        icon={
                          copiedKey === addDir ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )
                        }
                      >
                        {t("taskModal.copyAddDir")}
                      </Button>
                    )}
                    {repo.recorded && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void unlinkRepo(repo)}
                        icon={<Unlink className="h-3.5 w-3.5" />}
                      >
                        {t("taskModal.unlink")}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <AddRepoForm
            taskKey={taskKey}
            taskLink={linkInput.trim()}
            defaultBranch={otherRepos[0]?.branch ?? branches.destination ?? ""}
            startOpen={startAddingRepo}
            pinSessionKey={Boolean(session.taskKeyInferred) && taskKey === session.taskKey}
            sessionId={session.id}
            onAdded={async () => {
              onChanged();
              await loadTask(taskKey);
            }}
            onCopy={copyText}
            copiedKey={copiedKey}
          />
        </section>
      )}
    </Modal>
  );
}

type AddRepoFormProps = {
  taskKey: string;
  taskLink: string;
  defaultBranch: string;
  startOpen: boolean;
  /** The session's key is only inferred — adding a repo pins it, so the task can't silently
   *  lose this session if its branch/nickname changes later. */
  pinSessionKey: boolean;
  sessionId: string;
  onAdded: () => Promise<void>;
  onCopy: (text: string) => Promise<void>;
  copiedKey: string | null;
};

function AddRepoForm({
  taskKey,
  taskLink,
  defaultBranch,
  startOpen,
  pinSessionKey,
  sessionId,
  onAdded,
  onCopy,
  copiedKey,
}: AddRepoFormProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [open, setOpen] = useState(startOpen);
  const folders = useProjectFolders(open);
  const folder = folders.effectiveFolderPath.trim();

  const [mode, setMode] = useState<"create" | "link-existing">("create");
  const [branchName, setBranchName] = useState(defaultBranch);
  const [baseBranch, setBaseBranch] = useState("");
  const [defaultBase, setDefaultBase] = useState<string | null>(null);
  const [useLocalBranch, setUseLocalBranch] = useState(false);
  const [useWorktree, setUseWorktree] = useState(false);
  const [, setUseWorktreeTouched] = useState(false);
  const [launch, setLaunch] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [permissionModeAuto, setPermissionModeAuto] = useState(false);
  const [loadingRepoInfo, setLoadingRepoInfo] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<AddRepoOutcome | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void tasksApi
      .fetchPreferences()
      .then((prefs) => {
        if (!cancelled) setPermissionModeAuto(prefs.useAutoPermissionModeByDefault);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Same smart worktree default as "New task": only when the repo root already has an active
  // session — unless the checkbox was changed by hand for this folder.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setUseWorktreeTouched(false);
      setRepoError(null);
      setDefaultBase(null);
      if (!folder) return;
      setLoadingRepoInfo(true);
      tasksApi
        .fetchRepoInfo(folder)
        .then((info) => {
          if (cancelled) return;
          setDefaultBase(info.defaultBaseBranch);
          setUseWorktreeTouched((touched) => {
            if (!touched) setUseWorktree(info.hasActiveSessionInRoot);
            return touched;
          });
        })
        .catch((err) => {
          if (!cancelled)
            setRepoError(resolveApiErrorMessage(err, t, "newTaskModal.repoInfoError"));
        })
        .finally(() => {
          if (!cancelled) setLoadingRepoInfo(false);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [folder, t]);

  const submit = async () => {
    setSubmitting(true);
    setOutcome(null);
    try {
      const result = await tasksApi.addRepoToTask(taskKey, {
        folderPath: folder,
        mode,
        branchName: branchName.trim(),
        baseBranch: baseBranch.trim(),
        useLocalBranch,
        useWorktree,
        launch,
        prompt,
        permissionModeAuto,
        nickname: taskLink,
        taskLink,
      });
      if (pinSessionKey)
        await sessionsApi.setSessionTask(sessionId, taskKey).catch(() => undefined);
      setOutcome({ ok: true, result });
      if (result.sessionId) showToast(t("taskModal.addRepo.launched"), "success");
      await onAdded();
    } catch (err) {
      const apiErr = err as tasksApi.AddRepoError;
      setOutcome({
        ok: false,
        message: resolveApiErrorMessage(err, t, "taskModal.addRepo.error"),
        failedStep: apiErr.failedStep,
        completedSteps: apiErr.completedSteps ?? [],
      });
      // Earlier steps may have created a branch/worktree — the list should show them.
      if ((apiErr.completedSteps ?? []).length > 0) await onAdded();
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="mt-3"
        onClick={() => setOpen(true)}
        icon={<Plus className="h-3.5 w-3.5" />}
      >
        {t("taskModal.addRepo.open")}
      </Button>
    );
  }

  const addDir =
    outcome?.ok && outcome.result.workingDirectory && !outcome.result.sessionId
      ? `/add-dir ${outcome.result.workingDirectory}`
      : null;

  return (
    <div className="mt-3 space-y-3 border-t border-gray-100 pt-3 dark:border-gray-800">
      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
        {t("taskModal.addRepo.title")}
      </p>
      <ProjectFolderField
        folders={folders}
        inputName="taskAddRepoFolder"
        loadingRepoInfo={loadingRepoInfo}
        repoError={repoError}
      />

      <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
        {(["create", "link-existing"] as const).map((value) => (
          <label key={value} className="flex items-center gap-2">
            <input
              type="radio"
              name="taskAddRepoMode"
              checked={mode === value}
              onChange={() => setMode(value)}
              className="accent-gray-900 dark:accent-gray-100"
            />
            {t(value === "create" ? "taskModal.addRepo.modeCreate" : "taskModal.addRepo.modeLink")}
          </label>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className={LABEL_CLASSNAME}>
          {t("newTaskModal.branchNameLabel")}
          <Input
            type="text"
            icon={<GitBranch className="h-4 w-4" />}
            value={branchName}
            onChange={(event) => setBranchName(event.target.value)}
            placeholder="feature/PROJ-123"
          />
        </label>
        {mode === "create" && (
          <label className={LABEL_CLASSNAME}>
            {t("newTaskModal.baseBranchLabel")}
            <Input
              type="text"
              icon={<GitBranch className="h-4 w-4" />}
              value={baseBranch}
              onChange={(event) => setBaseBranch(event.target.value)}
              placeholder={defaultBase ?? t("taskModal.addRepo.basePlaceholder")}
            />
          </label>
        )}
      </div>

      {mode === "create" && (
        <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
          <label className="flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={useLocalBranch}
              onChange={(event) => setUseLocalBranch(event.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-gray-900 dark:accent-gray-100"
            />
            {t("newTaskModal.useLocalBaseBranchLabel")}
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={useWorktree}
              onChange={(event) => {
                setUseWorktree(event.target.checked);
                setUseWorktreeTouched(true);
              }}
              className={CHECKBOX_CLASSNAME}
            />
            {t("newTaskModal.useWorktreeLabel")}
          </label>
        </div>
      )}

      <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
        <label className="flex items-start gap-2">
          <input
            type="radio"
            name="taskAddRepoAfter"
            checked={launch}
            onChange={() => setLaunch(true)}
            className="mt-1 accent-gray-900 dark:accent-gray-100"
          />
          {t("taskModal.addRepo.launch")}
        </label>
        <label className="flex items-start gap-2">
          <input
            type="radio"
            name="taskAddRepoAfter"
            checked={!launch}
            onChange={() => setLaunch(false)}
            className="mt-1 accent-gray-900 dark:accent-gray-100"
          />
          {t("taskModal.addRepo.noLaunch")}
        </label>
        {launch && (
          <div className="space-y-2 pl-6">
            <textarea
              className={TEXTAREA_CLASSNAME}
              rows={3}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={t("taskModal.addRepo.promptPlaceholder")}
            />
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={permissionModeAuto}
                onChange={(event) => setPermissionModeAuto(event.target.checked)}
                className={CHECKBOX_CLASSNAME}
              />
              {t("newTaskModal.permissionModeAutoLabel")}
            </label>
          </div>
        )}
      </div>

      {outcome && !outcome.ok && (
        <div className="rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-400">
          {outcome.failedStep && (
            <p className="font-medium">
              {t("taskModal.addRepo.failedAt", { step: t(STEP_LABEL_KEYS[outcome.failedStep]) })}
            </p>
          )}
          <p>{outcome.message}</p>
          {outcome.completedSteps.length > 0 && (
            <p className="mt-1 text-red-600/80 dark:text-red-400/80">
              {t("taskModal.addRepo.alreadyDone", {
                steps: outcome.completedSteps.map((step) => t(STEP_LABEL_KEYS[step])).join(", "),
              })}
            </p>
          )}
        </div>
      )}
      {outcome?.ok && (
        <div className="rounded-md bg-green-50 px-2 py-1.5 text-xs text-green-700 dark:bg-green-950/40 dark:text-green-400">
          <p>
            {t("taskModal.addRepo.done", {
              branch: outcome.result.branch,
              path: outcome.result.workingDirectory ?? outcome.result.repoRoot,
            })}
          </p>
          {addDir && (
            <div className="mt-1 flex items-center gap-2">
              <code className="break-all font-mono text-[11px]">{addDir}</code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void onCopy(addDir)}
                icon={
                  copiedKey === addDir ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )
                }
              >
                {t("taskModal.copyAddDir")}
              </Button>
            </div>
          )}
          {outcome.ok && !outcome.result.workingDirectory && (
            <p className="mt-1">{t("taskModal.addRepo.notCheckedOut")}</p>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => void submit()}
          disabled={submitting || !folder || (mode === "link-existing" && !branchName.trim())}
          icon={
            submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ExternalLink className="h-3.5 w-3.5" />
            )
          }
        >
          {t("taskModal.addRepo.submit")}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
          {t("nicknameModal.cancel")}
        </Button>
      </div>
    </div>
  );
}
