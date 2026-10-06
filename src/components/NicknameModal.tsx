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
 * The caller only mounts this component while the modal is open (`{showNicknameModal && <NicknameModal ... />}`,
 * not an always-mounted `open` prop) specifically so `useState(currentNickname)` re-initializes
 * fresh on every open — no effect-based resync needed, which would otherwise trip the
 * `set-state-in-effect` lint rule for a plain "sync from a prop" pattern.
 *
 * A wrapping textarea rather than a single-line input so long nicknames (e.g. the "New task"
 * auto nickname with its full Jira URL) are readable while editing. A nickname is still one line:
 * Enter saves, and pasted line breaks are collapsed into spaces.
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
