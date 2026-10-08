import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  FolderGit2,
  FolderOpen,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCopyFeedback } from "../hooks/useCopyFeedback";
import { useLanguage } from "../hooks/useLanguage";
import { useSkillsHubStatus } from "../hooks/useSkillsHubStatus";
import { useToast } from "../hooks/useToast";
import type { TranslationKey } from "../i18n/translations";
import * as tasksApi from "../services/tasksApi";
import type {
  HubCatalog,
  SkillLinkState,
  SkillsHubStatus,
  SkillsSelection,
} from "../services/tasksApi";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { describeSync } from "../utils/skillsHub";
import { Button } from "./Button";
import { Input } from "./Input";
import { Modal } from "./Modal";
import { Select } from "./Select";
import { SkillPreviewModal } from "./SkillPreviewModal";
import { Tooltip } from "./Tooltip";

type SkillsHubModalProps = {
  onClose: () => void;
};

const STATE_LABEL_KEYS: Record<SkillLinkState, TranslationKey> = {
  linked: "skillsHub.state.linked",
  missing: "skillsHub.state.missing",
  broken: "skillsHub.state.broken",
  conflict: "skillsHub.state.conflict",
};

const STATE_CLASSES: Record<SkillLinkState, string> = {
  linked: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  missing: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  broken: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  conflict: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
};

/**
 * Sets up and manages the team skills from the skills hub repo: set its URL, clone it (or point at an existing
 * clone), choose catalogs, see each skill's link state, update now. Opened from the New Task
 * modal's skills panel and from the settings modal. Everything here is optional — closing it
 * without doing anything changes nothing.
 */
export function SkillsHubModal({ onClose }: SkillsHubModalProps) {
  const { t } = useLanguage();
  const { status, failed, reload } = useSkillsHubStatus(true);
  const [preview, setPreview] = useState<{ catalog: string; name: string } | null>(null);

  return (
    <Modal
      open
      title={t("skillsHub.modal.title")}
      // Escape would otherwise close this modal too while a skill preview is open on top of it.
      onClose={() => {
        if (!preview) onClose();
      }}
      size="xxxl"
      icon={<Sparkles className="h-5 w-5 text-violet-500" />}
    >
      {!status && !failed && (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("skillsHub.loading")}
        </p>
      )}
      {!status && failed && (
        <p className="text-sm text-red-600 dark:text-red-400">{t("skillsHub.loadError")}</p>
      )}
      {status && (status.cloneUrl === null || status.repoUrlDetected) && (
        <RepoUrlSection status={status} onDone={reload} />
      )}
      {status?.cloneUrl != null && !status.found && (
        <InstallSection status={status} onDone={reload} />
      )}
      {status?.found && (
        <ManageSection
          status={status}
          onChanged={reload}
          onPreview={(catalog, name) => setPreview({ catalog, name })}
        />
      )}
      {preview && (
        <SkillPreviewModal
          catalog={preview.catalog}
          name={preview.name}
          onClose={() => setPreview(null)}
        />
      )}
    </Modal>
  );
}

function CopyableCommand({ command }: { command: string }) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { copiedKey, copy } = useCopyFeedback();
  return (
    <div className="flex items-center gap-2 rounded-md bg-gray-900 px-3 py-2 font-mono text-xs text-gray-100 dark:bg-black">
      <code className="min-w-0 flex-1 break-all">{command}</code>
      <Button
        variant="unstyled"
        size="icon"
        className="text-gray-300 hover:bg-gray-700"
        aria-label={t("skillsHub.copy")}
        onClick={() => {
          copy(command).catch(() => showToast(t("skillsHub.copyFailed"), "error"));
        }}
        icon={
          copiedKey === command ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )
        }
      />
    </div>
  );
}

/** The hub's clone URL (`skillsHub.repoUrl`) — asked before anything else when unset, and offered
 *  for confirmation while it's only detected from an existing clone. */
