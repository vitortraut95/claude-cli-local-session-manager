import { AlertTriangle, Check, Info, Link2, Loader2, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useToast } from "../hooks/useToast";
import type { TranslationKey } from "../i18n/translations";
import * as skillsHubApi from "../services/skillsHubApi";
import type {
  HubCatalog,
  HubSkill,
  SkillLinkState,
  SkillsHubStatus,
  SkillsSelection,
} from "../services/skillsHubApi";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { formatUpdatedAt } from "../utils/formatDate";
import { Button } from "./Button";
import { Select } from "./Select";
import { Tooltip } from "./Tooltip";

type SkillSort = "recent" | "name";
const SORT_KEY = "skillsHub.sort";

function readSort(): SkillSort {
  try {
    return localStorage.getItem(SORT_KEY) === "recent" ? "recent" : "name";
  } catch {
    return "name";
  }
}

function sortSkills(skills: HubSkill[], sort: SkillSort): HubSkill[] {
  if (sort === "name") return skills;
  return [...skills].sort(
    (a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "") || a.name.localeCompare(b.name),
  );
}

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

/** Picks whole catalogs or single skills from the hub; the draft is applied (linked) on demand. */
export function SkillsCatalogPicker({
  status,
  onChanged,
  onPreview,
}: {
  status: SkillsHubStatus;
  onChanged: () => Promise<void>;
  onPreview: (catalog: string, name: string) => void;
}) {
  const { t, language } = useLanguage();
  const { showToast } = useToast();
  const [author, setAuthor] = useState("");
  const [sort, setSort] = useState<SkillSort>(readSort);
  const changeSort = (value: SkillSort) => {
    setSort(value);
    try {
      localStorage.setItem(SORT_KEY, value);
    } catch {
      // Only a convenience: the default order still works.
    }
  };
  const authors = useMemo(
    () =>
      [...new Set(status.catalogs.flatMap((c) => c.skills.flatMap((k) => k.authors ?? [])))].sort(
        (a, b) => a.localeCompare(b, language === "pt" ? "pt-BR" : "en"),
      ),
    [status.catalogs, language],
  );
  // An author that disappeared from the hub (after a sync) falls back to "all".
  const activeAuthor = authors.includes(author) ? author : "";
  const saved = useMemo<SkillsSelection>(
    () => ({ catalogs: status.selectedCatalogs, skills: status.selectedSkills }),
    [status.selectedCatalogs, status.selectedSkills],
  );
  const [draft, setDraft] = useState<SkillsSelection>(saved);
  const [applying, setApplying] = useState(false);

  // A server-side change reseeds the draft only while the user hasn't started editing it.
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
  /** Saved skills linked only as a dependency of others: `<catalog>/<skill>` → who needs them. */
  const requiredBy = useMemo(
    () =>
      new Map(
        status.skills
          .filter((skill) => skill.requiredBy && skill.requiredBy.length > 0)
          .map((skill) => [`${skill.catalog}/${skill.name}`, skill.requiredBy!]),
      ),
    [status.skills],
  );

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
      const result = await skillsHubApi.setSkillsHubSelection(draft);
      skillsHubApi.notifySkillsHubChanged();
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

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="font-medium text-gray-900 dark:text-gray-100">
          {t("skillsHub.manage.catalogsTitle")}
        </h3>
        {authors.length > 0 && (
          <div className="w-48">
            <Select
              value={activeAuthor}
              onChange={(event) => setAuthor(event.target.value)}
              aria-label={t("skillsHub.manage.authorFilter")}
              className="py-1"
            >
              <option value="">{t("skillsHub.manage.allAuthors")}</option>
              {authors.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className="w-44">
          <Select
            value={sort}
            onChange={(event) => changeSort(event.target.value as SkillSort)}
            aria-label={t("skillsHub.manage.sort")}
            className="py-1"
          >
            <option value="name">{t("skillsHub.manage.sortName")}</option>
            <option value="recent">{t("skillsHub.manage.sortRecent")}</option>
          </Select>
        </div>
        {draftDirty && (
          <Button
            className="ml-auto"
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
          const visible = sortSkills(
            activeAuthor
              ? catalog.skills.filter((k) => k.authors?.includes(activeAuthor))
              : catalog.skills,
            sort,
          );
          if (visible.length === 0) return null;
          const whole = isWhole(catalog.name);
          const pickedCount = catalog.skills.filter((k) => isPicked(catalog.name, k.name)).length;
          const states = skillsByCatalog.get(catalog.name);
          return (
            <li
              key={catalog.name}
              className={`rounded-lg border px-3 py-2 ${pickedCount > 0 ? "border-gray-400 dark:border-gray-600" : "border-gray-200 dark:border-gray-800"}`}
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
              <ul className="mt-1.5 flex flex-wrap gap-x-1.5 gap-y-1 pl-6">
                {visible.map((skill) => {
                  const picked = isPicked(catalog.name, skill.name);
                  const neededBy = picked
                    ? undefined
                    : requiredBy.get(`${catalog.name}/${skill.name}`);
                  // Link state reflects what's saved — only shown while the skill is still linked.
                  const state = picked || neededBy ? states?.get(skill.name) : undefined;
                  return (
                    <li key={skill.name} className="flex items-center">
                      <Tooltip
                        content={
                          <span className="block max-w-md whitespace-pre-line font-normal">
                            {neededBy &&
                              `${t("skillsHub.manage.requiredBy", { names: neededBy.join(", ") })}\n\n`}
                            {skill.description || t("skillsHub.preview.noDescription")}
                            {((skill.authors?.length ?? 0) > 0 || Boolean(skill.updatedAt)) && (
                              <span className="mt-1.5 block text-gray-400">
                                {[
                                  skill.authors?.join(", "),
                                  skill.updatedAt &&
                                    t("skillsHub.manage.updatedAt", {
                                      date: formatUpdatedAt(skill.updatedAt, language),
                                    }),
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            )}
                          </span>
                        }
                      >
                        <button
                          type="button"
                          aria-pressed={picked}
                          onClick={() => toggleSkill(catalog, skill.name)}
                          className={`flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[11px] transition-colors ${
                            neededBy
                              ? "border-dashed border-gray-400 text-gray-700 dark:border-gray-500 dark:text-gray-300"
                              : !picked
                                ? "border-gray-200 text-gray-500 hover:border-gray-400 dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-500"
                                : state
                                  ? `border-transparent ${STATE_CLASSES[state]}`
                                  : "border-gray-500 bg-gray-100 text-gray-800 dark:border-gray-400 dark:bg-gray-800 dark:text-gray-100"
                          }`}
                        >
                          {picked ? (
                            <Check className="h-3 w-3" />
                          ) : neededBy ? (
                            <Link2 className="h-3 w-3" />
                          ) : (
                            <Plus className="h-3 w-3" />
                          )}
                          {skill.name}
                          {state && state !== "linked" && <> · {t(STATE_LABEL_KEYS[state])}</>}
                        </button>
                      </Tooltip>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-0.5 min-h-0! min-w-0! p-0.5!"
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
      className="h-4 w-4 accent-violet-600 dark:accent-violet-400"
    />
  );
}
