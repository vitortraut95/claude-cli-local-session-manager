import { useState, type ReactNode } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { Modal } from "./Modal";

/** Big secondary editor: holds its own draft so Cancel discards, Save commits. */
export function BigEditorModal<T>({
  title,
  description,
  initial,
  canSave = () => true,
  onCancel,
  onSave,
  render,
}: {
  title: string;
  description: string;
  initial: T;
  canSave?: (value: T) => boolean;
  onCancel: () => void;
  onSave: (value: T) => Promise<void>;
  render: (value: T, setValue: (value: T) => void) => ReactNode;
}) {
  const { t } = useLanguage();
  const [value, setValue] = useState<T>(initial);
  const [saving, setSaving] = useState(false);
  return (
    <Modal
      open
      title={title}
      onClose={onCancel}
      onCancel={onCancel}
      onConfirm={() => {
        setSaving(true);
        void onSave(value).finally(() => setSaving(false));
      }}
      confirmLabel={t("settings.save")}
      cancelLabel={t("settings.cancel")}
      isConfirmLoading={saving}
      isConfirmDisabled={!canSave(value)}
      size="xxl"
    >
      <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">{description}</p>
      {render(value, setValue)}
    </Modal>
  );
}
