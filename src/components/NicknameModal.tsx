import { useState } from "react";
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

  return (
    <Modal
      open
      title="Local nickname"
      onClose={onCancel}
      onCancel={onCancel}
      onConfirm={() => onSave(nickname)}
      confirmLabel="Save"
      cancelLabel="Cancel"
      size="sm"
    >
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Only shown in this app's session list, alongside the session's real title — it won't
        rename the session or change what any terminal (including Warp) shows for it. Leave blank
        to remove the nickname.
      </p>

      <Input
        type="text"
        value={nickname}
        onChange={(event) => setNickname(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSave(nickname);
        }}
        autoFocus
        maxLength={100}
        placeholder="Nickname"
        className="mt-4"
      />
    </Modal>
  );
}
