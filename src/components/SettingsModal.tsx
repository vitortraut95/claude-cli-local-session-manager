import {
  ArrowDown,
  ArrowUp,
  FileCode2,
  Loader2,
  Pencil,
  Plus,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useSkillsHubStatus } from "../hooks/useSkillsHubStatus";
import type { Theme } from "../hooks/useTheme";
import { useToast } from "../hooks/useToast";
import * as tasksApi from "../services/tasksApi";
import type { EnvPreviews, UserPreferences } from "../services/tasksApi";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { Button } from "./Button";
import { Input } from "./Input";
import { Modal } from "./Modal";
import { SkillsHubModal } from "./SkillsHubModal";
import { ThemeToggle } from "./ThemeToggle";
import { WorkspaceDirsEditor } from "./WorkspaceDirsEditor";

type SettingsModalProps = {
  theme: Theme;
  onToggleTheme: () => void;
  onClose: () => void;
  /** Re-opens the onboarding walkthrough (the `hasSeenOnboarding` row's action). */
  onShowOnboarding: () => void;
};

/** Keys edited in a big secondary modal rather than inline in their row. */
type BigEditorKey =
  | "workspaceDirs"
  | "defaultPrompt"
  | "branchTypes"
  | "recentProjectPaths"
  | "jenkinsBaseUrl"
  | "envPreviews";

/** The envPreviews editor's JSON draft, parsed — null when it isn't valid JSON of the right shape. */
function parseEnvPreviews(raw: string): EnvPreviews | null {
  try {
    const parsed: unknown = JSON.parse(raw.trim() || "{}");
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    const valid = Object.values(parsed as Record<string, unknown>).every(
      (list) =>
        Array.isArray(list) &&
        list.every(
          (item: unknown) =>
            typeof item === "object" &&
            item !== null &&
            typeof (item as Record<string, unknown>).label === "string" &&
            typeof (item as Record<string, unknown>).url === "string",
        ),
    );
    return valid ? (parsed as EnvPreviews) : null;
  } catch {
    return null;
  }
}

/**
 * Every `userPreferences.json` key, one row each (friendly name, description, the raw key, a
 * one-line preview of the value), with an editor matched to the value's type instead of raw JSON
 * — a malformed value would just be rejected by the server's PUT validation. Text and lists open a
 * big editor modal; booleans and the number are edited right in their row. `language` is left out
 * on purpose — the header's own switcher already covers it. Every
 * save goes through `tasksApi.updatePreferences` (fetch-merge-PUT, serialized) and then
 * `notifyPreferencesChanged`, so components holding their own copy (NewTaskModal) reload it.
 */
