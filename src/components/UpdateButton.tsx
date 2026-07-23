import { Loader2, RefreshCw } from "lucide-react";
import type { UpdateStatus } from "../services/systemApi";
import { Tooltip } from "./Tooltip";

type UpdateButtonProps = {
  status: UpdateStatus | null;
  checking: boolean;
  updating: boolean;
  onUpdate: () => void;
};

function describeStatus(status: UpdateStatus | null, checking: boolean, updating: boolean) {
  if (checking) return "Checking for updates…";
  if (updating) return "Updating — running git pull and npm install…";
  if (!status) return "Could not check for updates.";
  if (!status.updateAvailable) return "Up to date";

  const commits = status.behind === 1 ? "1 new commit" : `${status.behind} new commits`;
  return `${commits} on ${status.tracking ?? status.branch} — click to update`;
}

export function UpdateButton({ status, checking, updating, onUpdate }: UpdateButtonProps) {
  const isBusy = checking || updating;
  const updateAvailable = !!status?.updateAvailable;
  const disabled = isBusy || !updateAvailable;

  return (
    <Tooltip content={describeStatus(status, checking, updating)}>
      <span className="relative inline-flex">
        <button
          type="button"
          onClick={onUpdate}
          disabled={disabled}
          aria-label="Update application"
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            updateAvailable
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-400 dark:hover:bg-emerald-950"
              : "border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-600"
          }`}
        >
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Update
        </button>
        {updateAvailable && !isBusy && (
          <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-gray-900" />
        )}
      </span>
    </Tooltip>
  );
}
