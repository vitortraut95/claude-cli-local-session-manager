import { useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { Modal } from "./Modal";

type NicknameModalProps = {
  currentNickname: string;
  onSave: (nickname: string) => void;
  onCancel: () => void;
};

const TEXTAREA_CLASSNAME =
  "mt-4 w-full resize-y rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900 " +
  "placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-2 " +
  "focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 " +
  "dark:placeholder:text-gray-500 dark:focus:border-gray-600 dark:focus:ring-gray-100/10";

/**
 * Mounted only while open, so `useState(currentNickname)` re-initializes on every open.
 * A wrapping textarea for readability, but a nickname is one line: Enter saves, pasted line breaks
 * become spaces.
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
      size="lg"
    >
      <p className="text-sm text-gray-500 dark:text-gray-400">{t("nicknameModal.description")}</p>

      <textarea
        value={nickname}
        onChange={(event) => setNickname(event.target.value.replace(/\s*[\r\n]+\s*/g, " "))}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onSave(nickname);
          }
        }}
        onFocus={(event) => {
          const end = event.target.value.length;
          event.target.setSelectionRange(end, end);
        }}
        autoFocus
        rows={4}
        placeholder={t("nicknameModal.placeholder")}
        className={TEXTAREA_CLASSNAME}
      />
    </Modal>
  );
}