export function SettingsModal({
  theme,
  onToggleTheme,
  onClose,
  onShowOnboarding,
}: SettingsModalProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<BigEditorKey | null>(null);
  const [savingKey, setSavingKey] = useState<keyof UserPreferences | null>(null);
  const [openingFile, setOpeningFile] = useState(false);
  const [skillsHubOpen, setSkillsHubOpen] = useState(false);
  const { status: skillsHub } = useSkillsHubStatus(true);

  const reload = useCallback(async () => {
    try {
      setPrefs(await tasksApi.fetchPreferences());
      setLoadError(null);
    } catch (err) {
      setLoadError(resolveApiErrorMessage(err, t, "settings.loadError"));
    }
  }, [t]);

  useEffect(() => {
    // Fetch-on-mount — the state updates only happen after the await inside `reload`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  const save = async (partial: Partial<UserPreferences>): Promise<boolean> => {
    const key = Object.keys(partial)[0] as keyof UserPreferences;
    setSavingKey(key);
    try {
      await tasksApi.updatePreferences(partial);
      tasksApi.notifyPreferencesChanged();
      await reload();
      showToast(t("settings.saved"), "success");
      return true;
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "settings.saveError"), "error");
      return false;
    } finally {
      setSavingKey(null);
    }
  };

  const openFile = async () => {
    setOpeningFile(true);
    try {
      await tasksApi.openPreferencesInEditor();
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "settings.openFileError"), "error");
    } finally {
      setOpeningFile(false);
    }
  };

  const listPreview = (items: string[]) =>
    items.length > 0 ? items.join(", ") : t("settings.preview.emptyList");

  return (
    <Modal
      open
      title={t("settings.title")}
      // Escape would otherwise close this modal too while a big editor is open on top of it.
      onClose={() => {
        if (!editing && !skillsHubOpen) onClose();
      }}
      size="xl"
      icon={<Settings className="h-5 w-5 text-gray-500 dark:text-gray-400" />}
    >
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">{t("settings.intro")}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void openFile()}
          disabled={openingFile}
          icon={
            openingFile ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileCode2 className="h-3.5 w-3.5" />
            )
          }
        >
          {t("settings.openFile")}
        </Button>
      </div>

      {loadError && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{loadError}</p>}
      {!prefs && !loadError && (
        <p className="mt-4 flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("settings.loading")}
        </p>
      )}

      {prefs && (
        <ul className="mt-4 divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          <SettingRow
            title={t("settings.workspaceDirs.title")}
            description={t("settings.workspaceDirs.description")}
            keyName="workspaceDirs"
            preview={
              prefs.workspaceDirs == null ? (
                <span className="text-amber-600 dark:text-amber-400">
                  {t("settings.preview.notSet")}
                </span>
              ) : (
                listPreview(prefs.workspaceDirs)
              )
            }
            control={<EditButton onClick={() => setEditing("workspaceDirs")} />}
          />
          <SettingRow
            title={t("settings.skillsHub.title")}
            description={t("settings.skillsHub.description")}
            keyName="skillsHub"
            preview={
              skillsHub === null ? undefined : skillsHub.notUsed ? (
                t("settings.preview.notUsed")
              ) : skillsHub.cloneUrl === null ? (
                <span className="text-amber-600 dark:text-amber-400">
                  {t("settings.skillsHub.noRepo")}
                </span>
              ) : !skillsHub.found ? (
                <span className="text-amber-600 dark:text-amber-400">
                  {t("settings.skillsHub.notInstalled")}
                </span>
              ) : (
                `${skillsHub.path ?? ""} · ${
                  skillsHub.selectedCatalogs.length > 0
                    ? skillsHub.selectedCatalogs.join(", ")
                    : t("settings.skillsHub.noCatalogs")
                }`
              )
            }
            control={
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSkillsHubOpen(true)}
                icon={<Sparkles className="h-3.5 w-3.5" />}
              >
                {t("settings.skillsHub.manage")}
              </Button>
            }
          />
          {prefs.jenkinsBaseUrl !== undefined && (
            <SettingRow
              title={t("settings.jenkinsBaseUrl.title")}
              description={t("settings.jenkinsBaseUrl.description")}
              keyName="jenkinsBaseUrl"
              preview={
                prefs.jenkinsBaseUrl === null ? (
                  <span className="text-amber-600 dark:text-amber-400">
                    {t("settings.preview.notSet")}
                  </span>
                ) : (
                  prefs.jenkinsBaseUrl || t("settings.preview.notUsed")
                )
              }
              control={<EditButton onClick={() => setEditing("jenkinsBaseUrl")} />}
            />
          )}
          {prefs.envPreviews !== undefined && (
            <SettingRow
              title={t("settings.envPreviews.title")}
              description={t("settings.envPreviews.description")}
              keyName="envPreviews"
              preview={
                Object.keys(prefs.envPreviews).length > 0
                  ? t("settings.envPreviews.preview", {
                      count: Object.keys(prefs.envPreviews).length,
                      projects: Object.keys(prefs.envPreviews).join(", "),
                    })
                  : t("settings.preview.emptyList")
              }
              control={<EditButton onClick={() => setEditing("envPreviews")} />}
            />
          )}
          <SettingRow
            title={t("settings.defaultPrompt.title")}
            description={t("settings.defaultPrompt.description")}
            keyName="defaultPrompt"
            preview={
              prefs.defaultPrompt.trim()
                ? t("settings.preview.text", {
                    firstLine: prefs.defaultPrompt.trim().split("\n")[0] ?? "",
                    lines: prefs.defaultPrompt.split("\n").length,
                  })
                : t("settings.preview.emptyText")
            }
            control={<EditButton onClick={() => setEditing("defaultPrompt")} />}
          />
          <SettingRow
            title={t("settings.branchTypes.title")}
            description={t("settings.branchTypes.description")}
            keyName="branchTypes"
            preview={listPreview(prefs.branchTypes)}
            control={<EditButton onClick={() => setEditing("branchTypes")} />}
          />
          <SettingRow
            title={t("settings.recentProjectPaths.title")}
            description={t("settings.recentProjectPaths.description")}
            keyName="recentProjectPaths"
            preview={listPreview(prefs.recentProjectPaths)}
            control={<EditButton onClick={() => setEditing("recentProjectPaths")} />}
          />
          <SettingRow
            title={t("settings.useWorktreeByDefault.title")}
            description={t("settings.useWorktreeByDefault.description")}
            keyName="useWorktreeByDefault"
            control={
              <Toggle
                checked={prefs.useWorktreeByDefault}
                busy={savingKey === "useWorktreeByDefault"}
                onChange={(checked) => void save({ useWorktreeByDefault: checked })}
              />
            }
          />
          <SettingRow
            title={t("settings.useAutoPermissionModeByDefault.title")}
            description={t("settings.useAutoPermissionModeByDefault.description")}
            keyName="useAutoPermissionModeByDefault"
            control={
              <Toggle
                checked={prefs.useAutoPermissionModeByDefault}
                busy={savingKey === "useAutoPermissionModeByDefault"}
                onChange={(checked) => void save({ useAutoPermissionModeByDefault: checked })}
              />
            }
          />
          <SettingRow
            title={t("settings.keepRecentSessionsPerProject.title")}
            description={t("settings.keepRecentSessionsPerProject.description")}
            keyName="keepRecentSessionsPerProject"
            control={
              <NumberField
                value={prefs.keepRecentSessionsPerProject}
                busy={savingKey === "keepRecentSessionsPerProject"}
                onCommit={(next) => void save({ keepRecentSessionsPerProject: next })}
              />
            }
          />
          <ThemeRow theme={theme} onToggle={onToggleTheme} />
          <SettingRow
            title={t("settings.hasSeenOnboarding.title")}
            description={t("settings.hasSeenOnboarding.description")}
            keyName="hasSeenOnboarding"
            control={
              <Button variant="outline" size="sm" onClick={onShowOnboarding}>
                {t("settings.hasSeenOnboarding.action")}
              </Button>
            }
          />
        </ul>
      )}

      {prefs && editing === "workspaceDirs" && (
        <BigEditorModal
          title={t("settings.workspaceDirs.title")}
          description={t("settings.workspaceDirs.description")}
          initial={prefs.workspaceDirs ?? []}
          onCancel={() => setEditing(null)}
          onSave={async (value) => {
            if (await save({ workspaceDirs: value })) setEditing(null);
          }}
          render={(value, setValue) => <WorkspaceDirsEditor value={value} onChange={setValue} />}
        />
      )}
      {prefs && editing === "jenkinsBaseUrl" && (
        <BigEditorModal
          title={t("settings.jenkinsBaseUrl.title")}
          description={t("settings.jenkinsBaseUrl.description")}
          initial={prefs.jenkinsBaseUrl ?? ""}
          onCancel={() => setEditing(null)}
          onSave={async (value) => {
            if (await save({ jenkinsBaseUrl: value.trim() })) setEditing(null);
          }}
          render={(value, setValue) => (
            <Input
              type="url"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="https://jenkins.example.com"
              className="font-mono"
              autoFocus
            />
          )}
        />
      )}
      {prefs && editing === "envPreviews" && (
        <BigEditorModal
          title={t("settings.envPreviews.title")}
          description={t("settings.envPreviews.description")}
          initial={JSON.stringify(prefs.envPreviews ?? {}, null, 2)}
          canSave={(value) => parseEnvPreviews(value) !== null}
          onCancel={() => setEditing(null)}
          onSave={async (value) => {
            const parsed = parseEnvPreviews(value);
            if (parsed && (await save({ envPreviews: parsed }))) setEditing(null);
          }}
          render={(value, setValue) => (
            <>
              <textarea
                value={value}
                onChange={(event) => setValue(event.target.value)}
                autoFocus
                rows={24}
                spellCheck={false}
                className="w-full rounded-lg border border-gray-300 bg-white p-3 font-mono text-xs text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
              {parseEnvPreviews(value) === null && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                  {t("settings.envPreviews.invalid")}
                </p>
              )}
            </>
          )}
        />
      )}
      {skillsHubOpen && <SkillsHubModal onClose={() => setSkillsHubOpen(false)} />}
      {prefs && editing === "defaultPrompt" && (
        <BigEditorModal
          title={t("settings.defaultPrompt.title")}
          description={t("settings.defaultPrompt.description")}
          initial={prefs.defaultPrompt}
          onCancel={() => setEditing(null)}
          onSave={async (value) => {
            if (await save({ defaultPrompt: value })) setEditing(null);
          }}
          render={(value, setValue) => (
            <textarea
              value={value}
              onChange={(event) => setValue(event.target.value)}
              autoFocus
              rows={24}
              className="w-full rounded-lg border border-gray-300 bg-white p-3 font-mono text-xs text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          )}
        />
      )}
      {prefs && editing === "branchTypes" && (
        <BigEditorModal
          title={t("settings.branchTypes.title")}
          description={t("settings.branchTypes.description")}
          initial={prefs.branchTypes}
          canSave={(value) => value.length > 0}
          onCancel={() => setEditing(null)}
          onSave={async (value) => {
            if (await save({ branchTypes: value })) setEditing(null);
          }}
          render={(value, setValue) => (
            <StringListEditor
              value={value}
              onChange={setValue}
              placeholder={t("settings.branchTypes.placeholder")}
              firstItemHint={t("settings.branchTypes.firstIsDefault")}
            />
          )}
        />
      )}
      {prefs && editing === "recentProjectPaths" && (
        <BigEditorModal
          title={t("settings.recentProjectPaths.title")}
          description={t("settings.recentProjectPaths.description")}
          initial={prefs.recentProjectPaths}
          onCancel={() => setEditing(null)}
          onSave={async (value) => {
            if (await save({ recentProjectPaths: value })) setEditing(null);
          }}
          render={(value, setValue) => (
            <StringListEditor
              value={value}
              onChange={setValue}
              placeholder={t("settings.recentProjectPaths.placeholder")}
              mono
            />
          )}
        />
      )}
    </Modal>
  );
}