function RepoUrlSection({
  status,
  onDone,
}: {
  status: SkillsHubStatus;
  onDone: () => Promise<void>;
}) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [value, setValue] = useState(status.cloneUrl ?? "");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await tasksApi.setSkillsHubRepoUrl(value);
      tasksApi.notifySkillsHubChanged();
      tasksApi.notifyPreferencesChanged();
      await onDone();
      showToast(t("skillsHub.repoUrl.saved"), "success");
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "skillsHub.repoUrl.saveError"), "error");
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="mb-5 text-sm text-gray-700 dark:text-gray-300">
      <h3 className="mb-1 font-medium text-gray-900 dark:text-gray-100">
        {t("skillsHub.repoUrl.title")}
      </h3>
      <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
        {status.repoUrlDetected ? t("skillsHub.repoUrl.detected") : t("skillsHub.repoUrl.body")}
      </p>
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            type="text"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="git@github.com:team/skills-repo.git"
            className="font-mono"
          />
        </div>
        <Button
          variant="outline"
          disabled={saving || !value.trim()}
          onClick={() => void save()}
          icon={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
        >
          {t("skillsHub.repoUrl.save")}
        </Button>
      </div>
    </section>
  );
}

function PathOverride({ onDone, initial }: { onDone: () => Promise<void>; initial?: string }) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [value, setValue] = useState(initial ?? "");
  const [saving, setSaving] = useState(false);
  const save = async (path: string | null) => {
    setSaving(true);
    try {
      await tasksApi.setSkillsHubPath(path);
      tasksApi.notifySkillsHubChanged();
      await onDone();
      showToast(t("skillsHub.pathSaved"), "success");
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "skillsHub.pathSaveError"), "error");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="flex gap-2">
      <div className="flex-1">
        <Input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="~/git/skills-hub"
          className="font-mono"
        />
      </div>
      <Button
        variant="outline"
        disabled={saving || !value.trim()}
        onClick={() => void save(value)}
        icon={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
      >
        {t("skillsHub.usePath")}
      </Button>
      {initial && (
        <Button variant="ghost" disabled={saving} onClick={() => void save(null)}>
          {t("skillsHub.autoDetect")}
        </Button>
      )}
    </div>
  );
}

