import { useState } from "react";
import { Input } from "./Input";
import { Modal } from "./Modal";

type CreateWorktreeModalProps = {
  defaultName: string;
  isLoading: boolean;
  onCreate: (name: string) => void;
  onCancel: () => void;
};

/**
 * Mounted only while open (same pattern as NicknameModal) so `useState(defaultName)`
 * re-initializes fresh every time this session's card opens it.
 */
export function CreateWorktreeModal({
  defaultName,
  isLoading,
  onCreate,
  onCancel,
}: CreateWorktreeModalProps) {
  const [name, setName] = useState(defaultName);
  const trimmed = name.trim();

  return (
    <Modal
      open
      title="Create worktree"
      onClose={onCancel}
      onCancel={onCancel}
      onConfirm={trimmed ? () => onCreate(trimmed) : undefined}
      confirmLabel="Create & open terminal"
      cancelLabel="Cancel"
      isConfirmLoading={isLoading}
      size="sm"
    >
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Runs <code>claude --worktree &lt;name&gt;</code> for this project: the CLI checks out a
        fresh <code>worktree-&lt;name&gt;</code> branch into its own folder (so it doesn't disturb
        the terminal already running there) and starts a new conversation in it. It can't resume
        this specific session's transcript from a different folder — the CLI ties a session to the
        exact directory it started in.
      </p>

      <Input
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && trimmed) onCreate(trimmed);
        }}
        autoFocus
        maxLength={200}
        placeholder="Worktree name, e.g. my-task"
        className="mt-4"
      />
    </Modal>
  );
}
