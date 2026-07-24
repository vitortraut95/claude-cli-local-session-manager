import { Bot } from "lucide-react";
import { useTheme } from "../hooks/useTheme";
import { useUpdate } from "../hooks/useUpdate";
import { useWarpPreference } from "../hooks/useWarpPreference";
import { ThemeToggle } from "./ThemeToggle";
import { UpdateButton } from "./UpdateButton";
import { WarpToggle } from "./WarpToggle";

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const { useWarp, toggleWarp } = useWarpPreference();
  const { status: updateStatus, checking, updating, applyUpdate } = useUpdate();

  return (
    <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900 dark:bg-gray-700">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Claude CLI Local Session Manager
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
        </div>
      </div>
    </header>
  );
}
