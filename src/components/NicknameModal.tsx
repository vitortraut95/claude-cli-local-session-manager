import { useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { Input } from "./Input";
import { Modal } from "./Modal";

type NicknameModalProps = {
  currentNickname: string;
  onSave: (nickname: string) => void;
  onCancel: () => void;
};

/**
 * The caller only mounts this component while the modal is open (`{showNicknameModal && <NicknameModal ... />}`,
 * not an always-mounted `open` prop) specifically so `useState(currentNickname)` re-initializes
 * fresh on every open — no effect-based resync needed, which would otherwise trip the
 * `set-state-in-effect` lint rule for a plain "sync from a prop" pattern.
 */
export function NicknameModal({ currentNickname, onSave, onCancel }: NicknameModalProps) {
  const [nickname, setNickname] = useState(currentNickname);
  const { t } = useLanguage();

  return (
    <Modal
      open
      title={t("nicknameModal.title")}
      onClose={onCancel}
      onCancel={onCancel}
      onConfirm={() => onSave(nickname)}
      confirmLabel={t("nicknameModal.save")}
      cancelLabel={t("nicknameModal.cancel")}
      size="sm"
    >
      <p className="text-sm text-gray-500 dark:text-gray-400">{t("nicknameModal.description")}</p>

      <Input
        type="text"
        value={nickname}
        onChange={(event) => setNickname(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSave(nickname);
        }}
        autoFocus
        maxLength={100}
        placeholder={t("nicknameModal.placeholder")}
        className="mt-4"
      />
    </Modal>
  );
}
