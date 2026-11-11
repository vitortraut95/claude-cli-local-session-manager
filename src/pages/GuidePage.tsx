import { ArrowRight, Compass, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { BetaBadge } from "../components/BetaBadge";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { PageHeader } from "../components/PageHeader";
import { useLanguage } from "../hooks/useLanguage";
import { useShell, type ShellActions } from "../hooks/useShell";
import type { TranslationKey } from "../i18n/translations";

/** Where an item's "Open" button takes the user. */
type GuideAction =
  | "sessions"
  | "newTask"
  | "newSession"
  | "refine"
  | "queue"
  | "board"
  | "automation"
  | "cleanup"
  | "skills"
  | "settings";

type GuideItem = { id: string; action?: GuideAction; beta?: boolean };
type GuideSection = { id: string; items: GuideItem[] };

/** Every feature, grouped by area; texts live in `guide.<section>.<item>.{title,what,where}`. */
const SECTIONS: GuideSection[] = [
  {
    id: "sessions",
    items: [
      { id: "list", action: "sessions" },
      { id: "search", action: "sessions" },
      { id: "views", action: "sessions" },
      { id: "detail", action: "sessions" },
      { id: "resume", action: "sessions" },
      { id: "resumeOpen", action: "sessions" },
      { id: "status", action: "sessions" },
      { id: "nickname", action: "sessions" },
      { id: "task", action: "sessions" },
      { id: "previews", action: "sessions" },
      { id: "conversation", action: "sessions" },
      { id: "history", action: "sessions" },
      { id: "links", action: "sessions" },
      { id: "editor", action: "sessions" },
      { id: "missing", action: "sessions" },
      { id: "delete", action: "sessions" },
    ],
  },
  {
    id: "start",
    items: [
      { id: "newTask", action: "newTask" },
      { id: "newSession", action: "newSession" },
      { id: "refine", action: "refine" },
    ],
  },
  {
    id: "queue",
    items: [
      { id: "add", action: "queue" },
      { id: "prompt", action: "queue" },
      { id: "launches", action: "queue" },
      { id: "review", action: "queue" },
      { id: "scheduler", action: "queue" },
      { id: "edit", action: "queue" },
    ],
  },
  {
    id: "board",
    items: [
      { id: "eye", action: "board", beta: true },
      { id: "modes", action: "automation", beta: true },
      { id: "setup", action: "board", beta: true },
      { id: "attention", action: "board", beta: true },
      { id: "live", action: "board", beta: true },
      { id: "history", action: "board", beta: true },
      { id: "tools", action: "board", beta: true },
    ],
  },
  {
    id: "tools",
    items: [
      { id: "cleanup", action: "cleanup" },
      { id: "skills", action: "skills" },
      { id: "settings", action: "settings" },
      { id: "usage" },
      { id: "update" },
      { id: "language" },
      { id: "shortcuts" },
    ],
  },
];

function runAction(action: GuideAction, shell: ShellActions) {
  switch (action) {
    case "sessions":
    case "queue":
    case "board":
      shell.navigate(action);
      return;
    case "newTask":
      shell.openNewTask();
      return;
    case "newSession":
      shell.openNewSession();
      return;
    case "refine":
      shell.openRefinement();
      return;
    case "automation":
      // The modes only exist once the Board is on; until then the Board page says how.
      if (shell.automationsOn) shell.openAutomation();
      else shell.navigate("board");
      return;
    case "cleanup":
      shell.openCleanup();
      return;
    case "skills":
      shell.openSkills();
      return;
    case "settings":
      shell.openSettings();
  }
}

/**
 * The onboarding reference: every feature of the app, what it does and how to reach it, with a
 * button that goes there. Searchable; the welcome tour can be replayed from here.
 */
export function GuidePage() {
  const { t } = useLanguage();
  const shell = useShell();
  const [query, setQuery] = useState("");

  const sections = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (!needle) return true;
        const base = `guide.${section.id}.${item.id}`;
        return (["title", "what", "where"] as const).some((field) =>
          t(`${base}.${field}` as TranslationKey)
            .toLowerCase()
            .includes(needle),
        );
      }),
    })).filter((section) => section.items.length > 0);
  }, [query, t]);

  return (
    <div className="flex min-h-dvh flex-col">
      <PageHeader
        title={t("guide.title")}
        subtitle={t("guide.subtitle")}
        actions={
          <Button
            variant="outline"
            onClick={shell.startTour}
            icon={<Compass className="h-4 w-4" />}
          >
            {t("guide.tour")}
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-full max-w-md">
            <label htmlFor="guide-search" className="sr-only">
              {t("guide.search")}
            </label>
            <Input
              id="guide-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("guide.search.placeholder")}
              icon={<Search className="h-4 w-4" />}
            />
          </div>
          <nav aria-label={t("guide.contents")} className="flex flex-wrap gap-1.5">
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#guide-${section.id}`}
                className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-gray-400 hover:text-gray-900 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:text-gray-100"
              >
                {t(`guide.section.${section.id}` as TranslationKey)}
              </a>
            ))}
          </nav>
        </div>
      </PageHeader>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-8 sm:px-7">
        {sections.length === 0 && (
          <p className="py-10 text-center text-sm text-gray-600 dark:text-gray-400">
            {t("guide.search.none", { query })}
          </p>
        )}
        {sections.map((section) => (
          <section
            key={section.id}
            id={`guide-${section.id}`}
            aria-labelledby={`guide-h-${section.id}`}
            className="scroll-mt-6"
          >
            <h2
              id={`guide-h-${section.id}`}
              className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100"
            >
              {t(`guide.section.${section.id}` as TranslationKey)}
              {section.id === "board" && <BetaBadge />}
            </h2>
            <ul className="divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
              {section.items.map((item) => {
                const base = `guide.${section.id}.${item.id}`;
                return (
                  <li
                    key={item.id}
                    className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start"
                  >
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {t(`${base}.title` as TranslationKey)}
                      </h3>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {t(`${base}.what` as TranslationKey)}
                      </p>
                      <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-xs text-gray-600 dark:text-gray-400">
                        <span className="font-medium text-violet-700 dark:text-violet-300">
                          {t("guide.where")}
                        </span>
                        <span>{t(`${base}.where` as TranslationKey)}</span>
                        {item.beta && !shell.automationsOn && (
                          <span className="text-amber-700 dark:text-amber-400">
                            · {t("guide.beta")}
                          </span>
                        )}
                      </p>
                    </div>
                    {item.action && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="self-start"
                        onClick={() => runAction(item.action!, shell)}
                        icon={<ArrowRight className="h-3.5 w-3.5" />}
                        aria-label={`${t("guide.open")}: ${t(`${base}.title` as TranslationKey)}`}
                      >
                        {t("guide.open")}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
