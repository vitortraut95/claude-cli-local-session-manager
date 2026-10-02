import { Copy, FileUp, GitBranch, Info, Loader2, Replace, TriangleAlert } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useToast } from "../hooks/useToast";
import * as sessionsApi from "../services/sessionsApi";
import type { ImportConflictResolution } from "../services/sessionsApi";
import type { SessionImportCandidate, SessionImportPreview } from "../types/session";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { formatUpdatedAt } from "../utils/formatDate";
import { formatBytes } from "../utils/sessionSize";
import { Button } from "./Button";
import { Input } from "./Input";
import { Modal } from "./Modal";
import { Select } from "./Select";

type ImportSessionModalProps = {
  onClose: () => void;
  /** Fired with the imported session's id (a fresh one when imported as a copy). */
  onImported: (sessionId: string) => void;
};

/** `<select>` value for the free-text folder option — can't collide with a real absolute path. */
const OTHER_FOLDER = "__other__";

function defaultFolder(preview: SessionImportPreview): string {
  return (
    preview.candidates.find((c) => c.remoteMatches)?.repoRoot ??
    preview.candidates[0]?.repoRoot ??
    OTHER_FOLDER
  );
}

/** Checked only when switching is actually needed and safe: the session has a branch, the target
 *  isn't already on it, and nothing is running in that folder. */
function defaultCheckout(preview: SessionImportPreview, candidate: SessionImportCandidate | null) {
  return Boolean(
    preview.gitBranch &&
      candidate &&
      !candidate.hasActiveSession &&
      candidate.currentBranch !== preview.gitBranch,
  );
}

/**
 * Two steps, both inside this one modal: pick an exported session file (inspected server-side,
 * nothing written — see `inspectSessionBundle`), then choose which local clone it lands in and
 * whether to check out its branch there first. Mounted only while open (same convention as
 * NicknameModal), so every open starts from a clean "pick a file" state.
 */