/** Theme isn't a `userPreferences.json` key — it's per-browser (localStorage, see useTheme) — so
 *  this row shows no key name, just a note saying where it lives. */
function ThemeRow({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const { t } = useLanguage();
  return (
    <li className="flex items-center gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {t("settings.theme.title")}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{t("settings.theme.description")}</p>
      </div>
      <div className="shrink-0">
        <ThemeToggle theme={theme} onToggle={onToggle} />
      </div>
    </li>
  );
}

function SettingRow({
  title,
  description,
  keyName,
  preview,
  control,
}: {
  title: string;
  description: string;
  keyName: keyof UserPreferences;
  preview?: ReactNode;
  control: ReactNode;
}) {
  return (
    <li className="flex items-center gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium text-gray-900 dark:text-gray-100">
          {title}
          <code className="text-[10px] font-normal text-gray-400 dark:text-gray-500">{keyName}</code>
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
        {preview !== undefined && (
          <p className="mt-1 truncate font-mono text-xs text-gray-700 dark:text-gray-300">
            {preview}
          </p>
        )}
      </div>
      <div className="shrink-0">{control}</div>
    </li>
  );
}

function EditButton({ onClick }: { onClick: () => void }) {
  const { t } = useLanguage();
  return (
    <Button variant="outline" size="sm" onClick={onClick} icon={<Pencil className="h-3.5 w-3.5" />}>
      {t("settings.edit")}
    </Button>
  );
}

function Toggle({
  checked,
  busy,
  onChange,
}: {
  checked: boolean;
  busy: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <span className="flex items-center gap-2">
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={busy}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-60 ${
          checked ? "bg-gray-900 dark:bg-gray-200" : "bg-gray-300 dark:bg-gray-700"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform dark:bg-gray-900 ${
            checked ? "translate-x-4.5" : "translate-x-0.5"
          }`}
        />
      </button>
    </span>
  );
}

function NumberField({
  value,
  busy,
  onCommit,
}: {
  value: number;
  busy: boolean;
  onCommit: (next: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const commit = () => {
    const parsed = Number(draft);
    if (Number.isInteger(parsed) && parsed >= 0 && parsed !== value) onCommit(parsed);
    else setDraft(String(value));
  };
  return (
    <span className="flex items-center gap-2">
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
      {/* Input's own wrapper is full-width, so the width has to be set out here. */}
      <div className="w-20">
        <Input
          type="number"
          min={0}
          step={1}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
          }}
        />
      </div>
    </span>
  );
}

/** Big secondary editor: holds its own draft so Cancel discards, Save commits. */
function BigEditorModal<T>({
  title,
  description,
  initial,
  canSave = () => true,
  onCancel,
  onSave,
  render,
}: {
  title: string;
  description: string;
  initial: T;
  canSave?: (value: T) => boolean;
  onCancel: () => void;
  onSave: (value: T) => Promise<void>;
  render: (value: T, setValue: (value: T) => void) => ReactNode;
}) {
  const { t } = useLanguage();
  const [value, setValue] = useState<T>(initial);
  const [saving, setSaving] = useState(false);
  return (
    <Modal
      open
      title={title}
      onClose={onCancel}
      onCancel={onCancel}
      onConfirm={() => {
        setSaving(true);
        void onSave(value).finally(() => setSaving(false));
      }}
      confirmLabel={t("settings.save")}
      cancelLabel={t("settings.cancel")}
      isConfirmLoading={saving}
      isConfirmDisabled={!canSave(value)}
      size="xxl"
    >
      <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">{description}</p>
      {render(value, setValue)}
    </Modal>
  );
}

function StringListEditor({
  value,
  onChange,
  placeholder,
  firstItemHint,
  mono = false,
}: {
  value: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  firstItemHint?: string;
  mono?: boolean;
}) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState("");
  const add = () => {
    const item = draft.trim();
    if (!item) return;
    if (!value.includes(item)) onChange([...value, item]);
    setDraft("");
  };
  const move = (index: number, delta: number) => {
    const next = [...value];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1.5">
        {value.map((item, index) => (
          <li
            key={item}
            className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-1.5 dark:border-gray-800"
          >
            <span
              className={`min-w-0 flex-1 break-all text-sm text-gray-900 dark:text-gray-100 ${mono ? "font-mono" : ""}`}
            >
              {item}
              {index === 0 && firstItemHint && (
                <span className="ml-2 text-xs text-gray-400">({firstItemHint})</span>
              )}
            </span>
            <Button
              variant="ghost"
              size="icon"
              disabled={index === 0}
              onClick={() => move(index, -1)}
              aria-label={t("settings.list.moveUp")}
              icon={<ArrowUp className="h-3.5 w-3.5" />}
            />
            <Button
              variant="ghost"
              size="icon"
              disabled={index === value.length - 1}
              onClick={() => move(index, 1)}
              aria-label={t("settings.list.moveDown")}
              icon={<ArrowDown className="h-3.5 w-3.5" />}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onChange(value.filter((_, i) => i !== index))}
              aria-label={t("settings.list.remove")}
              icon={<X className="h-3.5 w-3.5" />}
            />
          </li>
        ))}
        {value.length === 0 && (
          <li className="rounded-md border border-dashed border-gray-300 px-3 py-3 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
            {t("settings.preview.emptyList")}
          </li>
        )}
      </ul>
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") add();
            }}
            placeholder={placeholder}
            className={mono ? "font-mono" : ""}
          />
        </div>
        <Button
          variant="outline"
          onClick={add}
          disabled={!draft.trim()}
          icon={<Plus className="h-4 w-4" />}
        >
          {t("settings.list.add")}
        </Button>
      </div>
    </div>
  );
}
