import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Folder,
  GitBranch,
  Link as LinkIcon,
  Loader2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "../hooks/useToast";
import * as tasksApi from "../services/tasksApi";
import type { ProjectFolderOption } from "../services/tasksApi";
import { Button } from "./Button";
import { Input } from "./Input";
import { Modal } from "./Modal";
import { Select } from "./Select";

type NewTaskModalProps = {
  open: boolean;
  onClose: () => void;
};

const OTHER_FOLDER_VALUE = "__other__";
const OTHER_PREFIX_VALUE = "__other__";
// Just the pre-load fallback shown before userPreferences.json's own `branchTypes` arrives (see
// the preferences-fetch effect below) — the real, user-editable list lives in that file.
const FALLBACK_BRANCH_TYPES = ["feature", "fix", "hotfix", "env"];

/** Matches a Jira-style ticket key both in a bare form ("PROJ-123") and inside a full browse URL
 *  ("https://company.atlassian.net/browse/PROJ-123?foo=bar"). */
const JIRA_ID_PATTERN = /([A-Za-z][A-Za-z0-9]+-\d+)/;

function extractJiraId(link: string): string | null {
  const match = JIRA_ID_PATTERN.exec(link.trim());
  return match?.[1] ? match[1].toUpperCase() : null;
}

const TEXTAREA_CLASSNAME =
  "w-full rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900 placeholder:text-gray-400 " +
  "focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 " +
  "dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-gray-600 " +
  "dark:focus:ring-gray-100/10";

type StepStatus = "pending" | "doing" | "done" | "error";
type StepKey = "repo" | "base" | "worktree" | "launch";
type Step = { key: StepKey; label: string; status: StepStatus; error?: string };

const STEP_LABELS: Record<StepKey, string> = {
  repo: "Confirmar que a pasta é um repositório git",
  base: "Buscar a versão mais recente da branch de origem",
  worktree: "Criar a branch e o worktree isolado",
  launch: "Abrir terminal e iniciar o Claude",
};
const STEP_ORDER: StepKey[] = ["repo", "base", "worktree", "launch"];

/** The "worktree" step's label changes when the "sem worktree" checkbox is on — the other three
 *  steps read the same regardless. */
function getStepLabel(key: StepKey, useWorktree: boolean): string {
  if (key === "worktree" && !useWorktree) {
    return "Criar a branch diretamente na pasta do projeto (sem worktree)";
  }
  return STEP_LABELS[key];
}

/**
 * Always mounted (Header renders it unconditionally, toggling `open`) rather than the
 * mount-on-open convention other modals use — an accidental close (Escape, backdrop click, the
 * X button) must not lose whatever the user already typed, so state has to survive across
 * `open` going false and true again. `resetForm` (used by the Clear button and after a
 * successful create) is the only thing that intentionally wipes it.
 */
