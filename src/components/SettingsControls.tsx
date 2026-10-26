import { Loader2, Pencil } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useLanguage } from "../hooks/useLanguage";
import type { UserPreferences } from "../services/preferencesApi";
import { Button } from "./Button";
import { Input } from "./Input";

/** One `userPreferences.json` key in the settings list: title + key name + description, control on the right. */
export function PreferenceRow({
  title,
  description,
  keyName,
  preview,
  extra,
  control,
}: {
  title: string;
  description: string;
  keyName: keyof UserPreferences;
  preview?: ReactNode;
  /** Block under the description (status, actions) — unlike `preview`, not cut to one line. */
  extra?: ReactNode;
  control: ReactNode;
}) {
  return (
    <li className="flex items-center gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium text-gray-900 dark:text-gray-100">
          {title}
          <code className="text-[10px] font-normal text-gray-400 dark:text-gray-500">
            {keyName}
          </code>
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
        {preview !== undefined && (
          <p className="mt-1 truncate font-mono text-xs text-gray-700 dark:text-gray-300">
            {preview}
          </p>
        )}
        {extra}
      </div>
      <div className="shrink-0">{control}</div>
    </li>
  );
}

export function EditButton({ onClick }: { onClick: () => void }) {
  const { t } = useLanguage();
  return (
    <Button variant="outline" size="sm" onClick={onClick} icon={<Pencil className="h-3.5 w-3.5" />}>
      {t("settings.edit")}
    </Button>
  );
}

export function Toggle({
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

export function NumberField({
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
