import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "../hooks/useToast";
import * as cleanupApi from "../services/cleanupApi";
import type { CleanupFinding } from "../services/cleanupApi";
import { Button } from "./Button";
import { Modal } from "./Modal";

type CleanupModalProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * Lists local, one-click-safe cleanup findings (currently: stale worktree git metadata, and
 * worktrees whose branch is already merged — see cleanupService.ts for exactly what qualifies)
 * and lets each be fixed independently. Not always-mounted like NewTaskModal — there's no
 * in-progress form input here worth preserving across an accidental close, so a plain
 * conditional-fetch-on-open is enough.
 */
export function CleanupModal({ open, onClose }: CleanupModalProps) {
  const { showToast } = useToast();

  const [findings, setFindings] = useState<CleanupFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [executingId, setExecutingId] = useState<string | null>(null);

  // Re-fetched every time the modal opens (not just once on mount) — deferred via a 0ms timer so
  // its setState calls happen in a callback, not synchronously in the effect body (same pattern
  // as NewTaskModal's project-folder refresh).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      setLoadError(null);
      cleanupApi
        .fetchCleanupFindings()
        .then((list) => {
          if (!cancelled) setFindings(list);
        })
        .catch((err) => {
          if (!cancelled) {
            setLoadError(
              err instanceof Error ? err.message : "Não foi possível buscar itens de limpeza.",
            );
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open]);

  const handleExecute = async (finding: CleanupFinding) => {
    setExecutingId(finding.id);
    try {
      await cleanupApi.executeCleanupFinding(finding);
      setFindings((current) => current.filter((item) => item.id !== finding.id));
      showToast("Item resolvido com sucesso.", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Não foi possível executar essa limpeza.",
        "error",
      );
    } finally {
      setExecutingId(null);
    }
  };

  return (
    <Modal
      open={open}
      title="Limpeza"
      onClose={onClose}
      onCancel={onClose}
      cancelLabel="Fechar"
      size="xl"
    >
      <div className="flex flex-col gap-2 mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-400">
        <p>
          <strong>Como funciona:</strong> verifica localmente os worktrees de todos os projetos
          conhecidos pelo app à procura das situações:
        </p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>
            <strong>Worktree apagado manualmente</strong> (pasta removida direto no disco, fora do
            app) — o git ainda guarda o registro dele; a correção só limpa esse registro, sem apagar
            nada.
          </li>
          <li>
            <strong>Worktree com branch já mergeada</strong> na branch padrão do repositório, sem
            sessão ativa nem alterações pendentes — pode ser removido com segurança (worktree e
            branch local juntos).
          </li>
        </ul>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Buscando...
        </p>
      ) : loadError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
      ) : findings.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Nada encontrado para limpar.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {findings.map((finding) => (
            <li
              key={finding.id}
              className="rounded-lg border border-gray-200 p-3 dark:border-gray-800"
            >
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {finding.title}
              </p>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{finding.description}</p>
              <div className="mt-3 flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExecute(finding)}
                  disabled={executingId !== null}
                  icon={
                    executingId === finding.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : undefined
                  }
                >
                  Executar
                </Button>
              </div>
              <p className="mt-2 break-all font-mono text-xs text-gray-400 dark:text-gray-500">
                {finding.command}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
