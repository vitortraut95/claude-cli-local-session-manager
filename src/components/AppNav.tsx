import {
  AlertTriangle,
  BookOpen,
  Eye,
  ListTodo,
  Menu,
  Moon,
  Settings,
  Sparkles,
  Sun,
  SquareTerminal,
  Wand2,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import type { AppView } from "../hooks/useAppView";
import { useLanguage } from "../hooks/useLanguage";
import type { Theme } from "../hooks/useTheme";
import { LANGUAGE_OPTIONS, type Language } from "../i18n/translations";
import type { SkillsHubStatus } from "../services/skillsHubApi";
import type { ClaudeUsageStatus, UpdateStatus } from "../services/systemApi";
import { BetaBadge } from "./BetaBadge";
import { Modal } from "./Modal";
import { Select } from "./Select";
import { Tooltip } from "./Tooltip";
import { UpdateButton } from "./UpdateButton";
import { UsageLimitsBadge } from "./UsageLimitsBadge";

export type AppNavProps = {
  view: AppView;
  onNavigate: (view: AppView) => void;
  /** Sessions not done yet. */
  sessionCount: number;
  /** Sessions in "needs you" (a dot on the Sessions item). */
  attentionCount: number;
  /** Queue entries still waiting for their session. */
  queueCount: number;
  automationsOn: boolean;
  skills: { status: SkillsHubStatus | null; failed: boolean };
  usage: {
    status: ClaudeUsageStatus | null;
    loading: boolean;
    error: string | null;
    refresh: () => void;
  };
  update: {
    status: UpdateStatus | null;
    checking: boolean;
    updating: boolean;
    apply: (force: boolean) => void;
  };
  theme: Theme;
  onToggleTheme: () => void;
  onOpenCleanup: () => void;
  onOpenSkills: () => void;
  onOpenSettings: () => void;
};

/** The skills item's state: amber while the repo isn't set up here, else how many are linked. */
function skillsState(skills: AppNavProps["skills"]) {
  const status = skills.status;
  const warning = Boolean(status && !status.notUsed && (status.cloneUrl === null || !status.found));
  const linked =
    status?.found && !warning ? status.skills.filter((s) => s.state === "linked").length : null;
  return { warning, notConfigured: status?.cloneUrl === null, linked };
}

const itemClass = (current: boolean) =>
  `group flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm transition-colors ${
    current
      ? "bg-gray-100 font-medium text-gray-900 dark:bg-gray-800/80 dark:text-gray-100"
      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-100"
  }`;

function Count({
  value,
  tone = "muted",
  label,
}: {
  value: number;
  tone?: "muted" | "amber";
  label: string;
}) {
  if (value <= 0) return null;
  return (
    <span
      aria-label={label}
      className={`ml-auto text-xs tabular-nums ${
        tone === "amber"
          ? "font-medium text-amber-700 dark:text-amber-400"
          : "text-gray-500 dark:text-gray-400"
      }`}
    >
      {value}
    </span>
  );
}

/** The app's navigation: a fixed sidebar on large screens, a bottom bar (+ "More") on small ones. */
export function AppNav(props: AppNavProps) {
  const { t } = useLanguage();
  const [moreOpen, setMoreOpen] = useState(false);
  const skills = skillsState(props.skills);

  const pages: {
    view: AppView;
    label: string;
    icon: ReactNode;
    extra?: ReactNode;
  }[] = [
    {
      view: "sessions",
      label: t("nav.sessions"),
      icon: <SquareTerminal className="h-[18px] w-[18px]" />,
      extra: (
        <>
          {props.attentionCount > 0 && (
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-400"
            />
          )}
          <Count
            value={props.sessionCount}
            label={t("nav.sessions.count", { count: props.sessionCount })}
          />
        </>
      ),
    },
    {
      view: "board",
      label: t("nav.board"),
      icon: <Eye className="h-[18px] w-[18px]" />,
      extra: (
        <span className="ml-auto">
          <BetaBadge />
        </span>
      ),
    },
    {
      view: "queue",
      label: t("nav.queue"),
      icon: <ListTodo className="h-[18px] w-[18px]" />,
      extra: (
        <Count value={props.queueCount} label={t("nav.queue.count", { count: props.queueCount })} />
      ),
    },
  ];

  const pageItem = (page: (typeof pages)[number], onPick?: () => void) => {
    const current = props.view === page.view;
    const button = (
      <button
        key={page.view}
        type="button"
        data-tour={page.view}
        aria-current={current ? "page" : undefined}
        onClick={() => {
          props.onNavigate(page.view);
          onPick?.();
        }}
        className={itemClass(current)}
      >
        <span className={current ? "text-violet-600 dark:text-violet-400" : ""}>{page.icon}</span>
        <span className="truncate">{page.label}</span>
        {page.extra}
      </button>
    );
    return page.view === "board" && !props.automationsOn ? (
      <Tooltip key={page.view} content={t("nav.board.off")}>
        {button}
      </Tooltip>
    ) : (
      button
    );
  };

  const toolItems = (onPick?: () => void) => (
    <>
      <button
        type="button"
        data-tour="cleanup"
        onClick={() => {
          onPick?.();
          props.onOpenCleanup();
        }}
        className={itemClass(false)}
      >
        <Sparkles className="h-[18px] w-[18px]" />
        <span className="truncate">{t("nav.cleanup")}</span>
      </button>
      <Tooltip
        content={
          skills.warning
            ? t(skills.notConfigured ? "header.skills.notConfigured" : "header.skills.notInstalled")
            : skills.linked !== null
              ? t("header.skills.active", { count: skills.linked })
              : null
        }
      >
        <button
          type="button"
          data-tour="skills"
          onClick={() => {
            onPick?.();
            props.onOpenSkills();
          }}
          className={itemClass(false)}
        >
          <Wand2 className="h-[18px] w-[18px]" />
          <span className="truncate">{t("nav.skills")}</span>
          {skills.warning ? (
            <AlertTriangle
              aria-hidden="true"
              className="ml-auto h-4 w-4 text-amber-600 dark:text-amber-400"
            />
          ) : (
            skills.linked !== null && (
              <Count
                value={skills.linked}
                label={t("header.skills.active", { count: skills.linked })}
              />
            )
          )}
        </button>
      </Tooltip>
      <button
        type="button"
        data-tour="guide"
        aria-current={props.view === "guide" ? "page" : undefined}
        onClick={() => {
          props.onNavigate("guide");
          onPick?.();
        }}
        className={itemClass(props.view === "guide")}
      >
        <BookOpen className="h-[18px] w-[18px]" />
        <span className="truncate">{t("nav.guide")}</span>
      </button>
    </>
  );

  const footer = (onPick?: () => void) => (
    <div className="flex flex-col gap-2">
      <UsageLimitsBadge
        variant="sidebar"
        status={props.usage.status}
        loading={props.usage.loading}
        error={props.usage.error}
        onRefresh={props.usage.refresh}
      />
      <UpdateButton
        variant="sidebar"
        status={props.update.status}
        checking={props.update.checking}
        updating={props.update.updating}
        onUpdate={props.update.apply}
      />
      <div className="flex items-center gap-1">
        <button
          type="button"
          data-tour="settings"
          onClick={() => {
            onPick?.();
            props.onOpenSettings();
          }}
          className={`${itemClass(false)} flex-1`}
        >
          <Settings className="h-[18px] w-[18px]" />
          <span className="truncate">{t("nav.settings")}</span>
        </button>
        <PreferenceControls theme={props.theme} onToggleTheme={props.onToggleTheme} />
      </div>
    </div>
  );

  return (
    <>
      {/* Large screens: fixed sidebar. */}
      <nav
        aria-label={t("nav.label")}
        className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 overflow-y-auto border-r border-gray-200 bg-shell px-3 py-4 lg:flex dark:border-gray-800"
      >
        <div className="flex items-center gap-2.5 px-2 pb-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white">
            <SquareTerminal className="h-[18px] w-[18px]" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold tracking-tight text-gray-900 dark:text-gray-100">
              {t("nav.appName")}
            </span>
            <span className="truncate text-xs text-gray-500 dark:text-gray-400">
              {t("nav.appTagline")}
            </span>
          </span>
        </div>
        {pages.map((page) => pageItem(page))}
        <div className="my-2 border-t border-gray-200 dark:border-gray-800" />
        {toolItems()}
        <div className="min-h-6 flex-1" />
        {footer()}
      </nav>

      {/* Small screens: bottom bar. */}
      <nav
        aria-label={t("nav.label")}
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-gray-200 bg-shell pb-[env(safe-area-inset-bottom)] lg:hidden dark:border-gray-800"
      >
        {pages.map((page) => {
          const current = props.view === page.view;
          return (
            <button
              key={page.view}
              type="button"
              aria-current={current ? "page" : undefined}
              onClick={() => props.onNavigate(page.view)}
              className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
                current
                  ? "text-violet-700 dark:text-violet-300"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              {page.icon}
              {page.label}
              {page.view === "sessions" && props.attentionCount > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute top-2 right-[calc(50%-16px)] h-2 w-2 rounded-full bg-amber-500"
                />
              )}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-current={props.view === "guide" ? "page" : undefined}
          className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
            props.view === "guide"
              ? "text-violet-700 dark:text-violet-300"
              : "text-gray-500 dark:text-gray-400"
          }`}
        >
          <Menu className="h-[18px] w-[18px]" />
          {t("nav.more")}
        </button>
      </nav>
      <Modal
        open={moreOpen}
        title={t("nav.more")}
        onClose={() => setMoreOpen(false)}
        placement="side"
        size="sm"
      >
        <div className="flex flex-col gap-1">
          {toolItems(() => setMoreOpen(false))}
          <div className="my-3 border-t border-gray-200 dark:border-gray-800" />
          {footer(() => setMoreOpen(false))}
        </div>
      </Modal>
    </>
  );
}

/** Theme switch and language picker, side by side. */
function PreferenceControls({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const { t, language, setLanguage } = useLanguage();
  const themeLabel = t(theme === "dark" ? "themeToggle.switchToLight" : "themeToggle.switchToDark");
  return (
    <>
      <Tooltip content={themeLabel}>
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={themeLabel}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-100"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </Tooltip>
      {/* Short codes keep it narrow; the full name shows on hover. */}
      <Select
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
        aria-label={t("header.language")}
        className="w-auto min-w-0 border-0 bg-transparent px-2 text-xs font-medium uppercase dark:bg-transparent"
      >
        {LANGUAGE_OPTIONS.map((option) => (
          <option key={option.code} value={option.code} title={option.label}>
            {option.code.toUpperCase()}
          </option>
        ))}
      </Select>
    </>
  );
}
