import { ArrowRight, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import type { AppView } from "../hooks/useAppView";
import { useLanguage } from "../hooks/useLanguage";
import type { TranslationKey } from "../i18n/translations";
import { Button } from "./Button";

type Step = {
  id: string;
  title: TranslationKey;
  body: TranslationKey;
  /** The navigation items (`data-tour`) it points at. */
  targets: string[];
  /** The page "Show me" goes to. */
  view?: AppView;
};

const STEPS: Step[] = [
  { id: "welcome", title: "tour.welcome.title", body: "tour.welcome.body", targets: [] },
  {
    id: "sessions",
    title: "tour.sessions.title",
    body: "tour.sessions.body",
    targets: ["sessions"],
    view: "sessions",
  },
  {
    id: "newTask",
    title: "tour.newTask.title",
    body: "tour.newTask.body",
    targets: ["new-task"],
    view: "queue",
  },
  {
    id: "queue",
    title: "tour.queue.title",
    body: "tour.queue.body",
    targets: ["queue"],
    view: "queue",
  },
  {
    id: "board",
    title: "tour.board.title",
    body: "tour.board.body",
    targets: ["board"],
    view: "board",
  },
  {
    id: "tools",
    title: "tour.tools.title",
    body: "tour.tools.body",
    targets: ["cleanup", "skills", "settings"],
  },
  {
    id: "guide",
    title: "tour.guide.title",
    body: "tour.guide.body",
    targets: ["guide"],
    view: "guide",
  },
];

type WelcomeTourProps = {
  /** The current step, kept by the parent so a panel opened over the tour doesn't restart it. */
  index: number;
  onIndexChange: (index: number) => void;
  onNavigate: (view: AppView) => void;
  onClose: () => void;
};

/**
 * A short, non-blocking walk through the app: a card in the corner, one step per area, with the
 * matching navigation item outlined. The page stays usable behind it; Esc or "Skip" ends it.
 */
export function WelcomeTour({
  index: rawIndex,
  onIndexChange: setIndex,
  onNavigate,
  onClose,
}: WelcomeTourProps) {
  const { t } = useLanguage();
  const index = Math.min(Math.max(rawIndex, 0), STEPS.length - 1);
  const titleId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const step = STEPS[index]!;
  const last = index === STEPS.length - 1;

  // Outline the step's targets (the visible ones: sidebar or bottom bar).
  useEffect(() => {
    const elements = step.targets.flatMap((target) => [
      ...document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`),
    ]);
    elements.forEach((element) => element.classList.add("tour-highlight"));
    return () => elements.forEach((element) => element.classList.remove("tour-highlight"));
  }, [step]);

  useEffect(() => {
    cardRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      tabIndex={-1}
      className="panel-in fixed right-4 bottom-20 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-violet-300 bg-white p-5 shadow-2xl shadow-violet-900/20 lg:bottom-6 dark:border-violet-500/40 dark:bg-gray-900"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-violet-700 dark:text-violet-300">
          {t("tour.label")} · {t("tour.step", { current: index + 1, total: STEPS.length })}
        </p>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label={t("tour.skip")}
          icon={<X className="h-4 w-4" />}
        />
      </div>
      <h2 id={titleId} className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100">
        {t(step.title)}
      </h2>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{t(step.body)}</p>
      <div className="mt-4 flex gap-1" aria-hidden="true">
        {STEPS.map((item, position) => (
          <span
            key={item.id}
            className={`h-1 flex-1 rounded-full ${
              position <= index ? "bg-violet-500" : "bg-gray-200 dark:bg-gray-700"
            }`}
          />
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {step.view && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate(step.view!)}
            icon={<ArrowRight className="h-3.5 w-3.5" />}
          >
            {t("tour.show")}
          </Button>
        )}
        <span className="flex-1" />
        {index > 0 && (
          <Button variant="outline" size="sm" onClick={() => setIndex(index - 1)}>
            {t("tour.back")}
          </Button>
        )}
        <Button
          size="sm"
          onClick={() => {
            if (last) {
              onClose();
              return;
            }
            const next = STEPS[index + 1]!;
            // Following along: the steps about a page show that page.
            if (next.view && next.view !== "guide") onNavigate(next.view);
            setIndex(index + 1);
          }}
        >
          {last ? t("tour.done") : t("tour.next")}
        </Button>
      </div>
    </div>
  );
}