function InstallSection({
  status,
  onDone,
}: {
  status: SkillsHubStatus;
  onDone: () => Promise<void>;
}) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [parentDir, setParentDir] = useState(status.cloneParentDirs[0] ?? "~");
  const [cloning, setCloning] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const target = `${parentDir.replace(/\/+$/, "")}/${status.cloneFolderName ?? "skills-hub"}`;

  const clone = async () => {
    setCloning(true);
    setCloneError(null);
    try {
      await tasksApi.cloneSkillsHub(parentDir);
      tasksApi.notifySkillsHubChanged();
      showToast(t("skillsHub.cloned"), "success");
      await onDone();
    } catch (err) {
      setCloneError(resolveApiErrorMessage(err, t, "skillsHub.cloneError"));
    } finally {
      setCloning(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 text-sm text-gray-700 dark:text-gray-300">
      <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 dark:border-violet-900/60 dark:bg-violet-950/30">
        <p className="font-medium text-violet-900 dark:text-violet-200">
          {t("skillsHub.invite.title")}
        </p>
        <p className="mt-1 text-violet-800 dark:text-violet-300">{t("skillsHub.invite.body")}</p>
        <p className="mt-1 text-xs text-violet-700 dark:text-violet-400">
          {t("skillsHub.invite.optional")}
        </p>
      </div>

      {status.configuredPathInvalid && (
        <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {t("skillsHub.configuredPathInvalid")}
        </p>
      )}

      <section>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">
          1. {t("skillsHub.install.cloneTitle")}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {status.cloneParentDirs.length > 1 ? (
            <div className="min-w-60 flex-1">
              <Select value={parentDir} onChange={(event) => setParentDir(event.target.value)}>
                {status.cloneParentDirs.map((dir) => (
                  <option key={dir} value={dir}>
                    {dir}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          <Button
            onClick={() => void clone()}
            disabled={cloning}
            icon={
              cloning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )
            }
          >
            {t("skillsHub.install.cloneButton", { target })}
          </Button>
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {t("skillsHub.install.sshNote")}
        </p>
        {cloneError && (
          <p className="mt-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400">
            {cloneError}
          </p>
        )}
      </section>

      <section>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">
          2. {t("skillsHub.install.manualTitle")}
        </h3>
        <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
          {t("skillsHub.install.manualBody")}
        </p>
        <CopyableCommand command={`git clone ${status.cloneUrl ?? ""} ${target}`} />
        {status.webUrl && (
          <a
            href={status.webUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs text-gray-600 underline hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <ExternalLink className="h-3 w-3" />
            {t("skillsHub.install.openRepo")}
          </a>
        )}
      </section>

      <section>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">
          {t("skillsHub.install.existingTitle")}
        </h3>
        <PathOverride onDone={onDone} />
      </section>
    </div>
  );
}

function ManageSection({
  status,
  onChanged,
  onPreview,
}: {
  status: SkillsHubStatus;
  onChanged: () => Promise<void>;
  onPreview: (catalog: string, name: string) => void;
}) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const saved = useMemo<SkillsSelection>(
    () => ({ catalogs: status.selectedCatalogs, skills: status.selectedSkills }),
    [status.selectedCatalogs, status.selectedSkills],
  );
  const [draft, setDraft] = useState<SkillsSelection>(saved);
  const [applying, setApplying] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<{ warning: boolean; text: string } | null>(null);
  const [showPath, setShowPath] = useState(false);

  // A server-side change (e.g. a sync or another tab) reseeds the draft only while the user hasn't
  // started editing it — same "follow until touched" idea as the New Task form.
  const [seededFrom, setSeededFrom] = useState(saved);
  if (seededFrom !== saved) {
    setSeededFrom(saved);
    if (sameSelection(draft, seededFrom)) setDraft(saved);
  }

  const draftDirty = !sameSelection(draft, saved) || !status.catalogsChosen;

  const isWhole = (catalog: string) => draft.catalogs.includes(catalog);
  const isPicked = (catalog: string, skill: string) =>
    isWhole(catalog) || draft.skills.includes(`${catalog}/${skill}`);

  // Whole catalog ⇄ nothing; a catalog picked only partially becomes whole on click.
  const toggleCatalog = (catalog: HubCatalog) => {
    setDraft((current) =>
      current.catalogs.includes(catalog.name)
        ? { ...current, catalogs: current.catalogs.filter((name) => name !== catalog.name) }
        : {
            catalogs: [...current.catalogs, catalog.name],
            skills: current.skills.filter((id) => !id.startsWith(`${catalog.name}/`)),
          },
    );
  };

  // Unpicking one skill of a whole catalog turns it into individual picks of all the others.
  const toggleSkill = (catalog: HubCatalog, skill: string) => {
    const id = `${catalog.name}/${skill}`;
    setDraft((current) => {
      if (current.catalogs.includes(catalog.name)) {
        return {
          catalogs: current.catalogs.filter((name) => name !== catalog.name),
          skills: [
            ...current.skills,
            ...catalog.skills
              .filter((k) => k.name !== skill)
              .map((k) => `${catalog.name}/${k.name}`),
          ],
        };
      }
      return current.skills.includes(id)
        ? { ...current, skills: current.skills.filter((item) => item !== id) }
        : { ...current, skills: [...current.skills, id] };
    });
  };
  const skillsByCatalog = useMemo(() => {
    const map = new Map<string, Map<string, SkillLinkState>>();
    for (const skill of status.skills) {
      if (!map.has(skill.catalog)) map.set(skill.catalog, new Map());
      map.get(skill.catalog)!.set(skill.name, skill.state);
    }
    return map;
  }, [status.skills]);

  const duplicateNames = useMemo(() => {
    const seen = new Map<string, number>();
    for (const catalog of status.catalogs) {
      for (const skill of catalog.skills) {
        const picked =
          draft.catalogs.includes(catalog.name) ||
          draft.skills.includes(`${catalog.name}/${skill.name}`);
        if (picked) seen.set(skill.name, (seen.get(skill.name) ?? 0) + 1);
      }
    }
    return [...seen.entries()].filter(([, count]) => count > 1).map(([name]) => name);
  }, [status.catalogs, draft]);

  const apply = async () => {
    setApplying(true);
    try {
      const result = await tasksApi.setSkillsHubSelection(draft);
      tasksApi.notifySkillsHubChanged();
      await onChanged();
      showToast(
        t("skillsHub.catalogsApplied", {
          linked: result.linked.length,
          unlinked: result.unlinked.length,
        }),
        "success",
      );
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "skillsHub.catalogsApplyError"), "error");
    } finally {
      setApplying(false);
    }
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      const result = await tasksApi.syncSkillsHub();
      setLastSync(describeSync(result, t));
      tasksApi.notifySkillsHubChanged();
      await onChanged();
    } catch (err) {
      setLastSync({ warning: true, text: resolveApiErrorMessage(err, t, "skillsHub.syncError") });
    } finally {
      setSyncing(false);
    }
  };

  const onDefaultBranch = status.branch !== null && status.branch === status.defaultBranch;

  return (
    <div className="flex flex-col gap-5 text-sm text-gray-700 dark:text-gray-300">
      <p className="text-gray-600 dark:text-gray-400">{t("skillsHub.manage.intro")}</p>

      <section className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-mono text-xs text-gray-900 dark:text-gray-100">
              <FolderGit2 className="h-4 w-4 shrink-0 text-gray-400" />
              <span className="break-all">{status.path}</span>
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t("skillsHub.manage.branch")}{" "}
              <span className="font-mono text-gray-800 dark:text-gray-200">
                {status.branch ?? t("skillsHub.manage.detached")}
              </span>
              {status.behind !== null && status.behind > 0 && (
                <> · {t("skillsHub.manage.behind", { count: status.behind })}</>
              )}
              {status.ahead !== null && status.ahead > 0 && (
                <> · {t("skillsHub.manage.ahead", { count: status.ahead })}</>
              )}
              {status.dirty && <> · {t("skillsHub.manage.dirty")}</>}
            </p>
            {!onDefaultBranch && status.defaultBranch && (
              <p className="mt-1 flex items-start gap-1 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                {t("skillsHub.manage.notDefaultBranch", { defaultBranch: status.defaultBranch })}
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowPath((v) => !v)}>
              {t("skillsHub.manage.changePath")}
            </Button>
            <OpenFolderMenu hubPath={status.path ?? ""} userSkillsDir={status.userSkillsDir} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => void syncNow()}
              disabled={syncing}
              icon={
                syncing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )
              }
            >
              {t("skillsHub.manage.syncNow")}
            </Button>
          </div>
        </div>
        {showPath && (
          // Repo URL and clone folder are edited in one place — Settings' "Team skills" row —
          // so this only points there instead of offering a second editor.
          <p className="mt-3 flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300">
            <Settings className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {t("skillsHub.manage.changePathHint")}
          </p>
        )}
        {lastSync && (
          <p
            className={`mt-2 text-xs ${lastSync.warning ? "text-amber-700 dark:text-amber-400" : "text-green-700 dark:text-green-400"}`}
          >
            {lastSync.text}
          </p>
        )}
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          {t("skillsHub.manage.syncHelp")}
        </p>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">
            {t("skillsHub.manage.catalogsTitle")}
          </h3>
          {draftDirty && (
            <Button
              size="sm"
              onClick={() => void apply()}
              disabled={applying}
              icon={applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : undefined}
            >
              {t("skillsHub.manage.applyCatalogs")}
            </Button>
          )}
        </div>
        <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
          {status.catalogsChosen
            ? t("skillsHub.manage.catalogsHelp", { dir: status.userSkillsDir })
            : status.selectedCatalogs.length > 0 || status.selectedSkills.length > 0
              ? t("skillsHub.manage.catalogsInferred")
              : t("skillsHub.manage.catalogsNone")}
        </p>
        <ul className="flex flex-col gap-2">
          {status.catalogs.map((catalog) => {
            const whole = isWhole(catalog.name);
            const pickedCount = catalog.skills.filter((k) => isPicked(catalog.name, k.name)).length;
            const states = skillsByCatalog.get(catalog.name);
            return (
              <li
                key={catalog.name}
                className={`rounded-lg border p-3 ${pickedCount > 0 ? "border-gray-400 dark:border-gray-600" : "border-gray-200 dark:border-gray-800"}`}
              >
                <label className="flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
                  <TriStateCheckbox
                    checked={whole}
                    indeterminate={!whole && pickedCount > 0}
                    onChange={() => toggleCatalog(catalog)}
                  />
                  {catalog.name}
                  <span className="text-xs font-normal text-gray-400">
                    {whole
                      ? t("skillsHub.manage.wholeCatalog", { count: catalog.skills.length })
                      : t("skillsHub.manage.pickedCount", {
                          picked: pickedCount,
                          count: catalog.skills.length,
                        })}
                  </span>
                </label>
                <ul className="mt-2 flex flex-wrap gap-1.5 pl-6">
                  {catalog.skills.map((skill) => {
                    const picked = isPicked(catalog.name, skill.name);
                    // Link state reflects what's saved — only shown while the skill is still picked.
                    const state = picked ? states?.get(skill.name) : undefined;
                    return (
                      <li key={skill.name} className="flex items-center">
                        <Tooltip
                          content={
                            <span className="block max-w-md whitespace-pre-line font-normal">
                              {skill.description || t("skillsHub.preview.noDescription")}
                            </span>
                          }
                        >
                          <button
                            type="button"
                            aria-pressed={picked}
                            onClick={() => toggleSkill(catalog, skill.name)}
                            className={`flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[11px] transition-colors ${
                              !picked
                                ? "border-gray-200 text-gray-500 hover:border-gray-400 dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-500"
                                : state
                                  ? `border-transparent ${STATE_CLASSES[state]}`
                                  : "border-gray-500 bg-gray-100 text-gray-800 dark:border-gray-400 dark:bg-gray-800 dark:text-gray-100"
                            }`}
                          >
                            {picked ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                            {skill.name}
                            {state && state !== "linked" && <> · {t(STATE_LABEL_KEYS[state])}</>}
                          </button>
                        </Tooltip>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="ml-0.5 p-0.5!"
                          aria-label={t("skillsHub.preview.open", { name: skill.name })}
                          onClick={() => onPreview(catalog.name, skill.name)}
                          icon={<Info className="h-3.5 w-3.5" />}
                        />
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
        {duplicateNames.length > 0 && (
          <p className="mt-2 flex items-start gap-1 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            {t("skillsHub.manage.duplicates", { names: duplicateNames.join(", ") })}
          </p>
        )}
      </section>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        {t("skillsHub.manage.newSessionsNote")}
      </p>
    </div>
  );
}

/** "Open skills in the file manager" — a small menu offering the hub clone or the machine's own
 *  `~/.claude/skills` (where the links live). Both paths are resolved server-side. */
function OpenFolderMenu({ hubPath, userSkillsDir }: { hubPath: string; userSkillsDir: string }) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const openFolder = async (target: "hub" | "userSkills") => {
    setOpen(false);
    setBusy(true);
    try {
      await tasksApi.openSkillsFolder(target);
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "skillsHub.manage.openFolderError"), "error");
    } finally {
      setBusy(false);
    }
  };

  const options = [
    { target: "hub" as const, label: t("skillsHub.manage.openHub"), path: hubPath },
    {
      target: "userSkills" as const,
      label: t("skillsHub.manage.openUserSkills"),
      path: userSkillsDir,
    },
  ];

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        icon={
          busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FolderOpen className="h-3.5 w-3.5" />
          )
        }
      >
        {t("skillsHub.manage.openFolder")}
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-1 w-80 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900"
        >
          {options.map((option) => (
            <button
              key={option.target}
              type="button"
              role="menuitem"
              onClick={() => void openFolder(option.target)}
              className="block w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <span className="block text-sm text-gray-900 dark:text-gray-100">{option.label}</span>
              <span className="block break-all font-mono text-xs text-gray-500 dark:text-gray-400">
                {option.path}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item) => b.includes(item));
}

function sameSelection(a: SkillsSelection, b: SkillsSelection): boolean {
  return sameSet(a.catalogs, b.catalogs) && sameSet(a.skills, b.skills);
}

/** Native checkbox with the "some but not all" state, which only exists as a DOM property. */
function TriStateCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
}) {
  return (
    <input
      type="checkbox"
      ref={(element) => {
        if (element) element.indeterminate = indeterminate;
      }}
      checked={checked}
      onChange={onChange}
      className="h-4 w-4 accent-gray-900 dark:accent-gray-100"
    />
  );
}