export function ImportSessionModal({ onClose, onImported }: ImportSessionModalProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<SessionImportPreview | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [folder, setFolder] = useState(OTHER_FOLDER);
  const [customFolder, setCustomFolder] = useState("");
  const [checkoutBranch, setCheckoutBranch] = useState(false);
  const [importing, setImporting] = useState(false);
  // No default on purpose — when the id already exists, the user has to pick explicitly.
  const [onConflict, setOnConflict] = useState<ImportConflictResolution | null>(null);

  const candidate =
    preview?.candidates.find((c) => c.repoRoot === folder) ?? null;
  const targetDir = folder === OTHER_FOLDER ? customFolder.trim() : folder;

  const handleFileChosen = async (chosen: File | undefined) => {
    if (!chosen) return;
    setFile(chosen);
    setPreview(null);
    setInspectError(null);
    setOnConflict(null);
    setInspecting(true);
    try {
      const result = await sessionsApi.inspectSessionImport(chosen);
      const initialFolder = defaultFolder(result);
      setPreview(result);
      setFolder(initialFolder);
      setCheckoutBranch(
        defaultCheckout(result, result.candidates.find((c) => c.repoRoot === initialFolder) ?? null),
      );
    } catch (err) {
      setInspectError(resolveApiErrorMessage(err, t, "importSessionModal.inspectError"));
    } finally {
      setInspecting(false);
    }
  };

  const handleFolderChange = (value: string) => {
    setFolder(value);
    if (preview) {
      setCheckoutBranch(
        defaultCheckout(preview, preview.candidates.find((c) => c.repoRoot === value) ?? null),
      );
    }
  };

  const handleImport = async () => {
    if (!file || !preview || !targetDir) return;
    setImporting(true);
    try {
      const result = await sessionsApi.importSession(
        file,
        targetDir,
        checkoutBranch && Boolean(preview.gitBranch),
        preview.existingSession ? onConflict : null,
      );
      showToast(
        result.overwritten
          ? t("importSessionModal.successOverwrite")
          : result.importedAsCopy
            ? t("importSessionModal.successCopy")
            : t("importSessionModal.success"),
        "success",
      );
      onImported(result.sessionId);
      onClose();
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "importSessionModal.importError"), "error");
    } finally {
      setImporting(false);
    }
  };

  const checkoutBlocked = candidate?.hasActiveSession ?? false;
  const existing = preview?.existingSession ?? null;
  const conflictUnresolved = existing !== null && onConflict === null;
  const alreadyOnBranch =
    candidate !== null && preview?.gitBranch != null && candidate.currentBranch === preview.gitBranch;

  return (
    <Modal
      open
      title={t("importSessionModal.title")}
      onClose={onClose}
      onCancel={onClose}
      onConfirm={preview ? () => void handleImport() : undefined}
      confirmLabel={
        onConflict === "overwrite" && existing
          ? t("importSessionModal.confirmOverwrite")
          : t("importSessionModal.confirm")
      }
      confirmVariant={onConflict === "overwrite" && existing ? "danger" : "primary"}
      cancelLabel={t("importSessionModal.cancel")}
      isConfirmLoading={importing}
      isConfirmDisabled={!targetDir || conflictUnresolved}
      size="lg"
      icon={<FileUp className="h-5 w-5 text-gray-500 dark:text-gray-400" />}
    >
      <p className="text-sm text-gray-600 dark:text-gray-400">{t("importSessionModal.intro")}</p>

      <input
        ref={fileInputRef}
        type="file"
        accept=".gz,.json,application/gzip,application/json"
        className="hidden"
        onChange={(event) => {
          void handleFileChosen(event.target.files?.[0]);
          // Lets the same file be picked again after an error.
          event.target.value = "";
        }}
      />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={inspecting || importing}
          icon={
            inspecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileUp className="h-4 w-4" />
            )
          }
        >
          {file ? t("importSessionModal.chooseAnother") : t("importSessionModal.chooseFile")}
        </Button>
        {file && (
          <span className="break-all font-mono text-xs text-gray-500 dark:text-gray-400">
            {file.name}
          </span>
        )}
      </div>

      {inspectError && (
        <p className="mt-3 flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {inspectError}
        </p>
      )}

      {preview && (
        <>
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-800">
            <PreviewRow label={t("importSessionModal.field.title")}>{preview.title}</PreviewRow>
            {preview.nickname && (
              <PreviewRow label={t("importSessionModal.field.nickname")}>
                {preview.nickname}
              </PreviewRow>
            )}
            {preview.gitBranch && (
              <PreviewRow label={t("importSessionModal.field.branch")}>
                <span className="font-mono">{preview.gitBranch}</span>
              </PreviewRow>
            )}
            {preview.remoteUrl && (
              <PreviewRow label={t("importSessionModal.field.remote")}>
                <span className="font-mono">{preview.remoteUrl}</span>
              </PreviewRow>
            )}
            {preview.originalCwd && (
              <PreviewRow label={t("importSessionModal.field.originalFolder")}>
                <span className="font-mono">{preview.originalCwd}</span>
              </PreviewRow>
            )}
            <PreviewRow label={t("importSessionModal.field.lastActivity")}>
              {formatUpdatedAt(preview.updatedAt)}
            </PreviewRow>
            <PreviewRow label={t("importSessionModal.field.size")}>
              {formatBytes(preview.sizeBytes)}
              {preview.subagentCount > 0 &&
                ` · ${t("importSessionModal.subagents", { count: preview.subagentCount })}`}
            </PreviewRow>
          </dl>

          {existing && (
            <ConflictChoice
              existing={existing}
              incomingUpdatedAt={preview.updatedAt}
              incomingSizeBytes={preview.sizeBytes}
              value={onConflict}
              onChange={setOnConflict}
            />
          )}

          <label className="mt-4 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("importSessionModal.targetLabel")}
          </label>
          <div className="mt-1.5">
            <Select value={folder} onChange={(event) => handleFolderChange(event.target.value)}>
              {preview.candidates.map((c) => (
                <option key={c.repoRoot} value={c.repoRoot}>
                  {c.remoteMatches
                    ? t("importSessionModal.sameRepoOption", { path: c.repoRoot })
                    : c.repoRoot}
                </option>
              ))}
              <option value={OTHER_FOLDER}>{t("importSessionModal.otherFolderOption")}</option>
            </Select>
          </div>
          {folder === OTHER_FOLDER && (
            <Input
              type="text"
              value={customFolder}
              onChange={(event) => setCustomFolder(event.target.value)}
              placeholder={t("importSessionModal.otherFolderPlaceholder")}
              autoFocus
              className="mt-2 font-mono"
            />
          )}

          {candidate && candidate.targetCwd !== candidate.repoRoot && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {t("importSessionModal.subfolderHint")}{" "}
              <span className="font-mono">{candidate.targetCwd}</span>
            </p>
          )}
          {candidate && !candidate.remoteMatches && preview.remoteUrl && (
            <Notice tone="warning">{t("importSessionModal.remoteMismatch")}</Notice>
          )}
          {candidate && preview.commit && !candidate.commitExistsLocally && (
            <Notice tone="warning">
              {t("importSessionModal.commitMissing", { commit: preview.commit.slice(0, 10) })}
            </Notice>
          )}

          {preview.gitBranch && !alreadyOnBranch && (
            <label
              className={`mt-4 flex items-start gap-2 text-sm ${checkoutBlocked ? "text-gray-400 dark:text-gray-500" : "text-gray-700 dark:text-gray-300"}`}
            >
              <input
                type="checkbox"
                checked={checkoutBranch && !checkoutBlocked}
                disabled={checkoutBlocked}
                onChange={(event) => setCheckoutBranch(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-gray-900 dark:accent-gray-100"
              />
              <span>
                <span className="flex items-center gap-1">
                  <GitBranch className="h-3.5 w-3.5" />
                  {t("importSessionModal.checkoutLabel", { branch: preview.gitBranch })}
                </span>
                <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                  {checkoutBlocked
                    ? t("importSessionModal.checkoutBlocked")
                    : candidate?.currentBranch
                      ? t("importSessionModal.checkoutHintWithCurrent", {
                          current: candidate.currentBranch,
                        })
                      : t("importSessionModal.checkoutHint")}
                </span>
              </span>
            </label>
          )}
          {alreadyOnBranch && (
            <p className="mt-4 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <GitBranch className="h-3.5 w-3.5" />
              {t("importSessionModal.alreadyOnBranch", { branch: preview.gitBranch ?? "" })}
            </p>
          )}
        </>
      )}
    </Modal>
  );
}

