import { Code2, FlaskConical, GitPullRequest } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import type { QueueKind } from "../services/tasksApi";

const KIND_STYLES: Record<QueueKind, { icon: typeof Code2; active: string; badge: string }> = {
  dev: {
    icon: Code2,
    active:
      "border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/20 " +
      "dark:border-indigo-400 dark:bg-indigo-950/50 dark:text-indigo-300",
    badge: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300",
  },
  test: {
    icon: FlaskConical,
    active:
      "border-teal-500 bg-teal-50 text-teal-700 ring-2 ring-teal-500/20 " +
      "dark:border-teal-400 dark:bg-teal-950/50 dark:text-teal-300",
    badge: "bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300",
  },
  review: {
    icon: GitPullRequest,
    active:
      "border-sky-500 bg-sky-50 text-sky-700 ring-2 ring-sky-500/20 " +
      "dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-300",
    badge: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
  },
};

type TaskQueueKindPickerProps = {
  value: QueueKind | null;
  onChange: (kind: QueueKind) => void;
  large: boolean;
  /** The kinds offered; a ticket entry can't become a review (its key is a PR's). */
  kinds?: readonly QueueKind[];
};

/** Big cards (with what each kind does) for the paste form, a compact toggle in the rows. */
export function TaskQueueKindPicker({
  value,
  onChange,
  large,
  kinds = ["dev", "test", "review"],
}: TaskQueueKindPickerProps) {
  const { t } = useLanguage();
  return (
    <div
      role="radiogroup"
      aria-label={t("taskQueueModal.kindAriaLabel")}
      className={large ? "grid grid-cols-1 gap-3 sm:grid-cols-3" : "flex gap-1.5"}
    >
      {kinds.map((kind) => {
        const { icon: Icon, active } = KIND_STYLES[kind];
        const selected = value === kind;
        return (
          <button
            key={kind}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(kind)}
            className={`flex items-center rounded-lg border text-left transition-colors ${
              selected
                ? active
                : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:bg-gray-800/60"
            } ${large ? "gap-3 p-3" : "gap-1.5 px-2 py-1 text-xs font-medium"}`}
          >
            <Icon className={large ? "h-7 w-7 shrink-0" : "h-3.5 w-3.5"} />
            {large ? (
              <span className="flex flex-col">
                <span className="text-sm font-semibold">{t(`taskQueueModal.kind.${kind}`)}</span>
                <span className="text-xs opacity-80">{t(`taskQueueModal.kind.${kind}.hint`)}</span>
              </span>
            ) : (
              t(`taskQueueModal.kind.${kind}`)
            )}
          </button>
        );
      })}
    </div>
  );
}

export function TaskQueueKindBadge({ kind }: { kind: QueueKind }) {
  const { t } = useLanguage();
  const { icon: Icon, badge } = KIND_STYLES[kind];
  return (
    <span
      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${badge}`}
    >
      <Icon className="h-3 w-3" /> {t(`taskQueueModal.kind.${kind}`)}
    </span>
  );
}