export function NewTaskModal({ open, onClose }: NewTaskModalProps) {
  const { showToast } = useToast();

  const jiraLinkInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) jiraLinkInputRef.current?.focus();
  }, [open]);

  // "checking" is also the initial value (rather than e.g. "disconnected") so the modal never
  // flashes a false warning before the first check has even run.
  const [jiraMcpStatus, setJiraMcpStatus] = useState<
    "checking" | "connected" | "disconnected" | "error"
  >("checking");
  const [jiraMcpServerName, setJiraMcpServerName] = useState<string | null>(null);
  const [jiraMcpError, setJiraMcpError] = useState<string | null>(null);

  const checkJiraMcp = useCallback(() => {
    setJiraMcpStatus("checking");
    setJiraMcpError(null);
    tasksApi
      .fetchJiraMcpStatus()
      .then((status) => {
        setJiraMcpServerName(status.serverName);
        setJiraMcpStatus(status.connected ? "connected" : "disconnected");
      })
      .catch((err) => {
        setJiraMcpStatus("error");
        setJiraMcpError(
          err instanceof Error ? err.message : "Não foi possível verificar o MCP do Jira.",
        );
      });
  }, []);

  // Re-checks every time the modal opens (not just once on mount) — the CLI's `claude mcp login`
  // flow happens in a separate terminal, so a fresh check on open is the only way this modal would
  // ever notice the user connected it since the last time. The "Verificar novamente" button below
  // covers the case where they connect it without closing the modal at all. Deferred via a 0ms
  // timer (rather than calling checkJiraMcp directly) so its setState calls happen in a callback,
  // not synchronously in the effect body itself.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(checkJiraMcp, 0);
    return () => clearTimeout(timer);
  }, [open, checkJiraMcp]);

  const [jiraLink, setJiraLink] = useState("");
  const jiraId = useMemo(() => extractJiraId(jiraLink), [jiraLink]);

  const [projects, setProjects] = useState<ProjectFolderOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [folderChoice, setFolderChoice] = useState("");
  const [customFolderPath, setCustomFolderPath] = useState("");

  const [defaultPromptLoaded, setDefaultPromptLoaded] = useState<string | null>(null);
  const [loadingPrompt, setLoadingPrompt] = useState(true);
  const [promptText, setPromptText] = useState("");
  const [savingDefaultPrompt, setSavingDefaultPrompt] = useState(false);

  // The user-editable list backing the "Tipo de branch" select — loaded from userPreferences.json
  // and grown automatically (see handleCreate) whenever a task is created with a custom ("Outro")
  // type, so it shows up as a normal option next time without any separate management step.
  const [branchTypes, setBranchTypes] = useState<string[]>(FALLBACK_BRANCH_TYPES);
  const [prefixChoice, setPrefixChoice] = useState<string>(FALLBACK_BRANCH_TYPES[0] ?? "feature");
  const [customPrefix, setCustomPrefix] = useState("");
  // null means "not yet edited by hand" — the branch suffix field then tracks the Jira id
  // automatically. Once the user types into it, it holds their exact text from then on. The
  // prefix is kept separate so switching it never has to touch this field at all — the full
  // branch name (prefix + suffix) is only ever computed for display/submission, below.
  const [branchSuffixManual, setBranchSuffixManual] = useState<string | null>(null);

  const [baseBranch, setBaseBranch] = useState("master");
  const [baseBranchTouched, setBaseBranchTouched] = useState(false);
  const [loadingRepoInfo, setLoadingRepoInfo] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);

  // Default false — the collision-free worktree path stays the default; checking this opts into
  // checking the new branch out directly in the project folder instead. `useWorktreeDefault`
  // mirrors userPreferences.json's stored default (see the preferences-fetch effect and
  // `handleSaveWorktreeDefault` below); `skipWorktree` is this form's own live, possibly-unsaved
  // draft of it — kept separate the same way `promptText`/`defaultPromptLoaded` are for the prompt.
  const [skipWorktree, setSkipWorktree] = useState(false);
  const [useWorktreeDefault, setUseWorktreeDefault] = useState(true);
  const [savingWorktreeDefault, setSavingWorktreeDefault] = useState(false);

  const [creating, setCreating] = useState(false);
  // Empty while idle — the static "what will happen" explanation renders instead. Populated with
  // all four steps (each "pending") right when a create attempt starts, so the modal always shows
  // exactly which step is running, finished, or failed rather than one opaque success/failure.
  const [steps, setSteps] = useState<Step[]>([]);

  // Re-fetched every time the modal opens (not just once on mount) — a project folder typed by
  // hand into "Outro" during task creation only becomes a known option once its new session's
  // `.jsonl` exists, so re-running this on open is the only way a just-used repo shows up in the
  // dropdown next time without a full page reload. Deferred via a 0ms timer (same as
  // `checkJiraMcp` below) so its setState calls happen in a callback, not synchronously in the
  // effect body itself.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoadingProjects(true);
      tasksApi
        .fetchProjectFolders()
        .then((list) => {
          if (cancelled) return;
          setProjects(list);
          if (list.length === 0) setFolderChoice(OTHER_FOLDER_VALUE);
        })
        .catch(() => {
          if (!cancelled) setFolderChoice(OTHER_FOLDER_VALUE);
        })
        .finally(() => {
          if (!cancelled) setLoadingProjects(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open]);

  // Fetched once on mount (not on every open, unlike the project-folder list above) — the loaded
  // values only ever seed the form's initial state, and re-running this on every open would
  // clobber whatever the user already typed/picked across an accidental close, exactly what the
  // "always mounted" doc comment above is there to prevent.
  useEffect(() => {
    let cancelled = false;
    tasksApi
      .fetchPreferences()
      .then((prefs) => {
        if (cancelled) return;
        setDefaultPromptLoaded(prefs.defaultPrompt);
        setPromptText(prefs.defaultPrompt);
        const loadedBranchTypes =
          prefs.branchTypes.length > 0 ? prefs.branchTypes : FALLBACK_BRANCH_TYPES;
        setBranchTypes(loadedBranchTypes);
        setPrefixChoice(loadedBranchTypes[0] ?? "feature");
        setUseWorktreeDefault(prefs.useWorktreeByDefault);
        setSkipWorktree(!prefs.useWorktreeByDefault);
      })
      .catch(() => {
        if (!cancelled) setDefaultPromptLoaded("");
      })
      .finally(() => {
        if (!cancelled) setLoadingPrompt(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const effectivePrefix = prefixChoice === OTHER_PREFIX_VALUE ? customPrefix.trim() : prefixChoice;
  const effectiveFolderPath =
    folderChoice === OTHER_FOLDER_VALUE || projects.length === 0 ? customFolderPath : folderChoice;

  // Derived (not effect-driven) so it's always reflected live, right up until the user types
  // their own text into the field.
  const branchSuffix = branchSuffixManual ?? jiraId ?? "";
  const branchName = effectivePrefix ? `${effectivePrefix}/${branchSuffix}` : branchSuffix;

  // Prefills the source branch from the selected folder's actual default (main/master/whatever
  // origin/HEAD points at) — debounced since typing a custom path fires this on every keystroke.
  // The state updates all happen inside the timeout callback (not synchronously in the effect
  // body) since they're a response to the async fetch settling, not a direct render-time sync.
  useEffect(() => {
    const folder = effectiveFolderPath.trim();
    const timer = setTimeout(() => {
      if (!folder) {
        setRepoError(null);
        return;
      }
      setLoadingRepoInfo(true);
      tasksApi
        .fetchRepoInfo(folder)
        .then((info) => {
          setRepoError(null);
          if (!baseBranchTouched) setBaseBranch(info.defaultBaseBranch);
        })
        .catch((err) => {
          setRepoError(
            err instanceof Error
              ? err.message
              : "Não foi possível ler as informações deste repositório.",
          );
        })
        .finally(() => setLoadingRepoInfo(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [effectiveFolderPath, baseBranchTouched]);

  // Used both by the Clear button and after a successful create — keeps the loaded projects list
  // and preferences (no need to refetch either), only wipes what the user filled in.
  const resetForm = useCallback(() => {
    setJiraLink("");
    setFolderChoice(projects.length === 0 ? OTHER_FOLDER_VALUE : "");
    setCustomFolderPath("");
    setPromptText(defaultPromptLoaded ?? "");
    setPrefixChoice(branchTypes[0] ?? FALLBACK_BRANCH_TYPES[0] ?? "feature");
    setCustomPrefix("");
    setBranchSuffixManual(null);
    setBaseBranch("main");
    setBaseBranchTouched(false);
    setRepoError(null);
    setSkipWorktree(!useWorktreeDefault);
    setSteps([]);
  }, [projects, defaultPromptLoaded, branchTypes, useWorktreeDefault]);

  const promptDirty =
    (defaultPromptLoaded !== null && promptText !== defaultPromptLoaded) || !defaultPromptLoaded;

  const handleSaveDefaultPrompt = async () => {
    setSavingDefaultPrompt(true);
    try {
      await tasksApi.savePreferences({
        defaultPrompt: promptText,
        branchTypes,
        useWorktreeByDefault: useWorktreeDefault,
      });
      setDefaultPromptLoaded(promptText);
      showToast("Prompt padrão salvo.", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Não foi possível salvar o prompt padrão.",
        "error",
      );
    } finally {
      setSavingDefaultPrompt(false);
    }
  };

  // Whether the "não usar worktree" checkbox's current value differs from the stored default —
  // mirrors `promptDirty`'s role for the prompt, gating the "Usar como padrão" link below.
  const worktreeDefaultDirty = !skipWorktree !== useWorktreeDefault;

  const handleSaveWorktreeDefault = async () => {
    setSavingWorktreeDefault(true);
    try {
      const nextUseWorktreeDefault = !skipWorktree;
      await tasksApi.savePreferences({
        defaultPrompt: defaultPromptLoaded ?? "",
        branchTypes,
        useWorktreeByDefault: nextUseWorktreeDefault,
      });
      setUseWorktreeDefault(nextUseWorktreeDefault);
      showToast("Preferência de worktree salva.", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Não foi possível salvar essa preferência.",
        "error",
      );
    } finally {
      setSavingWorktreeDefault(false);
    }
  };

  const trimmedFolder = effectiveFolderPath.trim();
  const trimmedBranch = branchName.trim();
  const trimmedBase = baseBranch.trim();
  const trimmedPrompt = promptText.trim();
  const canSubmit =
    jiraMcpStatus === "connected" &&
    jiraLink.trim().length > 0 &&
    trimmedFolder.length > 0 &&
    trimmedBranch.length > 0 &&
    trimmedBase.length > 0 &&
    trimmedPrompt.length > 0 &&
    !creating;

  const updateStep = (key: StepKey, status: StepStatus, error?: string) => {
    setSteps((current) =>
      current.map((step) => (step.key === key ? { ...step, status, error } : step)),
    );
  };

  /**
   * Runs the four steps in sequence, each awaited before the next starts, updating `steps` as it
   * goes — this is what powers the live checklist below (see STEP_ORDER/STEP_LABELS). A failure at
   * any step stops the sequence right there (steps after it stay "pending", never attempted), marks
   * that one step "error" with the server's message, and leaves the modal open with the checklist
   * visible so it's obvious exactly where things stopped — no resetForm()/onClose() on failure,
   * unlike a clean run.
   */
  const handleCreate = async () => {
    if (!canSubmit) return;
    setCreating(true);
    setSteps(
      STEP_ORDER.map((key) => ({
        key,
        label: getStepLabel(key, !skipWorktree),
        status: "pending",
      })),
    );

    const composedPrompt = [jiraLink.trim() ? `Tarefa: ${jiraLink.trim()}` : null, trimmedPrompt]
      .filter((part): part is string => Boolean(part))
      .join("\n\n");

    try {
      updateStep("repo", "doing");
      await tasksApi.fetchRepoInfo(trimmedFolder);
      updateStep("repo", "done");

      updateStep("base", "doing");
      const { baseBranchRef } = await tasksApi.resolveBaseBranch(trimmedFolder, trimmedBase);
      updateStep("base", "done");

      updateStep("worktree", "doing");
      const { worktreePath } = await tasksApi.createTaskWorktree(
        trimmedFolder,
        trimmedBranch,
        baseBranchRef,
        !skipWorktree,
      );
      updateStep("worktree", "done");

      updateStep("launch", "doing");
      await tasksApi.launchTaskTerminal(worktreePath, composedPrompt);
      updateStep("launch", "done");

      // A custom ("Outro") branch type that was actually used becomes a normal option from now on
      // — no separate "manage branch types" step, it just remembers itself. Best-effort: a failure
      // here doesn't undo the task that was just successfully created.
      if (
        prefixChoice === OTHER_PREFIX_VALUE &&
        effectivePrefix &&
        !branchTypes.includes(effectivePrefix)
      ) {
        const updatedBranchTypes = [...branchTypes, effectivePrefix];
        setBranchTypes(updatedBranchTypes);
        tasksApi
          .savePreferences({
            defaultPrompt: defaultPromptLoaded ?? "",
            branchTypes: updatedBranchTypes,
            useWorktreeByDefault: useWorktreeDefault,
          })
          .catch(() => {
            // Still usable for the rest of this session even if persisting it failed.
          });
      }

      showToast(
        "Terminal aberto. Verifique a barra de tarefas se ele não veio para frente.",
        "success",
      );
      resetForm();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha inesperada.";
      setSteps((current) =>
        current.map((step) =>
          step.status === "doing" ? { ...step, status: "error", error: message } : step,
        ),
      );
      showToast(`Falha ao criar a tarefa: ${message}`, "error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Nova tarefa"
      onClose={onClose}
      onCancel={onClose}
      onConfirm={handleCreate}
      confirmLabel="Criar e abrir terminal"
      cancelLabel="Cancelar"
      isConfirmLoading={creating}
      isConfirmDisabled={!canSubmit}
      onSecondary={resetForm}
      secondaryLabel="Limpar"
      size="xl"
    >
      <div className="flex flex-col gap-4">
        <div
          className={`flex items-center justify-between gap-3 rounded-lg border p-3 text-sm ${
            jiraMcpStatus === "connected"
              ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-400"
              : jiraMcpStatus === "checking"
                ? "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-400"
                : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-400"
          }`}
        >
          <div className="flex items-center gap-2">
            {jiraMcpStatus === "checking" && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
            {jiraMcpStatus === "connected" && <CheckCircle2 className="h-4 w-4 shrink-0" />}
            {(jiraMcpStatus === "disconnected" || jiraMcpStatus === "error") && (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            <span>
              {jiraMcpStatus === "checking" && "Verificando conexão do MCP do Jira…"}
              {jiraMcpStatus === "connected" &&
                `MCP do Jira conectado${jiraMcpServerName ? ` (${jiraMcpServerName})` : ""}.`}
              {jiraMcpStatus === "disconnected" &&
                (jiraMcpServerName
                  ? `MCP "${jiraMcpServerName}" encontrado mas não conectado — conecte-o (ex: "claude mcp login") antes de criar a tarefa.`
                  : "Nenhum MCP do Jira/Atlassian configurado — conecte um antes de criar a tarefa.")}
              {jiraMcpStatus === "error" &&
                (jiraMcpError ?? "Não foi possível verificar o MCP do Jira.")}
            </span>
          </div>
          {jiraMcpStatus !== "checking" && (
            <Button variant="link" size="none" onClick={checkJiraMcp} className="shrink-0">
              Verificar novamente
            </Button>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            Link da tarefa (Jira)
          </label>
          <Input
            ref={jiraLinkInputRef}
            type="text"
            icon={<LinkIcon className="h-4 w-4" />}
            value={jiraLink}
            onChange={(event) => setJiraLink(event.target.value)}
            placeholder="https://empresa.atlassian.net/browse/PROJ-123"
          />
        </div>

        {jiraLink.trim().length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Cole o link da tarefa para continuar preenchendo o resto da configuração.
          </p>
        ) : (
          <>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Projeto (pasta)
              </label>
              {projects.length > 0 && (
                <Select
                  icon={<Folder className="h-4 w-4" />}
                  value={folderChoice}
                  onChange={(event) => setFolderChoice(event.target.value)}
                  disabled={loadingProjects}
                >
                  <option value="" disabled>
                    {loadingProjects ? "Carregando projetos…" : "Selecione um projeto"}
                  </option>
                  {projects.map((project) => (
                    <option key={project.path} value={project.path}>
                      {project.label}
                    </option>
                  ))}
                  <option value={OTHER_FOLDER_VALUE}>Outro (colar caminho da pasta)</option>
                </Select>
              )}
              {(folderChoice === OTHER_FOLDER_VALUE || projects.length === 0) && (
                <Input
                  type="text"
                  icon={<Folder className="h-4 w-4" />}
                  value={customFolderPath}
                  onChange={(event) => setCustomFolderPath(event.target.value)}
                  placeholder="/caminho/absoluto/para/o/projeto"
                  className={projects.length > 0 ? "mt-2" : ""}
                />
              )}
              {loadingRepoInfo && (
                <p className="mt-1 flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                  <Loader2 className="h-3 w-3 animate-spin" /> Lendo informações do repositório…
                </p>
              )}
              {repoError && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{repoError}</p>
              )}
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Prompt
                </label>
                {promptDirty && (
                  <Button
                    variant="link"
                    size="none"
                    onClick={handleSaveDefaultPrompt}
                    disabled={savingDefaultPrompt}
                  >
                    {savingDefaultPrompt ? "Salvando…" : "Salvar como padrão"}
                  </Button>
                )}
              </div>
              <textarea
                value={promptText}
                onChange={(event) => setPromptText(event.target.value)}
                placeholder={
                  loadingPrompt ? "Carregando prompt padrão…" : "Instruções para o Claude…"
                }
                rows={5}
                className={TEXTAREA_CLASSNAME}
              />
              <span className="text-xs">
                Prompt final: "Tarefa: {jiraLink.trim()} + \n\n + {promptText.slice(0, 50)}
                ...."
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                  Branch de origem
                </label>
                <Input
                  type="text"
                  value={baseBranch}
                  onChange={(event) => {
                    setBaseBranch(event.target.value);
                    setBaseBranchTouched(true);
                  }}
                  placeholder="master/main/outro"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                  Tipo de branch
                </label>
                <Select
                  value={prefixChoice}
                  onChange={(event) => setPrefixChoice(event.target.value)}
                >
                  {branchTypes.map((prefix) => (
                    <option key={prefix} value={prefix}>
                      {prefix}
                    </option>
                  ))}
                  <option value={OTHER_PREFIX_VALUE}>Outro</option>
                </Select>
                {prefixChoice === OTHER_PREFIX_VALUE && (
                  <Input
                    type="text"
                    value={customPrefix}
                    onChange={(event) => setCustomPrefix(event.target.value)}
                    placeholder="prefixo customizado"
                    className="mt-2"
                  />
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                  Nome da branch
                </label>
                <Input
                  type="text"
                  icon={<GitBranch className="h-4 w-4" />}
                  value={branchSuffix}
                  onChange={(event) => setBranchSuffixManual(event.target.value)}
                  placeholder="PROJ-123"
                />
                {branchName && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                    Preview:
                    <span className="font-mono text-gray-600 dark:text-gray-300">{branchName}</span>
                  </p>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <input
                    type="checkbox"
                    checked={skipWorktree}
                    onChange={(event) => setSkipWorktree(event.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-gray-900 dark:accent-gray-100"
                  />
                  Não usar worktree — trocar a branch direto na pasta do projeto.
                </label>
                {worktreeDefaultDirty && (
                  <Button
                    variant="link"
                    size="none"
                    onClick={handleSaveWorktreeDefault}
                    disabled={savingWorktreeDefault}
                    className="shrink-0"
                  >
                    {savingWorktreeDefault ? "Salvando…" : "Usar como padrão"}
                  </Button>
                )}
              </div>
              {skipWorktree && (
                <p className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Sem worktree, a branch nova é trocada direto na pasta principal do projeto — isso
                  pode gerar conflitos se houver outro terminal ou sessão já ativo nela.
                </p>
              )}
            </div>

            {steps.length > 0 ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/50">
                <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Progresso:
                </p>
                <ol className="space-y-2">
                  {steps.map((step) => (
                    <li key={step.key} className="flex items-start gap-2">
                      {step.status === "pending" && (
                        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />
                      )}
                      {step.status === "doing" && (
                        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-gray-500 dark:text-gray-400" />
                      )}
                      {step.status === "done" && (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-500" />
                      )}
                      {step.status === "error" && (
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-500" />
                      )}
                      <div>
                        <p
                          className={`text-sm ${
                            step.status === "pending"
                              ? "text-gray-400 dark:text-gray-500"
                              : "text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {step.label}
                        </p>
                        {step.status === "error" && step.error && (
                          <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
                            {step.error}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-400">
                <p className="mb-2 font-medium text-gray-700 dark:text-gray-300">
                  O que vai acontecer ao clicar em "Criar e abrir terminal":
                </p>
                <ol className="list-decimal space-y-1 pl-5">
                  <li>
                    Confirma que{" "}
                    <span className="font-mono text-gray-800 dark:text-gray-200">
                      {trimmedFolder || "(pasta escolhida)"}
                    </span>{" "}
                    é um repositório git.
                  </li>
                  <li>
                    Busca a versão mais recente da branch de origem{" "}
                    <span className="font-mono text-gray-800 dark:text-gray-200">
                      {trimmedBase || "(branch de origem)"}
                    </span>{" "}
                    direto do remoto — sem dar checkout nem mexer na pasta principal do projeto (não
                    afeta nenhuma sessão que já esteja ativa lá).
                  </li>
                  <li>
                    Cria a branch nova{" "}
                    <span className="font-mono text-gray-800 dark:text-gray-200">
                      {trimmedBranch || "(nome da branch)"}
                    </span>{" "}
                    a partir dessa versão atualizada.
                  </li>
                  <li>
                    {skipWorktree ? (
                      <>
                        Troca para essa branch direto na pasta principal do projeto — sem worktree,
                        pode conflitar com outro terminal já aberto nela.
                      </>
                    ) : (
                      <>
                        Cria um worktree isolado (pasta própria, separada da principal) já nessa
                        branch — é isso que permite trabalhar nessa tarefa sem interferir em outro
                        terminal aberto no mesmo projeto.
                      </>
                    )}
                  </li>
                  <li>
                    Abre um terminal novo{" "}
                    {skipWorktree ? "na pasta do projeto" : "dentro desse worktree"} e inicia o{" "}
                    <code>claude</code> já com o prompt acima como primeira mensagem.
                  </li>
                </ol>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