type ConflictChoiceProps = {
  existing: NonNullable<SessionImportPreview["existingSession"]>;
  incomingUpdatedAt: string;
  incomingSizeBytes: number;
  value: ImportConflictResolution | null;
  onChange: (value: ImportConflictResolution) => void;
};

/** Shown only when the file's session id already exists here: what's local vs. what's coming in
 *  (last activity + size is usually enough to tell "newer export of the same session" from "an
 *  old one"), then an explicit overwrite-or-copy pick before Import enables. */
function ConflictChoice({
  existing,
  incomingUpdatedAt,
  incomingSizeBytes,
  value,
  onChange,
}: ConflictChoiceProps) {
  const { t } = useLanguage();
  const incomingTime = new Date(incomingUpdatedAt).getTime();
  const localTime = new Date(existing.updatedAt).getTime();
  // Within a second and the same size = the same snapshot (mtime is restored on import, but
  // filesystems round it differently).
  const comparison =
    Math.abs(incomingTime - localTime) < 1000 && incomingSizeBytes === existing.sizeBytes
      ? "importSessionModal.conflict.incomingSame"
      : incomingTime > localTime
        ? "importSessionModal.conflict.incomingNewer"
        : "importSessionModal.conflict.incomingOlder";

  return (
    <div className="mt-4 rounded-lg border border-amber-300 p-3 dark:border-amber-800/70">
      <p className="flex items-start gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
        {t("importSessionModal.conflict.title")}
      </p>

      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <div className="rounded-md bg-gray-50 p-2 dark:bg-gray-800/60">
          <p className="font-medium text-gray-700 dark:text-gray-300">
            {t("importSessionModal.conflict.local")}
          </p>
          <p className="mt-1 break-words text-gray-900 dark:text-gray-100">
            {existing.nickname ?? existing.title}
          </p>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            {formatUpdatedAt(existing.updatedAt)} · {formatBytes(existing.sizeBytes)}
          </p>
          {existing.workingDirectory && (
            <p className="mt-1 break-all font-mono text-gray-500 dark:text-gray-400">
              {existing.workingDirectory}
            </p>
          )}
        </div>
        <div className="rounded-md bg-gray-50 p-2 dark:bg-gray-800/60">
          <p className="font-medium text-gray-700 dark:text-gray-300">
            {t("importSessionModal.conflict.incoming")}
          </p>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            {formatUpdatedAt(incomingUpdatedAt)} · {formatBytes(incomingSizeBytes)}
          </p>
          <p className="mt-1 font-medium text-gray-600 dark:text-gray-300">
            {t(comparison)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <ConflictOption
          checked={value === "copy"}
          onSelect={() => onChange("copy")}
          icon={<Copy className="h-3.5 w-3.5" />}
          title={t("importSessionModal.conflict.copy.title")}
          body={t("importSessionModal.conflict.copy.body")}
        />
        <ConflictOption
          checked={value === "overwrite"}
          onSelect={() => onChange("overwrite")}
          disabled={existing.isActive}
          icon={<Replace className="h-3.5 w-3.5" />}
          title={t("importSessionModal.conflict.overwrite.title")}
          body={
            existing.isActive
              ? t("importSessionModal.conflict.overwrite.blockedActive")
              : t("importSessionModal.conflict.overwrite.body")
          }
        />
      </div>
    </div>
  );
}

function ConflictOption({
  checked,
  onSelect,
  disabled = false,
  icon,
  title,
  body,
}: {
  checked: boolean;
  onSelect: () => void;
  disabled?: boolean;
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <label
      className={`flex items-start gap-2 rounded-md border p-2 text-sm ${
        checked
          ? "border-gray-900 dark:border-gray-100"
          : "border-gray-200 dark:border-gray-800"
      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      <input
        type="radio"
        name="import-conflict"
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        className="mt-0.5 h-4 w-4 accent-gray-900 dark:accent-gray-100"
      />
      <span>
        <span className="flex items-center gap-1 font-medium text-gray-800 dark:text-gray-200">
          {icon}
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{body}</span>
      </span>
    </label>
  );
}

function PreviewRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="min-w-0 break-all text-gray-900 dark:text-gray-100">{children}</dd>
    </>
  );
}

function Notice({ tone, children }: { tone: "info" | "warning"; children: ReactNode }) {
  const toneClasses =
    tone === "warning"
      ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
      : "bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300";
  const Icon = tone === "warning" ? TriangleAlert : Info;
  return (
    <p className={`mt-3 flex gap-2 rounded-lg p-3 text-xs ${toneClasses}`}>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
