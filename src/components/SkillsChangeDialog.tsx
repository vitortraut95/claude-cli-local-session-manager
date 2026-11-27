import { Link2, Minus, Plus } from "lucide-react";
import { Modal } from "./Modal";

export type SkillsChangeItem = { name: string; note?: string };
export type SkillsChangeGroup = {
  label: string;
  tone: "add" | "remove";
  items: SkillsChangeItem[];
};

export type SkillsChangeRequest = {
  title: string;
  message: string;
  groups: SkillsChangeGroup[];
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  /** A second way through, e.g. "remove only this one". */
  secondaryLabel?: string;
  onSecondary?: () => void | Promise<void>;
};

const TONE_CLASSES = {
  add: "text-green-700 dark:text-green-400",
  remove: "text-red-700 dark:text-red-400",
};

/** Shows exactly which skills a change links or removes and waits for the user's go-ahead. */
export function SkillsChangeDialog({
  request,
  busy = false,
  onCancel,
}: {
  request: SkillsChangeRequest;
  busy?: boolean;
  onCancel: () => void;
}) {
  return (
    <Modal
      open
      title={request.title}
      onClose={onCancel}
      onCancel={onCancel}
      onConfirm={() => void request.onConfirm()}
      confirmLabel={request.confirmLabel}
      isConfirmLoading={busy}
      onSecondary={request.onSecondary ? () => void request.onSecondary?.() : undefined}
      secondaryLabel={request.secondaryLabel}
      size="md"
      icon={<Link2 className="h-5 w-5 text-violet-500" />}
    >
      <p className="text-sm text-gray-600 dark:text-gray-400">{request.message}</p>
      {request.groups
        .filter((group) => group.items.length > 0)
        .map((group) => (
          <div key={group.label} className="mt-3">
            <p className="mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">
              {group.label}
            </p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <li
                  key={item.name}
                  className={`flex items-baseline gap-1.5 font-mono text-xs ${TONE_CLASSES[group.tone]}`}
                >
                  {group.tone === "add" ? (
                    <Plus className="h-3 w-3 shrink-0 self-center" />
                  ) : (
                    <Minus className="h-3 w-3 shrink-0 self-center" />
                  )}
                  {item.name}
                  {item.note && (
                    <span className="font-sans text-gray-500 dark:text-gray-400">
                      · {item.note}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
    </Modal>
  );
}
