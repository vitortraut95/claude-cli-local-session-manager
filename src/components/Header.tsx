import { Bot, Power } from "lucide-react";
import { useState } from "react";
import { useToast } from "../hooks/useToast";
import { stopApplication } from "../services/systemApi";
import { ConfirmDialog } from "./ConfirmDialog";

export function Header() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [stopping, setStopping] = useState(false);
  const { showToast } = useToast();

  const handleConfirmStop = async () => {
    setStopping(true);
    try {
      await stopApplication();
      setShowConfirm(false);
      showToast("Aplicação encerrada. Você já pode fechar esta aba.", "success");
    } catch {
      showToast("Não foi possível encerrar a aplicação.", "error");
      setStopping(false);
    }
  };

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Claude Session Manager</h1>
            <p className="text-sm text-gray-500">Gerencie suas sessões locais do Claude CLI</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
        >
          <Power className="h-4 w-4" />
          Parar aplicação
        </button>
      </div>

      <ConfirmDialog
        open={showConfirm}
        title="Parar aplicação"
        message="Isso encerra o frontend e o backend e fecha as portas. Deseja continuar?"
        confirmLabel="Parar"
        cancelLabel="Cancelar"
        isLoading={stopping}
        onConfirm={handleConfirmStop}
        onCancel={() => setShowConfirm(false)}
      />
    </header>
  );
}
