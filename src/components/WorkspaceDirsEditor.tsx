import { CheckCircle2, FolderGit2, Loader2, Plus, TriangleAlert, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import * as tasksApi from "../services/tasksApi";
import type { WorkspaceDirStatus, WorkspaceDirSuggestion } from "../services/tasksApi";
import { Button } from "./Button";
import { Input } from "./Input";

type WorkspaceDirsEditorProps = {
  value: string[];
  onChange: (dirs: string[]) => void;
  /** First-time setup: once suggestions arrive, fill a still-empty list with the recommended
   *  ones (see server-side `suggestWorkspaceDirs`), so most users just confirm. */
  preselectRecommended?: boolean;
};

/**
 * Controlled list editor for `workspaceDirs`, shared by the startup prompt
 * (WorkspaceDirsPromptModal) and the settings modal. Every added folder goes through the server's
 * `inspect` first, so what lands in `value` is already normalized (`~` expanded, absolute) and each
 * row can show "N repos" or "doesn't exist" — a typo is visible before anything is saved.
 */
export function WorkspaceDirsEditor({
  value,
  onChange,
  preselectRecommended = false,
}: WorkspaceDirsEditorProps) {
  const { t } = useLanguage();
  const [suggestions, setSuggestions] = useState<WorkspaceDirSuggestion[] | null>(null);
  const [statuses, setStatuses] = useState<Record<string, WorkspaceDirStatus>>({});
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    tasksApi
      .fetchWorkspaceDirSuggestions()
      .then((result) => {
        if (cancelled) return;
        setSuggestions(result);
        if (preselectRecommended && value.length === 0) {
          const recommended = result.filter((s) => s.recommended).map((s) => s.dir);
          if (recommended.length > 0) onChange(recommended);
        }
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      });
    return () => {
      cancelled = true;
    };
    // Mount-only on purpose: preselection is a one-time starting value, not something to re-apply
    // whenever the user empties the list again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rows that arrived through `value` (e.g. the saved list) rather than `add` below have no status
  // yet — inspect just those.
  useEffect(() => {
    const unknown = value.filter((dir) => !(dir in statuses));
    if (unknown.length === 0) return;
    let cancelled = false;
    tasksApi
      .inspectWorkspaceDirs(unknown)
      .then((result) => {
        if (cancelled) return;
        setStatuses((prev) => {
          const next = { ...prev };
          unknown.forEach((dir, i) => {
            const status = result[i];
            if (status) next[dir] = status;
          });
          return next;
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [value, statuses]);

  const add = async (raw: string) => {
    if (!raw.trim()) return;
    setAdding(true);
    try {
      const [status] = await tasksApi.inspectWorkspaceDirs([raw]);
      if (!status) return;
      setStatuses((prev) => ({ ...prev, [status.dir]: status }));
      if (!value.includes(status.dir)) onChange([...value, status.dir]);
      setDraft("");
    } catch {
      // Inspect failed (backend unreachable) — keep the typed text so nothing is lost.
    } finally {
      setAdding(false);
    }
  };

  const remove = (dir: string) => onChange(value.filter((d) => d !== dir));
  const pendingSuggestions = (suggestions ?? []).filter((s) => !value.includes(s.dir));

  return (
    <div className="flex flex-col gap-3">
      {value.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {value.map((dir) => {
            const status = statuses[dir];
            return (
              <li
                key={dir}
                className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-800"
              >
                <FolderGit2 className="h-4 w-4 shrink-0 text-gray-400" />
                <span className="min-w-0 flex-1">
                  <span className="block break-all font-mono text-sm text-gray-900 dark:text-gray-100">
                    {dir}
                  </span>
                  <span className="text-xs">
                    {!status ? (
                      <span className="text-gray-400">…</span>
                    ) : !status.exists ? (
                      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <TriangleAlert className="h-3 w-3" />
                        {t("workspaceDirs.status.missing")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
                        <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
                        {t("workspaceDirs.status.repos", { count: status.repoCount })}
                      </span>
                    )}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(dir)}
                  aria-label={t("workspaceDirs.remove")}
                  icon={<X className="h-4 w-4" />}
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-md border border-dashed border-gray-300 px-3 py-3 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          {t("workspaceDirs.empty")}
        </p>
      )}

      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void add(draft);
            }}
            placeholder={t("workspaceDirs.placeholder")}
            className="font-mono"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => void add(draft)}
          disabled={adding || !draft.trim()}
          icon={
            adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />
          }
        >
          {t("workspaceDirs.add")}
        </Button>
      </div>

      {suggestions === null ? (
        <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t("workspaceDirs.loadingSuggestions")}
        </p>
      ) : (
        pendingSuggestions.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
              {t("workspaceDirs.suggestionsTitle")}
            </p>
            <div className="flex flex-wrap gap-2">
              {pendingSuggestions.map((s) => (
                <button
                  key={s.dir}
                  type="button"
                  onClick={() => void add(s.dir)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <Plus className="h-3 w-3" />
                  <span className="font-mono">{s.dir}</span>
                  <span className="text-gray-400">
                    · {t("workspaceDirs.status.repos", { count: s.repoCount })}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}
