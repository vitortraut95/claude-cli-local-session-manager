import { GitBranch } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import type { Session } from "../types/session";
import { resolveSessionBranches } from "../utils/sessionBranches";
import { Input } from "./Input";
import { Modal } from "./Modal";

type SessionBranchesModalProps = {
  session: Session;
  onSave: (origin: string, destination: string) => void;
  onCancel: () => void;
};

/**
 * Edits the session's saved origin/destination branches. Prefilled with the branches in use; a
 * blank field isn't saved and falls back to the nickname/transcript value (its placeholder).
 */
export function SessionBranchesModal({ session, onSave, onCancel }: SessionBranchesModalProps) {
  const { t } = useLanguage();
  const current = resolveSessionBranches(session);
  const fallback = resolveSessionBranches({
    ...session,
    savedOriginBranch: null,
    savedDestinationBranch: null,
  });
  const [origin, setOrigin] = useState(current.origin ?? "");
  const [destination, setDestination] = useState(current.destination ?? "");
  const save = () => onSave(origin, destination);

  const field = (label: string, value: string, set: (v: string) => void, placeholder: string) => (
    <label className="mt-4 flex flex-col gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
      {label}
      <Input
        type="text"
        icon={<GitBranch className="h-4 w-4" />}
        value={value}
        onChange={(event) => set(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            save();
          }
        }}
        placeholder={placeholder || t("sessionBranchesModal.noFallback")}
      />
    </label>
  );

  return (
    <Modal
      open
      title={t("sessionBranchesModal.title")}
      onClose={onCancel}
      onCancel={onCancel}
      onConfirm={save}
      confirmLabel={t("nicknameModal.save")}
      cancelLabel={t("nicknameModal.cancel")}
      size="lg"
    >
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {t("sessionBranchesModal.description")}
      </p>
      {field(t("sessionBranchesModal.origin"), origin, setOrigin, fallback.origin ?? "")}
      {field(
        t("sessionBranchesModal.destination"),
        destination,
        setDestination,
        fallback.destination ?? "",
      )}
    </Modal>
  );
}
