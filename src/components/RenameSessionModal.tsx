import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type RenameSessionModalProps = {
  currentTitle: string;
  onSave: (title: string) => void;
  onCancel: () => void;
};

/**
 * The caller only mounts this component while the modal is open (`{showRenameModal && <RenameSessionModal ... />}`,
 * not an always-mounted `open` prop) specifically so `useState(currentTitle)` re-initializes
 * fresh on every open — no effect-based resync needed, which would otherwise trip the
 * `set-state-in-effect` lint rule for a plain "sync from a prop" pattern.
 */
export function RenameSessionModal({ currentTitle, onSave, onCancel }: RenameSessionModalProps) {
  const [title, setTitle] = useState(currentTitle);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSave(title);
  };

  // Portalled to document.body — same containing-block reasoning as the other SessionCard
  // modals (see PromptPreviewModal.tsx / CLAUDE.md).
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4"
      onClick={onCancel}
    >
      <form
        role="dialog"
        aria-modal="true"
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Rename session
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Leave blank to reset to the auto-generated title.
        </p>

        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          autoFocus
          maxLength={100}
          placeholder="Session title"
          className="mt-4 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-gray-600 dark:focus:ring-gray-100/10"
        />

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600"
          >
            Save
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
