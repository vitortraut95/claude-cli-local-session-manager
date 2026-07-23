import { Bot, Power } from "lucide-react";
import { useState } from "react";
import { useTheme } from "../hooks/useTheme";
import { useToast } from "../hooks/useToast";
import { useUpdate } from "../hooks/useUpdate";
import { useWarpPreference } from "../hooks/useWarpPreference";
import { stopApplication } from "../services/systemApi";
import { ConfirmDialog } from "./ConfirmDialog";
import { ThemeToggle } from "./ThemeToggle";
import { UpdateButton } from "./UpdateButton";
import { WarpToggle } from "./WarpToggle";

export function Header() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [stopping, setStopping] = useState(false);
  const { showToast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const { useWarp, toggleWarp } = useWarpPreference();
  const { status: updateStatus, checking, updating, applyUpdate } = useUpdate();

  const handleConfirmStop = async () => {
    setStopping(true);
    try {
      await stopApplication();
      setShowConfirm(false);
      showToast("Application stopped. You can now close this tab.", "success");
    } catch {
      showToast("Could not stop the application.", "error");
      setStopping(false);
    }
  };

  return (
    <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900 dark:bg-gray-700">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Claude Session Manager
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage your local Claude CLI sessions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <WarpToggle enabled={useWarp} onToggle={toggleWarp} />
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <UpdateButton
            status={updateStatus}
            checking={checking}
            updating={updating}
            onUpdate={applyUpdate}
          />
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-400 dark:hover:bg-red-950"
          >
            <Power className="h-4 w-4" />
            Stop application
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={showConfirm}
        title="Stop application"
        message="This will stop the frontend and backend and close the ports. Continue?"
        confirmLabel="Stop"
        cancelLabel="Cancel"
        isLoading={stopping}
        onConfirm={handleConfirmStop}
        onCancel={() => setShowConfirm(false)}
      />
    </header>
  );
}
