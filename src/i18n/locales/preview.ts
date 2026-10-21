import { dict } from "../dict";

export const preview = {
  "preview.open": dict("Open {name}'s local URL", "Abrir a URL local de {name}"),
  "preview.stop": dict(
    "Stop this worktree preview ({name}) and free its memory",
    "Parar este preview do worktree ({name}) e liberar a memória",
  ),
  "preview.stopConfirmTitle": dict("Stop the preview?", "Parar o preview?"),
  "preview.stopConfirmMessage": dict(
    "{name} ({url}) will be stopped and removed. The session can start it again when it needs to (run-local).",
    "{name} ({url}) vai ser parado e removido. A sessão sobe de novo quando precisar (run-local).",
  ),
  "preview.stopConfirm": dict("Stop preview", "Parar preview"),
  "preview.stopped": dict("{name} stopped.", "{name} parado."),
  "preview.stopError": dict("Couldn't stop the preview.", "Não foi possível parar o preview."),
};
