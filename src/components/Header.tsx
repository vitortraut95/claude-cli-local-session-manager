import { Bot, Plus } from "lucide-react";
import { useState } from "react";
import { useTheme } from "../hooks/useTheme";
import { useUpdate } from "../hooks/useUpdate";
import { useUsageLimits } from "../hooks/useUsageLimits";
import { Button } from "./Button";
import { NewTaskModal } from "./NewTaskModal";
import { ThemeToggle } from "./ThemeToggle";
import { UpdateButton } from "./UpdateButton";
import { UsageLimitsBadge } from "./UsageLimitsBadge";

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const { status: updateStatus, checking, updating, applyUpdate } = useUpdate();
  const {
    status: usageStatus,
    loading: usageLoading,
    error: usageError,
    refresh: refreshUsage,
  } = useUsageLimits();
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);

  return (
    <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-900 dark:bg-gray-700">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 sm:text-xl">
              Claude CLI Local Session Manager
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage your local Claude CLI sessions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={() => setShowNewTaskModal(true)} icon={<Plus className="h-4 w-4" />}>
            Nova tarefa
          </Button>
          <UsageLimitsBadge
            status={usageStatus}
            loading={usageLoading}
            error={usageError}
            onRefresh={() => refreshUsage(true)}
          />
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <UpdateButton
            status={updateStatus}
            checking={checking}
            updating={updating}
            onUpdate={applyUpdate}
          />
        </div>
      </div>

      <NewTaskModal open={showNewTaskModal} onClose={() => setShowNewTaskModal(false)} />
    </header>
  );
}
